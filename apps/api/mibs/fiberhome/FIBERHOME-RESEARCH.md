# Pesquisa de MIBs de trap - FiberHome

Resumo do que foi encontrado (pesquisa web, sem acesso a uma OLT FiberHome
real) pra viabilizar o parser multi-vendor (ver `Olt.manufacturer` no
schema - `HUAWEI`/`ZTE`/`FIBERHOME`/`DATACOM` ja existem no enum mas nenhum
tem parser implementado, so Parks).

## Diferenca estrutural chave em relacao a Parks

A MIB da Parks (`GPON-OLT-FAULT.mib`) tem um `NOTIFICATION-TYPE` distinto
por alarme/evento (ex: `oltOnuAlarmIndication.13` = `oNUDNi`), cada um com
OID proprio - e assim que `PARKS_TRAP_MAP` funciona (indexado pelo OID
completo da trap).

**A FiberHome NAO funciona assim.** Pelo `AN6000-Series-MIB-User-Manual.pdf`
(manual oficial, capitulo 8 "Alarms"), TODO alarme/evento sai pelo MESMO
mecanismo generico de trap:

- `snmpTrapOID` (`1.3.6.1.6.3.1.1.4.1`, padrao SNMPv2-MIB) - sempre o
  mesmo tipo de OID pra qualquer alarme, nao um por alarme como na Parks.
- `alarmOrEventCode` (`1.3.6.1.4.1.5875.88.4.13`) - um inteiro que
  identifica QUAL alarme/evento e (equivalente ao `mibName` da Parks) -
  **os valores numericos concretos (o que cada codigo significa) nao estao
  documentados em nenhum PDF publico que eu consegui achar** - ver secao
  "O que falta" abaixo.
- `alarmOrEventStatus` (`1.3.6.1.4.1.5875.88.4.6`) - `0` = alarme
  desapareceu (CLEAR), `1` = alarme apareceu (SET). Equivalente ao
  `oltAlarmCondition` da Parks.
- `ifIndex` (`1.3.6.1.2.1.2.2.1.1`) - **um unico inteiro composto**
  codificando slot/porta/ONU/porta-da-ONU por aritmetica, nao 3 objetos
  separados como a Parks (`oltAlarmSlotNo`/`PortNo`/`LogicalPortNo`):

  ```
  ifIndex = slot × 33554432 + porta_PON × 524288 + ONU × 256 + porta_da_ONU
  ```

  (mesma formula usada nas tabelas de alarme ativo/historico pollable via
  SNMP GET, `currentAlarmIfIndex`/`hisAlarmIfIndex` - ver abaixo.)
- `oltCardType`/`oltPortType`/`onuType`/`onuPortType` - tipo do objeto
  alarmado e do pai dele (ints, cujos valores viram nomes na tabela de
  "Port Types"/"Card Types" do Apendice do mesmo manual).
- `detailedInformation` - `Hex-STRING` com detalhes extras (nao documentado
  o formato exato - possivel candidato a carregar serial da ONU em algum
  alarme especifico, precisa confirmar com trap real).

Isso significa que o parser da FiberHome vai precisar de uma logica
diferente da Parks: decodificar `ifIndex` por aritmetica (nao string split
de sufixo de OID) e mapear `alarmOrEventCode` (inteiro) pra
descricao/severidade, em vez de mapear por OID completo.

## Tabelas pollable (alem de trap)

O mesmo capitulo 8 documenta `currentAlarmTable`
(`1.3.6.1.4.1.5875.800.3.60.3`) e `hisAlarmTable`
(`...800.3.60.4`) - permitem consultar alarmes ativos/historicos via SNMP
GET/walk direto, sem depender de trap. Pode valer a pena usar isso pra
reconciliacao periodica (analogo ao que o walk de ONUs ja faz pra Parks),
ja que a FiberHome parece dar mais suporte de primeira classe a polling do
que a Parks.

## O que falta (bloqueador pra implementar o parser)

**A tabela de valores numericos de `alarmOrEventCode` -> nome do
alarme/evento nao foi encontrada em nenhuma fonte publica** durante essa
pesquisa. O que existe:

- `AN5116-06B_Alarm-and-Event-Reference_extracted.txt` (nesta pasta) - texto
  extraido de uma pagina de preview (nao o PDF original) do documento
  oficial "Alarm and Event Reference" (Code: MN000003105) - tem NOMES de
  alarme (`LINK_LOSS`, `LASER_ALWAYS_ON`, `PHYSIC_ID_CONFLICT`,
  `RX_POWER_LOW_ALARM`, `ONU_REGISTER_FAILED`, `ONU_REPLACE_EVENT`, etc),
  nivel (critico/major/minor/prompt), causa provavel e procedimento de
  resolucao - mas **sem o codigo numerico correspondente**, so o nome
  usado no EMS (software de gerenciamento ANM2000) da FiberHome.

Sem essa tabela nome<->codigo, nao da pra montar o equivalente de
`PARKS_TRAP_MAP` pra FiberHome ainda.

## Proximos passos sugeridos

1. **Capturar traps reais de uma OLT FiberHome em producao** (mesma
   metodologia usada pra confirmar o formato real do OID da Parks nesse
   projeto - ver "Pegadinha ja vivida em producao" no CLAUDE.md) - o valor
   de `alarmOrEventCode` capturado ao vivo, cruzado com o alarme que
   apareceu no EMS/na tela da propria OLT no mesmo momento, da o mapeamento
   real sem depender de documentacao incompleta.
2. Se possivel, conseguir o PDF original e completo do "Alarm and Event
   Reference" (Code MN000003105) direto com a FiberHome/revenda - o texto
   extraido aqui e so um preview parcial de terceiros.
3. Confirmar o formato de `detailedInformation` (Hex-STRING) contra uma
   trap real - candidato a carregar serial da ONU nalgum alarme especifico
   (equivalente ao `oltOnuSerialNumber` que so a trap `lOSi` carrega na
   Parks).

## Arquivos nesta pasta

- `FIBERHOME-OLT-COMMON-MIB.mib` - MIB bruta (fonte:
  [LibreNMS](https://github.com/librenms/librenms-mibs/blob/master/FIBERHOME-OLT-COMMON-MIB)) -
  define as tabelas de objeto (incluindo `currentAlarmTable`/
  `hisAlarmTable`), mas **nao tem nenhum `NOTIFICATION-TYPE`** - so
  confirma a estrutura ja descrita acima, sem enum de codigos de alarme.
- `AN6000-Series-MIB-User-Manual.pdf` - manual oficial FiberHome/Intelbras,
  capitulo 8 "Alarms" e a fonte principal da estrutura de trap descrita
  acima.
- `AN5116-06B_Alarm-and-Event-Reference_extracted.txt` - ver nota no topo
  do proprio arquivo (texto de preview, nao o PDF original).
