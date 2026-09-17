import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnuStatus } from '@prisma/client';
import { Subject } from 'rxjs';
import { OltRegistryService } from './olt-registry.service';
import { OltBootstrapService } from './olt-bootstrap.service';
import { AlarmIngestService, type ParsedTrapAlarm } from '../alarm/alarm-ingest.service';
import { INDICATION_OBJECT_OID, PARKS_TRAP_MAP, OltInternalEvent } from './parks-trap-mapping';
import { formatOnuSerialNumber } from './onu-serial.util';
import type { TrapLogEntry } from './trap-log.types';

// net-snmp nao publica types; ver node_modules/net-snmp/README.md para o formato
// da notification (pdu.varbinds, pdu.community, rinfo.address).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snmp = require('net-snmp');

const SNMP_TRAP_OID_VARBIND = '1.3.6.1.6.3.1.1.4.1.0';
const LOG_BUFFER_SIZE = 200;

interface Varbind {
  oid: string;
  type: number;
  value: unknown;
}

@Injectable()
export class TrapReceiverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrapReceiverService.name);
  private receiver: { close: (cb?: () => void) => void } | null = null;

  private readonly logSubject = new Subject<TrapLogEntry>();
  private readonly logBuffer: TrapLogEntry[] = [];
  private seqCounter = 0;
  readonly log$ = this.logSubject.asObservable();

  constructor(
    private readonly config: ConfigService,
    private readonly registry: OltRegistryService,
    private readonly alarmIngest: AlarmIngestService,
    private readonly bootstrap: OltBootstrapService,
  ) {}

  onModuleInit() {
    const port = Number(this.config.get('TRAP_PORT') ?? 1162);

    this.receiver = snmp.createReceiver(
      { port, disableAuthorization: true, includeAuthentication: true },
      (error: Error | null, notification: any) => this.handleNotification(error, notification),
    );

    this.logger.log(`Trap receiver SNMP escutando na porta UDP ${port}`);
  }

  onModuleDestroy() {
    this.receiver?.close();
  }

  getRecentLog(): TrapLogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Usado no reconecte do SSE (Last-Event-ID) para so reenviar o que o
   * cliente ainda nao viu, em vez do buffer inteiro - o EventSource do
   * navegador reconecta sozinho quando a conexao cai (timeout de proxy,
   * rede instavel etc.), e sem isso cada reconexao duplicava o historico
   * inteiro na tela.
   */
  getLogSince(seq: number | undefined): TrapLogEntry[] {
    if (seq === undefined) {
      return this.getRecentLog();
    }
    return this.logBuffer.filter((entry) => entry.seq > seq);
  }

  clearLog() {
    this.logBuffer.length = 0;
  }

  private emit(entry: Omit<TrapLogEntry, 'seq'>) {
    const withSeq: TrapLogEntry = { ...entry, seq: ++this.seqCounter };
    this.logBuffer.push(withSeq);
    if (this.logBuffer.length > LOG_BUFFER_SIZE) {
      this.logBuffer.shift();
    }
    this.logSubject.next(withSeq);
  }

  private handleNotification(error: Error | null, notification: any) {
    if (error) {
      this.logger.warn(`Trap descartada: ${error.message}`);
      this.emit({
        timestamp: new Date().toISOString(),
        sourceIp: (error as any).rinfo?.address ?? 'desconhecido',
        outcome: 'REJECTED',
        rejectionReason: 'PACKET_ERROR',
        message: error.message,
        varbinds: [],
      });
      return;
    }

    try {
      this.processNotification(notification);
    } catch (err) {
      this.logger.error(`Falha ao processar trap: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  private processNotification(notification: any) {
    const varbinds: Varbind[] = notification.pdu.varbinds ?? [];
    const sourceIp: string = notification.rinfo.address;
    const community: string = notification.pdu.community ?? '';

    const displayVarbinds = varbinds.map((vb) => ({
      oid: vb.oid,
      value: Buffer.isBuffer(vb.value) ? vb.value.toString('utf8').trim() : String(vb.value),
    }));

    const trapOidVarbind = varbinds.find((vb) => vb.oid === SNMP_TRAP_OID_VARBIND);
    if (!trapOidVarbind) {
      this.logger.debug(`Trap de ${sourceIp} sem snmpTrapOID - ignorada`);
      this.emit({
        timestamp: new Date().toISOString(),
        sourceIp,
        community,
        outcome: 'IGNORED',
        message: 'Pacote sem snmpTrapOID - nao e uma trap valida',
        varbinds: displayVarbinds,
      });
      return;
    }
    const trapOid = String(trapOidVarbind.value);

    const validation = this.registry.validateTrap({ sourceIp, community, oid: trapOid });
    if (!validation.accepted) {
      this.logger.warn(`Trap rejeitada de ${sourceIp} (${validation.rejectionReason}) - oid ${trapOid}`);
      this.emit({
        timestamp: new Date().toISOString(),
        sourceIp,
        community,
        outcome: 'REJECTED',
        trapOid,
        rejectionReason: validation.rejectionReason,
        message:
          validation.rejectionReason === 'NETWORK_NOT_ALLOWED'
            ? `Origem ${sourceIp} fora das redes/IPs autorizados`
            : validation.rejectionReason === 'UNKNOWN_SOURCE_IP'
              ? `Origem ${sourceIp} nao corresponde a nenhuma OLT cadastrada`
              : `Community incorreta para a OLT em ${sourceIp}`,
        varbinds: displayVarbinds,
      });
      return;
    }

    const definition = PARKS_TRAP_MAP[trapOid];
    if (!definition) {
      this.logger.debug(`Trap de OLT conhecida (${sourceIp}) mas OID nao mapeado: ${trapOid}`);
      this.emit({
        timestamp: new Date().toISOString(),
        sourceIp,
        community,
        outcome: 'UNMAPPED',
        trapOid,
        oltId: validation.oltId,
        oltName: validation.oltName,
        message: `OID ${trapOid} nao esta em parks-trap-mapping.ts`,
        varbinds: displayVarbinds,
      });
      return;
    }

    const byOid = new Map(varbinds.map((vb) => [vb.oid, vb.value]));
    const getInt = (oid: string): number | undefined => {
      const raw = byOid.get(oid);
      if (raw === undefined || raw === null) return undefined;
      const n = Number(raw);
      return Number.isNaN(n) ? undefined : n;
    };
    const getString = (oid: string): string | undefined => {
      const raw = byOid.get(oid);
      if (raw === undefined || raw === null) return undefined;
      return Buffer.isBuffer(raw) ? raw.toString('utf8').trim() : String(raw).trim();
    };

    const slotNo =
      getInt(INDICATION_OBJECT_OID.oltAlarmSlotNo) ?? getInt(INDICATION_OBJECT_OID.oltEventSlotNo) ?? 1;
    const portNo =
      getInt(INDICATION_OBJECT_OID.oltAlarmPortNo) ?? getInt(INDICATION_OBJECT_OID.oltEventPortNo);
    const logicalPortNo =
      getInt(INDICATION_OBJECT_OID.oltAlarmLogicalPortNo) ??
      getInt(INDICATION_OBJECT_OID.oltEventLogicalPortNo);
    const serialNumberRaw = getString(INDICATION_OBJECT_OID.oltOnuSerialNumber);
    const serialNumber = serialNumberRaw ? formatOnuSerialNumber(serialNumberRaw) : undefined;
    const conditionRaw = getInt(INDICATION_OBJECT_OID.oltAlarmCondition);
    const condition: 'SET' | 'CLEAR' | undefined = definition.isAlarm
      ? conditionRaw === 0
        ? 'CLEAR'
        : 'SET'
      : undefined;

    const parsed: ParsedTrapAlarm = {
      oltId: validation.oltId!,
      trapOid,
      mibName: definition.mibName,
      description: definition.description,
      event: definition.event,
      severity: definition.severity,
      isAlarm: definition.isAlarm,
      condition,
      slotNo,
      portNo,
      logicalPortNo,
      serialNumber,
    };

    this.emit({
      timestamp: new Date().toISOString(),
      sourceIp,
      community,
      outcome: 'ACCEPTED',
      trapOid,
      mibName: definition.mibName,
      description: definition.description,
      oltId: validation.oltId,
      oltName: validation.oltName,
      severity: definition.severity,
      condition,
      slotNo,
      portNo,
      logicalPortNo,
      serialNumber,
      message: `${definition.description}${condition ? ` (${condition})` : ''} - OLT ${validation.oltName} [${definition.mibName}]`,
      varbinds: displayVarbinds,
    });

    this.alarmIngest
      .ingest(parsed)
      .catch((err) => this.logger.error(`Falha ao gravar alarme: ${err.message}`));

    // pROVISIONED ja traz slot/pon/posicao + serial da ONU - da pra criar o
    // registro dela sem esperar a proxima sincronizacao manual/completa, so
    // faltando um GET pontual do alias (ver OltBootstrapService).
    if (
      parsed.event === OltInternalEvent.OnuProvisioned &&
      parsed.serialNumber &&
      parsed.portNo !== undefined &&
      parsed.logicalPortNo !== undefined
    ) {
      void this.bootstrap
        .upsertOnuFromProvisionedTrap(
          parsed.oltId,
          { slotNo: parsed.slotNo, portNo: parsed.portNo, logicalPortNo: parsed.logicalPortNo },
          parsed.serialNumber,
        )
        .catch((err) => this.logger.error(`Falha ao registrar ONU provisionada: ${err.message}`));
    }

    // Mantem Onu.status em tempo real via trap, sem esperar o proximo
    // "Sincronizar" - so pras traps que efetivamente indicam se a ONU esta
    // operacional ou nao (ver ONU_STATUS_BY_EVENT). Precisa de slot/porta/
    // posicao pra achar a linha (so lOSi traz serial, as demais nao).
    const statusFromTrap = this.resolveOnuStatusFromTrap(parsed);
    if (statusFromTrap && parsed.portNo !== undefined && parsed.logicalPortNo !== undefined) {
      void this.bootstrap
        .updateOnuStatusFromTrap(
          parsed.oltId,
          { slotNo: parsed.slotNo, portNo: parsed.portNo, logicalPortNo: parsed.logicalPortNo },
          statusFromTrap,
        )
        .catch((err) => this.logger.error(`Falha ao atualizar status da ONU via trap: ${err.message}`));
    }
  }

  /**
   * So oNUDNi (ONU down/up, SET/CLEAR) e bLACKLISt tem um significado direto
   * pro status administrativo da ONU (ver OnuStatus) - as demais traps de
   * ONU sao sinal/performance/energia, que nao mudam esse estado por si so.
   */
  private resolveOnuStatusFromTrap(parsed: ParsedTrapAlarm): OnuStatus | null {
    if (parsed.event === OltInternalEvent.OnuDown) {
      return parsed.condition === 'CLEAR' ? OnuStatus.ACTIVE : OnuStatus.INACTIVE;
    }
    if (parsed.event === OltInternalEvent.OnuBlacklisted) {
      return OnuStatus.DISABLE;
    }
    return null;
  }
}
