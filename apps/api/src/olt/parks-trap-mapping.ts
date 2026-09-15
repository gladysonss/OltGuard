/**
 * Mapeamento de traps SNMP da Parks (GPON-OLT-FAULT.mib) para eventos internos do OltGuard.
 * Fonte: apps/api/mibs/parks/GPON-OLT-FAULT.txt + GPON-OLT-TC.txt (OID raiz e enums).
 *
 * Escopo: apenas os traps essenciais para status de ONU + alarme de sinal (v1).
 * Traps de TCA de performance (contadores Ethernet/GEM) ficam de fora por enquanto.
 */

export const OCS_OLT_BASE_OID = '1.3.6.1.4.1.6771.10';
const FAULT_GROUP = `${OCS_OLT_BASE_OID}.3`;

export const TRAP_GROUP_OID = {
  oltSystemAvcIndication: `${FAULT_GROUP}.2.2`,
  oltPonLinkAlarmIndication: `${FAULT_GROUP}.3.1`,
  oltOnuAlarmIndication: `${FAULT_GROUP}.4.1`,
  oltOnuEventIndication: `${FAULT_GROUP}.4.2`,
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
  },
  [`${TRAP_GROUP_OID.oltOnuEventIndication}.7`]: {
    mibName: 'pROVISIONED',
    oid: `${TRAP_GROUP_OID.oltOnuEventIndication}.7`,
    severity: 'info',
    event: OltInternalEvent.OnuProvisioned,
  },
  [`${TRAP_GROUP_OID.oltOnuEventIndication}.6`]: {
    mibName: 'bLACKLISt',
    oid: `${TRAP_GROUP_OID.oltOnuEventIndication}.6`,
    severity: 'info',
    event: OltInternalEvent.OnuBlacklisted,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.13`]: {
    mibName: 'oNUDNi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.13`,
    severity: 'major',
    event: OltInternalEvent.OnuDown,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.1`]: {
    mibName: 'lOSi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.1`,
    severity: 'critical',
    event: OltInternalEvent.OnuSignalLoss,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.2`]: {
    mibName: 'sFi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.2`,
    severity: 'critical',
    event: OltInternalEvent.OnuSignalFail,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.3`]: {
    mibName: 'sDi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.3`,
    severity: 'major',
    event: OltInternalEvent.OnuSignalDegrade,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.9`]: {
    mibName: 'dGi',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.9`,
    severity: 'critical',
    event: OltInternalEvent.OnuPowerLoss,
  },
  [`${TRAP_GROUP_OID.oltOnuAlarmIndication}.21`]: {
    mibName: 'dYINGGASP',
    oid: `${TRAP_GROUP_OID.oltOnuAlarmIndication}.21`,
    severity: 'major',
    event: OltInternalEvent.OnuPowerLoss,
  },
  [`${TRAP_GROUP_OID.oltSystemAvcIndication}.3`]: {
    mibName: 'oNUOPERSTATUS',
    oid: `${TRAP_GROUP_OID.oltSystemAvcIndication}.3`,
    severity: 'info',
    event: OltInternalEvent.OnuStatusChanged,
  },
  [`${TRAP_GROUP_OID.oltPonLinkAlarmIndication}.1`]: {
    mibName: 'lOS',
    oid: `${TRAP_GROUP_OID.oltPonLinkAlarmIndication}.1`,
    severity: 'critical',
    event: OltInternalEvent.PonLinkDown,
  },
};
