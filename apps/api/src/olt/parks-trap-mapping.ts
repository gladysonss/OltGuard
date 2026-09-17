/**
 * Mapeamento de traps SNMP da Parks (GPON-OLT-FAULT.mib) para eventos internos do OltGuard.
 * Fonte: apps/api/mibs/parks/GPON-OLT-FAULT.txt + GPON-OLT-TC.txt (OID raiz e enums).
 *
 * Escopo: apenas os traps essenciais para status de ONU + alarme de sinal (v1).
 * Traps de TCA de performance (contadores Ethernet/GEM) ficam de fora por enquanto.
 */

export const OCS_OLT_BASE_OID = '1.3.6.1.4.1.6771.10';
const FAULT_GROUP = `${OCS_OLT_BASE_OID}.3`;
const INDICATION_OBJECTS = `${FAULT_GROUP}.1`;

export const TRAP_GROUP_OID = {
  oltSystemAvcIndication: `${FAULT_GROUP}.2.2`,
  oltPonLinkAlarmIndication: `${FAULT_GROUP}.3.1`,
  oltOnuAlarmIndication: `${FAULT_GROUP}.4.1`,
  oltOnuEventIndication: `${FAULT_GROUP}.4.2`,
} as const;

/**
 * OIDs dos objetos carregados como varbinds em cada trap (indicationObjects,
 * ver GPON-OLT-FAULT.txt secao 3.1.1). Usados pelo trap receiver para extrair
 * slot/porta/ONU/severidade/condicao independente da ordem dos varbinds.
 *
 * Sao objetos escalares (nao de tabela), entao o OID que chega no varbind
 * sempre tem o sufixo de instancia ".0" - sem ele o lookup no Map de varbinds
 * nunca bate e o valor vem sempre undefined.
 */
export const INDICATION_OBJECT_OID = {
  oltAlarmSeqNo: `${INDICATION_OBJECTS}.1.0`,
  oltAlarmOccurrenceTime: `${INDICATION_OBJECTS}.2.0`,
  oltAlarmSeverity: `${INDICATION_OBJECTS}.3.0`,
  oltAlarmCondition: `${INDICATION_OBJECTS}.4.0`,
  oltAlarmSlotNo: `${INDICATION_OBJECTS}.5.0`,
  oltAlarmPortNo: `${INDICATION_OBJECTS}.6.0`,
  oltAlarmLogicalPortNo: `${INDICATION_OBJECTS}.7.0`,
  oltAlarmPhysicalPortNo: `${INDICATION_OBJECTS}.8.0`,
  oltEventSeqNo: `${INDICATION_OBJECTS}.9.0`,
  oltEventOccurrenceTime: `${INDICATION_OBJECTS}.10.0`,
  oltEventSlotNo: `${INDICATION_OBJECTS}.11.0`,
  oltEventPortNo: `${INDICATION_OBJECTS}.12.0`,
  oltEventLogicalPortNo: `${INDICATION_OBJECTS}.13.0`,
  oltEventPhysicalPortNo: `${INDICATION_OBJECTS}.14.0`,
  oltOnuSerialNumber: `${INDICATION_OBJECTS}.17.0`,
} as const;

export enum OltInternalEvent {
  OnuDiscovered = 'onu.discovered',
  OnuProvisioned = 'onu.provisioned',
  OnuDown = 'onu.down',
  OnuBlacklisted = 'onu.blacklisted',
  OnuSignalLoss = 'onu.signal.loss',
  OnuSignalFail = 'onu.signal.fail',
  OnuSignalDegrade = 'onu.signal.degrade',
  OnuPowerLoss = 'onu.power_loss',
  OnuStatusChanged = 'onu.status_changed',
  PonLinkDown = 'pon_link.down',
}

export interface ParksTrapDefinition {
  /** Nome do NOTIFICATION-TYPE na MIB original. */
  mibName: string;
  /** OID completo da trap (grupo + índice). */
  oid: string;
  /** Severidade nominal conforme descrição da MIB (informativo, não normativo). */
  severity: 'info' | 'minor' | 'major' | 'critical';
  event: OltInternalEvent;
  /**
   * true para traps dos grupos oltOnuAlarmIndication/oltPonLinkAlarmIndication,
   * que carregam oltAlarmCondition (0=clear,1=set) e representam um alarme que
   * pode ser limpo depois. false para eventos pontuais (discovered, provisioned,
   * mudanca de status) que nao tem par de "limpeza".
   */
  isAlarm: boolean;
}

/**
 * Traps essenciais para o v1. Indexadas pelo OID completo para lookup direto
 * no trap receiver (net-snmp entrega o OID da notification em varbinds[0]).
 */
export const PARKS_TRAP_MAP: Record<string, ParksTrapDefinition> = {
  [`${TRAP_GROUP_OID.oltOnuEventIndication}.5`]: {
    mibName: 'oNUDISCOVERYi',
    oid: `${TRAP_GROUP_OID.oltOnuEventIndication}.5`,
    severity: 'info',
    event: OltInternalEvent.OnuDiscovered,
    isAlarm: false,
  },
  [`${TRAP_GROUP_OID.oltOnuEventIndication}.7`]: {
    mibName: 'pROVISIONED',
    oid: `${TRAP_GROUP_OID.oltOnuEventIndication}.7`,
    severity: 'info',
    event: OltInternalEvent.OnuProvisioned,
    isAlarm: false,
  },
  [`${TRAP_GROUP_OID.oltOnuEventIndication}.6`]: {
    mibName: 'bLACKLISt',
    oid: `${TRAP_GROUP_OID.oltOnuEventIndication}.6`,
    severity: 'info',
    event: OltInternalEvent.OnuBlacklisted,
    isAlarm: false,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.13`]: {
    mibName: 'oNUDNi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.13`,
    severity: 'major',
    event: OltInternalEvent.OnuDown,
    isAlarm: true,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.1`]: {
    mibName: 'lOSi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.1`,
    severity: 'critical',
    event: OltInternalEvent.OnuSignalLoss,
    isAlarm: true,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.2`]: {
    mibName: 'sFi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.2`,
    severity: 'critical',
    event: OltInternalEvent.OnuSignalFail,
    isAlarm: true,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.3`]: {
    mibName: 'sDi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.3`,
    severity: 'major',
    event: OltInternalEvent.OnuSignalDegrade,
    isAlarm: true,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.9`]: {
    mibName: 'dGi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.9`,
    severity: 'critical',
    event: OltInternalEvent.OnuPowerLoss,
    isAlarm: true,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.21`]: {
    mibName: 'dYINGGASP',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.21`,
    severity: 'major',
    event: OltInternalEvent.OnuPowerLoss,
    isAlarm: true,
  },
  [`${TRAP_GROUP_OID.oltSystemAvcIndication}.1`]: {
    mibName: 'pRIMARYSTATUS',
    oid: `${TRAP_GROUP_OID.oltSystemAvcIndication}.1`,
    severity: 'info',
    event: OltInternalEvent.OnuStatusChanged,
    isAlarm: false,
  },
  [`${TRAP_GROUP_OID.oltSystemAvcIndication}.3`]: {
    mibName: 'oNUOPERSTATUS',
    oid: `${TRAP_GROUP_OID.oltSystemAvcIndication}.3`,
    severity: 'info',
    event: OltInternalEvent.OnuStatusChanged,
    isAlarm: false,
  },
  [`${TRAP_GROUP_OID.oltPonLinkAlarmIndication}.1`]: {
    mibName: 'lOS',
    oid: `${TRAP_GROUP_OID.oltPonLinkAlarmIndication}.1`,
    severity: 'critical',
    event: OltInternalEvent.PonLinkDown,
    isAlarm: true,
  },
};
