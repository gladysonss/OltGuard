import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OltRegistryService } from './olt-registry.service';
import { AlarmIngestService, type ParsedTrapAlarm } from '../alarm/alarm-ingest.service';
import { INDICATION_OBJECT_OID, PARKS_TRAP_MAP } from './parks-trap-mapping';

// net-snmp nao publica types; ver node_modules/net-snmp/README.md para o formato
// da notification (pdu.varbinds, pdu.community, rinfo.address).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snmp = require('net-snmp');

const SNMP_TRAP_OID_VARBIND = '1.3.6.1.6.3.1.1.4.1.0';

interface Varbind {
  oid: string;
  type: number;
  value: unknown;
}

@Injectable()
export class TrapReceiverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrapReceiverService.name);
  private receiver: { close: (cb?: () => void) => void } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly registry: OltRegistryService,
    private readonly alarmIngest: AlarmIngestService,
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

  private handleNotification(error: Error | null, notification: any) {
    if (error) {
      this.logger.warn(`Trap descartada: ${error.message}`);
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

    const trapOidVarbind = varbinds.find((vb) => vb.oid === SNMP_TRAP_OID_VARBIND);
    if (!trapOidVarbind) {
      this.logger.debug(`Trap de ${sourceIp} sem snmpTrapOID - ignorada`);
      return;
    }
    const trapOid = String(trapOidVarbind.value);

    const validation = this.registry.validateTrap({ sourceIp, community, oid: trapOid });
    if (!validation.accepted) {
      this.logger.warn(`Trap rejeitada de ${sourceIp} (${validation.rejectionReason}) - oid ${trapOid}`);
      return;
    }

    const definition = PARKS_TRAP_MAP[trapOid];
    if (!definition) {
      this.logger.debug(`Trap de OLT conhecida (${sourceIp}) mas OID nao mapeado: ${trapOid}`);
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
    const serialNumber = getString(INDICATION_OBJECT_OID.oltOnuSerialNumber);
    const conditionRaw = getInt(INDICATION_OBJECT_OID.oltAlarmCondition);

    const parsed: ParsedTrapAlarm = {
      oltId: validation.oltId!,
      trapOid,
      mibName: definition.mibName,
      severity: definition.severity,
      isAlarm: definition.isAlarm,
      condition: definition.isAlarm ? (conditionRaw === 0 ? 'CLEAR' : 'SET') : undefined,
      slotNo,
      portNo,
      logicalPortNo,
      serialNumber,
    };

    this.alarmIngest
      .ingest(parsed)
      .then((result) => {
        if (result) {
          this.logger.log(`${definition.mibName} (${parsed.condition ?? 'evento'}) - OLT ${parsed.oltId}`);
        }
      })
      .catch((err) => this.logger.error(`Falha ao gravar alarme: ${err.message}`));
  }
}
