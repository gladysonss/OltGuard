/**
 * Mapeamento de traps SNMP da Parks (GPON-OLT-FAULT.mib) para eventos internos do OltGuard.
 * Fonte: apps/api/mibs/parks/GPON-OLT-FAULT.txt + GPON-OLT-TC.txt (OID raiz e enums).
 *
 * Cobertura: todo NOTIFICATION-TYPE da GPON-OLT-FAULT.mib cujos OBJECTS vêm só de
 * indicationObjects (objetos escalares simples, ver INDICATION_OBJECT_OID abaixo).
 * A única exceção é cONFIGRESTRICTION (oltOnuEventIndication.8), que usa objetos de
 * outra tabela (oltSysMsgSlotNo/PortNo/LogicalPortNo, definidos na PARKS-GPON-EXT-MIB)
 * e por isso fica de fora até termos extração própria para ela.
 */

export const OCS_OLT_BASE_OID = '1.3.6.1.4.1.6771.10';
const FAULT_GROUP = `${OCS_OLT_BASE_OID}.3`;
const INDICATION_OBJECTS = `${FAULT_GROUP}.1`;

export const TRAP_GROUP_OID = {
  oltSystemAlarmIndication: `${FAULT_GROUP}.2.1`,
  oltSystemAvcIndication: `${FAULT_GROUP}.2.2`,
  oltPonLinkAlarmIndication: `${FAULT_GROUP}.3.1`,
  oltPonLinkEventIndication: `${FAULT_GROUP}.3.2`,
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
  OnuLanLoss = 'onu.lan.loss',
  /** Alarmes de ONU sem categoria mais especifica (equipamento, PLOAM, intrusao fisica etc). */
  OnuAlarm = 'onu.alarm',
  /** Contadores de performance (TCA) da ONU - GEM/Ethernet. */
  OnuPerformanceTca = 'onu.performance_tca',
  /** Eventos pontuais de ONU sem par de limpeza (perda de frame, drift, protecao). */
  OnuEvent = 'onu.event',
  PonLinkDown = 'pon_link.down',
  /** Falha de coleta de PM no link PON (nao e uma TCA de contador). */
  PonLinkFault = 'pon_link.fault',
  /** Contadores de performance (TCA) do link PON. */
  PonLinkPerformanceTca = 'pon_link.performance_tca',
  /** Eventos pontuais de link PON sem par de limpeza. */
  PonLinkEvent = 'pon_link.event',
  /** Falhas internas do sistema da OLT (DB, memoria, tasks/filas/semaforos do RTOS). */
  OltSystemFault = 'olt.system_fault',
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
   * true para traps dos grupos "Alarm" (oltSystemAlarmIndication,
   * oltPonLinkAlarmIndication, oltOnuAlarmIndication), que carregam
   * oltAlarmCondition (0=clear,1=set) e representam um alarme que pode ser
   * limpo depois. false para traps dos grupos "Event"/"Avc" (sem
   * oltAlarmCondition), que sao pontuais e nao tem par de "limpeza".
   */
  isAlarm: boolean;
}

function alarmEntry(
  groupOid: string,
  index: number,
  mibName: string,
  severity: ParksTrapDefinition['severity'],
  event: OltInternalEvent,
): [string, ParksTrapDefinition] {
  const oid = `${groupOid}.${index}`;
  return [oid, { mibName, oid, severity, event, isAlarm: true }];
}

function eventEntry(
  groupOid: string,
  index: number,
  mibName: string,
  severity: ParksTrapDefinition['severity'],
  event: OltInternalEvent,
): [string, ParksTrapDefinition] {
  const oid = `${groupOid}.${index}`;
  return [oid, { mibName, oid, severity, event, isAlarm: false }];
}

/**
 * Todos os traps escalares da GPON-OLT-FAULT.mib (ver excecao de cONFIGRESTRICTION
 * no comentario do topo do arquivo). Indexadas pelo OID completo para lookup direto
 * no trap receiver (net-snmp entrega o OID da notification em varbinds[0]).
 */
export const PARKS_TRAP_MAP: Record<string, ParksTrapDefinition> = Object.fromEntries([
  // --- 3.2.1 OLT System Level Alarms ---
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 1, 'dBCORRUPTION', 'critical', OltInternalEvent.OltSystemFault),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 2, 'dBMISMATCH', 'critical', OltInternalEvent.OltSystemFault),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 3, 'mEMALLOCATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 4, 'tASKNOTRESPONDING', 'critical', OltInternalEvent.OltSystemFault),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 5, 'tASKCREATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 6, 'qUEUECREATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 7, 'sEMCREATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault),

  // --- 3.2.2 OLT System AVC (mudanca de atributo, sem par de limpeza) ---
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 1, 'pRIMARYSTATUS', 'info', OltInternalEvent.OnuStatusChanged),
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 2, 'sENSEDTYPE', 'info', OltInternalEvent.OnuStatusChanged),
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 3, 'oNUOPERSTATUS', 'info', OltInternalEvent.OnuStatusChanged),
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 4, 'oNUACTIVEPORT', 'info', OltInternalEvent.OnuStatusChanged),

  // --- 3.3.1 OLT PON Link Level Alarms ---
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 1, 'lOS', 'critical', OltInternalEvent.PonLinkDown),
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 2, 'tCAPONDSINVALIDPKTS', 'major', OltInternalEvent.PonLinkPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 3, 'tCAPONDSRXCRCERRORPKTS', 'major', OltInternalEvent.PonLinkPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 4, 'pONPMCOLLECTIONFAIL', 'major', OltInternalEvent.PonLinkFault),

  // --- 3.3.2 OLT PON Link Level Events (sem par de limpeza) ---
  eventEntry(TRAP_GROUP_OID.oltPonLinkEventIndication, 1, 'tF', 'critical', OltInternalEvent.PonLinkEvent),
  eventEntry(TRAP_GROUP_OID.oltPonLinkEventIndication, 2, 'pROTECTIONSWITCh', 'info', OltInternalEvent.PonLinkEvent),
  eventEntry(TRAP_GROUP_OID.oltPonLinkEventIndication, 3, 'sETALLONUSTATECOMPLETED', 'info', OltInternalEvent.PonLinkEvent),

  // --- 3.4.1 ONU Level Alarms ---
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 1, 'lOSi', 'critical', OltInternalEvent.OnuSignalLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 2, 'sFi', 'critical', OltInternalEvent.OnuSignalFail),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 3, 'sDi', 'major', OltInternalEvent.OnuSignalDegrade),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 4, 'lCDGi', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 5, 'rDi', 'minor', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 6, 'sUFi', 'critical', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 7, 'dFiAlarm', 'critical', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 8, 'lOAi', 'minor', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 9, 'dGi', 'critical', OltInternalEvent.OnuPowerLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 10, 'lOAMi', 'minor', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 11, 'mISi', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 12, 'pEEi', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 13, 'oNUDNi', 'major', OltInternalEvent.OnuDown),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 14, 'eQUIPMENT', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 15, 'pOWERING', 'major', OltInternalEvent.OnuPowerLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 16, 'bATTERYMISSING', 'major', OltInternalEvent.OnuPowerLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 17, 'bATTERYFAILURE', 'major', OltInternalEvent.OnuPowerLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 18, 'bATTERYLOW', 'major', OltInternalEvent.OnuPowerLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 19, 'pHYSICALINTRUSION', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 20, 'sELFTESTFAILURE', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 21, 'dYINGGASP', 'major', OltInternalEvent.OnuPowerLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 22, 'vOLTAGERED', 'major', OltInternalEvent.OnuPowerLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 23, 'lANLOS', 'major', OltInternalEvent.OnuLanLoss),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 24, 'eTHPMCOLLECTIONFAILURE', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 25, 'gEMPMCOLLECTIONFAILURE', 'major', OltInternalEvent.OnuAlarm),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 26, 'tCAONUGEMLOSTPKTS', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 27, 'tCAONUGEMMISINSERTEDPKTS', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 28, 'tCAONUETHFCSERRROR', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 29, 'tCAONUETHEXCESSIVECOLLISION', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 30, 'tCAONUGEMRXPKTS', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 31, 'tCAONUGEMRXBLOCKS', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 32, 'tCAONUGEMTXBLOCKS', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 33, 'tCAONUGEMIMPAIREDBLOCK', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 34, 'tCAONUETHLATECOLLISION', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 35, 'tCAONUETHFRAMETOOLONGS', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 36, 'tCAONUETHBUFOVERFLOWSRX', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 37, 'tCAONUETHBUFOVERFLOWSTX', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 38, 'tCAONUETHSINGLECOLLISIONFRAME', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 39, 'tCAONUETHMULTICOLLISIONS', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 40, 'tCAONUETHSQECOUNT', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 41, 'tCAONUETHDEFERREDTX', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 42, 'tCAONUETHINTMACTX', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 43, 'tCAONUETHCARRIERSENSEERRORCOUNT', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 44, 'tCAONUETHALIGNERRORCOUNT', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 45, 'tCAONUETHINTMACRX', 'major', OltInternalEvent.OnuPerformanceTca),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 46, 'pROVFAILURE', 'major', OltInternalEvent.OnuAlarm),

  // --- 3.4.2 ONU Level Events (sem par de limpeza) ---
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 1, 'lOFi', 'critical', OltInternalEvent.OnuEvent),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 2, 'dOWi', 'critical', OltInternalEvent.OnuEvent),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 3, 'dFiEvent', 'critical', OltInternalEvent.OnuEvent),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 4, 'mEMi', 'major', OltInternalEvent.OnuEvent),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 5, 'oNUDISCOVERYi', 'info', OltInternalEvent.OnuDiscovered),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 6, 'bLACKLISt', 'info', OltInternalEvent.OnuBlacklisted),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 7, 'pROVISIONED', 'info', OltInternalEvent.OnuProvisioned),
  // 8 = cONFIGRESTRICTION fica de fora (ver comentario do topo do arquivo)
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 9, 'oNUPROTECTIONSWITCH', 'info', OltInternalEvent.OnuEvent),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 10, 'sETONUSTATECOMPLETED', 'info', OltInternalEvent.OnuEvent),
]);
