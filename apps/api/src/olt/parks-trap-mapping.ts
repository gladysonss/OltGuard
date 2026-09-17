/**
 * Mapeamento de traps SNMP da Parks (GPON-OLT-FAULT.mib) para eventos internos do OltGuard.
 * Fonte: apps/api/mibs/parks/GPON-OLT-FAULT.txt + GPON-OLT-TC.txt (OID raiz e enums).
 *
 * Cobertura: todo NOTIFICATION-TYPE da GPON-OLT-FAULT.mib - inclusive cONFIGRESTRICTION
 * (oltOnuEventIndication.8), que a MIB documenta usando objetos de outra tabela
 * (oltSysMsgSlotNo/PortNo/LogicalPortNo da PARKS-GPON-EXT-MIB), mas que na pratica o
 * firmware manda com os mesmos indicationObjects escalares que todo o resto usa
 * (confirmado com uma trap real recebida em producao).
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
  /**
   * Explicacao em portugues do que o alarme/evento significa na pratica -
   * o nome da MIB sozinho (ex: "lOSi", "dGi") nao diz pra quem esta operando
   * se e ONU desligada, sem sinal, problema de energia etc.
   */
  description: string;
}

function alarmEntry(
  groupOid: string,
  index: number,
  mibName: string,
  severity: ParksTrapDefinition['severity'],
  event: OltInternalEvent,
  description: string,
): [string, ParksTrapDefinition] {
  const oid = `${groupOid}.${index}`;
  return [oid, { mibName, oid, severity, event, isAlarm: true, description }];
}

function eventEntry(
  groupOid: string,
  index: number,
  mibName: string,
  severity: ParksTrapDefinition['severity'],
  event: OltInternalEvent,
  description: string,
): [string, ParksTrapDefinition] {
  const oid = `${groupOid}.${index}`;
  return [oid, { mibName, oid, severity, event, isAlarm: false, description }];
}

/**
 * Todos os traps escalares da GPON-OLT-FAULT.mib. Indexadas pelo OID completo
 * para lookup direto no trap receiver (net-snmp entrega o OID da notification
 * em varbinds[0]).
 */
export const PARKS_TRAP_MAP: Record<string, ParksTrapDefinition> = Object.fromEntries([
  // --- 3.2.1 OLT System Level Alarms ---
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 1, 'dBCORRUPTION', 'critical', OltInternalEvent.OltSystemFault,
    'Banco de dados interno da OLT corrompido - problema grave no proprio equipamento, nao relacionado a ONUs.'),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 2, 'dBMISMATCH', 'critical', OltInternalEvent.OltSystemFault,
    'Inconsistencia no banco de dados interno da OLT - configuracao pode estar dessincronizada.'),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 3, 'mEMALLOCATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault,
    'Falha de alocacao de memoria na OLT - equipamento pode estar sobrecarregado ou com defeito.'),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 4, 'tASKNOTRESPONDING', 'critical', OltInternalEvent.OltSystemFault,
    'Um processo interno da OLT parou de responder - sintoma de travamento do equipamento.'),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 5, 'tASKCREATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault,
    'A OLT nao conseguiu iniciar um processo interno - recurso do sistema esgotado.'),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 6, 'qUEUECREATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault,
    'A OLT nao conseguiu criar uma fila interna - recurso do sistema esgotado.'),
  alarmEntry(TRAP_GROUP_OID.oltSystemAlarmIndication, 7, 'sEMCREATIONFAILURE', 'critical', OltInternalEvent.OltSystemFault,
    'A OLT nao conseguiu criar um semaforo interno - recurso do sistema esgotado.'),

  // --- 3.2.2 OLT System AVC (mudanca de atributo, sem par de limpeza) ---
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 1, 'pRIMARYSTATUS', 'info', OltInternalEvent.OnuStatusChanged,
    'Status operacional da ONU mudou (ex: de inativa pra ativa, ou o contrario) - aviso informativo, nao e alarme.'),
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 2, 'sENSEDTYPE', 'info', OltInternalEvent.OnuStatusChanged,
    'O tipo de equipamento detectado na porta Ethernet da ONU mudou (ex: velocidade/tipo de link do cliente).'),
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 3, 'oNUOPERSTATUS', 'info', OltInternalEvent.OnuStatusChanged,
    'Status operacional da ONU mudou na tabela estendida - aviso informativo, nao e alarme.'),
  eventEntry(TRAP_GROUP_OID.oltSystemAvcIndication, 4, 'oNUACTIVEPORT', 'info', OltInternalEvent.OnuStatusChanged,
    'A porta fisica ativa da ONU mudou (relevante em ONUs com redundancia/protecao de link).'),

  // --- 3.3.1 OLT PON Link Level Alarms ---
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 1, 'lOS', 'critical', OltInternalEvent.PonLinkDown,
    'Perda de sinal na porta PON inteira da OLT (nao numa ONU especifica) - fibra tronco rompida ou modulo optico da OLT com defeito. Afeta todas as ONUs desse PON.'),
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 2, 'tCAPONDSINVALIDPKTS', 'major', OltInternalEvent.PonLinkPerformanceTca,
    'Contador de pacotes invalidos na descida do PON passou do limite configurado - indicio de ruido/degradacao na fibra do tronco.'),
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 3, 'tCAPONDSRXCRCERRORPKTS', 'major', OltInternalEvent.PonLinkPerformanceTca,
    'Contador de erros de CRC na descida do PON passou do limite configurado - indicio de ruido/degradacao na fibra do tronco.'),
  alarmEntry(TRAP_GROUP_OID.oltPonLinkAlarmIndication, 4, 'pONPMCOLLECTIONFAIL', 'major', OltInternalEvent.PonLinkFault,
    'A OLT falhou ao coletar as estatisticas de performance desse PON - problema interno de monitoramento, nao necessariamente de conectividade.'),

  // --- 3.3.2 OLT PON Link Level Events (sem par de limpeza) ---
  eventEntry(TRAP_GROUP_OID.oltPonLinkEventIndication, 1, 'tF', 'critical', OltInternalEvent.PonLinkEvent,
    'O transmissor optico dessa porta PON da OLT falhou - possivel defeito de hardware no modulo optico da propria OLT.'),
  eventEntry(TRAP_GROUP_OID.oltPonLinkEventIndication, 2, 'pROTECTIONSWITCh', 'info', OltInternalEvent.PonLinkEvent,
    'Troca de link de protecao no PON (redundancia) - informativo.'),
  eventEntry(TRAP_GROUP_OID.oltPonLinkEventIndication, 3, 'sETALLONUSTATECOMPLETED', 'info', OltInternalEvent.PonLinkEvent,
    'A OLT terminou de aplicar um comando de estado em todas as ONUs desse PON - informativo, resultado de uma acao administrativa.'),

  // --- 3.4.1 ONU Level Alarms ---
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 1, 'lOSi', 'critical', OltInternalEvent.OnuSignalLoss,
    'ONU sem sinal optico algum (fibra rompida, ONU desligada da tomada de energia, ou conector desconectado/sujo). Diferente de "sinal fraco": aqui nao chega luz nenhuma.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 2, 'sFi', 'critical', OltInternalEvent.OnuSignalFail,
    'Falha de sinal na ONU - sinal chega mas esta ruim demais para o link funcionar (fibra dobrada, conector sujo, atenuacao alta).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 3, 'sDi', 'major', OltInternalEvent.OnuSignalDegrade,
    'Sinal degradado - a ONU continua funcionando, mas a potencia optica esta abaixo do ideal. Vale checar a fibra/conectores antes que piore para perda total.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 4, 'lCDGi', 'major', OltInternalEvent.OnuAlarm,
    'Perda de delineamento de canal GEM - erro de sincronismo no enlace da ONU, geralmente ligado a instabilidade de sinal.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 5, 'rDi', 'minor', OltInternalEvent.OnuAlarm,
    'Erro remoto detectado - a ONU sinalizou um problema no proprio lado dela (nao especifica qual).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 6, 'sUFi', 'critical', OltInternalEvent.OnuAlarm,
    'Falha de inicializacao - a ONU nao conseguiu concluir o processo de ativacao no PON.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 7, 'dFiAlarm', 'critical', OltInternalEvent.OnuAlarm,
    'A ONU nao respondeu corretamente a comandos de desativacao/desabilitacao repetidos da OLT - pode estar travada.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 8, 'lOAi', 'minor', OltInternalEvent.OnuAlarm,
    'Perda de confirmacao (Ack) da ONU em mensagens PLOAM - instabilidade de comunicacao com a ONU.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 9, 'dGi', 'critical', OltInternalEvent.OnuPowerLoss,
    'Dying Gasp: a ONU perdeu energia eletrica e mandou um ultimo aviso antes de desligar. Quase sempre significa falta de luz no cliente (nao e problema de fibra/sinal).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 10, 'lOAMi', 'minor', OltInternalEvent.OnuAlarm,
    'Perda de mensagens PLOAM (protocolo de gerenciamento do PON) com a ONU - instabilidade de comunicacao.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 11, 'mISi', 'major', OltInternalEvent.OnuAlarm,
    'Descasamento de link (Link Mismatch) - a ONU nao bate com a configuracao esperada pela OLT nesse PON/porta.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 12, 'pEEi', 'major', OltInternalEvent.OnuAlarm,
    'Erro de equipamento fisico reportado pela propria ONU - possivel defeito de hardware na ONU.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 13, 'oNUDNi', 'major', OltInternalEvent.OnuDown,
    'ONU esta down (fora de operacao) no link PON - nao esta respondendo, mesmo que o sinal optico exista. Diferente de "sem sinal": aqui a ONU nao esta operacional.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 14, 'eQUIPMENT', 'major', OltInternalEvent.OnuAlarm,
    'Falha de equipamento na ONU - defeito de hardware reportado pelo proprio equipamento do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 15, 'pOWERING', 'major', OltInternalEvent.OnuPowerLoss,
    'Falha de energia na ONU - problema na alimentacao eletrica do equipamento (comum em ONUs com fonte externa/bateria).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 16, 'bATTERYMISSING', 'major', OltInternalEvent.OnuPowerLoss,
    'Bateria de backup ausente na ONU - relevante so em ONUs com backup de energia instalado.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 17, 'bATTERYFAILURE', 'major', OltInternalEvent.OnuPowerLoss,
    'Falha na bateria de backup da ONU.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 18, 'bATTERYLOW', 'major', OltInternalEvent.OnuPowerLoss,
    'Bateria de backup da ONU com carga baixa - se faltar energia agora, o backup pode nao durar.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 19, 'pHYSICALINTRUSION', 'major', OltInternalEvent.OnuAlarm,
    'Intrusao fisica detectada na ONU (gabinete aberto/violado, em modelos com esse sensor).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 20, 'sELFTESTFAILURE', 'major', OltInternalEvent.OnuAlarm,
    'A ONU falhou no autoteste interno - possivel defeito de hardware.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 21, 'dYINGGASP', 'major', OltInternalEvent.OnuPowerLoss,
    'Dying Gasp (variante) - mesmo significado do dGi: a ONU perdeu energia eletrica e avisou antes de desligar. Provavel falta de luz no cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 22, 'vOLTAGERED', 'major', OltInternalEvent.OnuPowerLoss,
    'Tensao de alimentacao da ONU em nivel critico (vermelho) - problema eletrico iminente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 23, 'lANLOS', 'major', OltInternalEvent.OnuLanLoss,
    'Perda de sinal na porta LAN (Ethernet) da ONU - o link optico esta OK, o problema e o cabo/equipamento do cliente do lado de dentro (roteador desligado, cabo de rede solto).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 24, 'eTHPMCOLLECTIONFAILURE', 'major', OltInternalEvent.OnuAlarm,
    'A OLT falhou ao coletar estatisticas de performance da porta Ethernet dessa ONU - problema de monitoramento, nao necessariamente de conectividade do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 25, 'gEMPMCOLLECTIONFAILURE', 'major', OltInternalEvent.OnuAlarm,
    'A OLT falhou ao coletar estatisticas de performance GEM dessa ONU - problema de monitoramento, nao necessariamente de conectividade do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 26, 'tCAONUGEMLOSTPKTS', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de pacotes GEM perdidos da ONU passou do limite configurado - indicio de instabilidade no link dessa ONU.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 27, 'tCAONUGEMMISINSERTEDPKTS', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de pacotes GEM mal inseridos da ONU passou do limite configurado - indicio de instabilidade no link dessa ONU.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 28, 'tCAONUETHFCSERRROR', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de erros de FCS/CRC na porta Ethernet da ONU passou do limite - indicio de cabo/conector ruim do lado do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 29, 'tCAONUETHEXCESSIVECOLLISION', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de colisoes excessivas na porta Ethernet da ONU passou do limite - problema de rede do lado do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 30, 'tCAONUGEMRXPKTS', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de pacotes GEM recebidos da ONU passou do limite configurado (uso/trafego alto).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 31, 'tCAONUGEMRXBLOCKS', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de blocos GEM recebidos da ONU passou do limite configurado (uso/trafego alto).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 32, 'tCAONUGEMTXBLOCKS', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de blocos GEM transmitidos pela ONU passou do limite configurado (uso/trafego alto).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 33, 'tCAONUGEMIMPAIREDBLOCK', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de blocos GEM corrompidos da ONU passou do limite - indicio de instabilidade no link.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 34, 'tCAONUETHLATECOLLISION', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de colisoes tardias na porta Ethernet da ONU passou do limite - problema de rede/cabeamento do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 35, 'tCAONUETHFRAMETOOLONGS', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de quadros Ethernet grandes demais na ONU passou do limite - possivel configuracao de MTU incompativel do lado do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 36, 'tCAONUETHBUFOVERFLOWSRX', 'major', OltInternalEvent.OnuPerformanceTca,
    'Estouro de buffer de recepcao na porta Ethernet da ONU - trafego alto demais para a ONU processar.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 37, 'tCAONUETHBUFOVERFLOWSTX', 'major', OltInternalEvent.OnuPerformanceTca,
    'Estouro de buffer de transmissao na porta Ethernet da ONU - trafego alto demais para a ONU processar.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 38, 'tCAONUETHSINGLECOLLISIONFRAME', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de quadros com colisao unica na porta Ethernet da ONU passou do limite - rede do cliente com colisoes (half-duplex/cabo ruim).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 39, 'tCAONUETHMULTICOLLISIONS', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de quadros com multiplas colisoes na porta Ethernet da ONU passou do limite - rede do cliente com colisoes (half-duplex/cabo ruim).'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 40, 'tCAONUETHSQECOUNT', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de erros SQE na porta Ethernet da ONU passou do limite - problema de baixo nivel na interface Ethernet.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 41, 'tCAONUETHDEFERREDTX', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de transmissoes adiadas na porta Ethernet da ONU passou do limite - rede do cliente congestionada.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 42, 'tCAONUETHINTMACTX', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de erros internos de MAC na transmissao da ONU passou do limite.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 43, 'tCAONUETHCARRIERSENSEERRORCOUNT', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de erros de deteccao de portadora na porta Ethernet da ONU passou do limite - possivel problema fisico na interface.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 44, 'tCAONUETHALIGNERRORCOUNT', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de erros de alinhamento na porta Ethernet da ONU passou do limite - indicio de cabo/conector ruim do lado do cliente.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 45, 'tCAONUETHINTMACRX', 'major', OltInternalEvent.OnuPerformanceTca,
    'Contador de erros internos de MAC na recepcao da ONU passou do limite.'),
  alarmEntry(TRAP_GROUP_OID.oltOnuAlarmIndication, 46, 'pROVFAILURE', 'major', OltInternalEvent.OnuAlarm,
    'Falha ao provisionar/configurar a ONU - o comando de configuracao enviado pela OLT nao foi aplicado com sucesso.'),

  // --- 3.4.2 ONU Level Events (sem par de limpeza) ---
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 1, 'lOFi', 'critical', OltInternalEvent.OnuEvent,
    'Perda de sincronismo de frame da ONU no link PON - instabilidade de sinal/sincronismo pontual.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 2, 'dOWi', 'critical', OltInternalEvent.OnuEvent,
    'Drift de janela de tempo da ONU no PON - instabilidade de sincronismo pontual (delay variando).'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 3, 'dFiEvent', 'critical', OltInternalEvent.OnuEvent,
    'Falha ao desativar a ONU - a OLT tentou desligar/desativar a ONU e nao conseguiu confirmar.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 4, 'mEMi', 'major', OltInternalEvent.OnuEvent,
    'Erro de memoria reportado pela ONU - possivel instabilidade de firmware/hardware do equipamento do cliente.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 5, 'oNUDISCOVERYi', 'info', OltInternalEvent.OnuDiscovered,
    'Uma nova ONU foi descoberta nesse PON (apareceu na rede, ainda nao provisionada) - informativo, nao e problema.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 6, 'bLACKLISt', 'info', OltInternalEvent.OnuBlacklisted,
    'ONU entrou na lista negra (blacklist) - foi bloqueada de se conectar, geralmente por tentativas invalidas repetidas ou acao administrativa.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 7, 'pROVISIONED', 'info', OltInternalEvent.OnuProvisioned,
    'ONU foi provisionada com sucesso - canal OMCI estabelecido, pronta para receber configuracao. Informativo, indica sucesso.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 8, 'cONFIGRESTRICTION', 'minor', OltInternalEvent.OnuEvent,
    'Uma tentativa de configuracao na ONU foi bloqueada por alguma restricao (ex: recurso nao suportado pelo modelo da ONU, ou limite excedido) - nao e falha de sinal/energia, e de configuracao.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 9, 'oNUPROTECTIONSWITCH', 'info', OltInternalEvent.OnuEvent,
    'Troca de protecao (redundancia) da ONU entre portas/slots fisicos - informativo.'),
  eventEntry(TRAP_GROUP_OID.oltOnuEventIndication, 10, 'sETONUSTATECOMPLETED', 'info', OltInternalEvent.OnuEvent,
    'A OLT terminou de aplicar um comando de estado nessa ONU - informativo, resultado de uma acao administrativa.'),
]);
