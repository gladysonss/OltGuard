# Pesquisa de traps/alarmes - FiberHome

Resumo do que foi encontrado (pesquisa web + captura real de pacotes com o
cliente, sem acesso direto a uma OLT/UNM FiberHome) pra viabilizar o
parser multi-vendor (ver `Olt.manufacturer` no schema - `HUAWEI`/`ZTE`/
`FIBERHOME`/`DATACOM` ja existem no enum mas nenhum parser implementado
ainda, so Parks).

## Conclusao principal (24/09): SNMP trap NAO e o canal certo pra FiberHome

Depois de analisar 8+ capturas reais de trap de uma OLT FiberHome em
producao (community "adsl", destino configurado pelo cliente), ficou claro
que **o SNMP trap dessa OLT nao carrega alarme nenhum** - ela so manda um
relatorio generico e periodico (OID fixo `1.3.6.1.4.1.5875.88.5.888`,
"privFormat" segundo o manual oficial), repetindo o mesmo conteudo (as
vezes byte-a-byte identico por dias) num intervalo de ~10-30s. Decodificado
via BER/ASN.1 bruto (nao so o resumo do tcpdump) pra confirmar tipo de
cada campo - ver `decode_ber.py` no historico da sessao (nao versionado
ainda, so usado pra depuracao pontual).

**O motivo real**: a arquitetura da FiberHome pra esse tipo de OLT nao usa
SNMP trap como canal principal de alarme. O fluxo real e:

```
OLT <--protocolo interno proprietario--> ANM2000/UNM2000 (EMS da FiberHome)
                                              |
                                              +--> TL1 (northbound, TCP porta 3337) --> OSS/NMS terceiros (ex: OltGuard)
                                              +--> SNMP (monitoramento basico/generico - e o que capturamos)
```

O SNMP trap que a OLT manda pro nosso coletor e so um recurso de
monitoramento basico da OLT em si - **nao e o canal de alarme "de
verdade"**. O canal oficial pra sistema de terceiro receber alarme
detalhado e o **TL1** (Transaction Language 1, protocolo texto orientado a
sessao, padrao Telcordia usado por varios fabricantes), falando
**com o servidor ANM2000/UNM2000**, no **nao** com a OLT diretamente.
Confirmado no manual oficial "FiberHome Element Management System
Northbound Interface (TL1) User Manual" (salvo nesta pasta) e batendo com
como integradores brasileiros de ISP (IXC, Voalle, Hubsoft) documentam a
integracao com FiberHome.

## Como o TL1 funciona (resumo do manual)

1. **Conexao**: TCP no servidor ANM2000/UNM2000 (nao na OLT), porta
   **3337** por padrao. Precisa do servico `EMS-TL1-SERVER` ativo no
   servidor onde o ANM/UNM esta instalado.
2. **Login**: `LOGIN:::CTAG::UN=usuario,PWD=senha;` - **usuario/senha TL1
   sao alocados exclusivamente pelo EMS da FiberHome pro cliente**, nao e
   a mesma credencial de acesso a interface web/CLI. Precisa pedir/gerar
   isso no ANM/UNM do cliente antes de qualquer coisa.
3. **Assinatura de alarme em tempo real**: `SUBSCRIBE:::CTAG::;` - depois
   disso o EMS empurra os alarmes automaticamente na mesma conexao TCP,
   em tempo real (nao e polling).
4. Tambem existem comandos de consulta pontual (`QUERY-ALARM`,
   `LST-ALARM`), confirmacao (`ACK-ALARM`) e limpeza (`CLR-ALARM`) -
   Capitulo 6.9 e 8 do manual.

Isso significa: o parser multi-vendor da FiberHome **nao vai ser um
receptor SNMP** (como `TrapReceiverService` e hoje pra Parks) - vai ser um
**cliente TCP/TL1** (protocolo texto, sessao com login, nao UDP
fire-and-forget). Arquitetura bem diferente, precisa de modulo proprio.

## A tabela de alarmes (o que faltava desde a pesquisa anterior)

O Capitulo 11 ("The List of Alarms") do manual TL1 tem a tabela completa e
oficial: **Alarm Type, Alarm Level, Alarm ID (numerico), Alarm Name, Alarm
Reason** - exatamente o que faltava pra montar o equivalente do
`PARKS_TRAP_MAP`. Extraida integralmente em
`TL1-Alarm-List-extracted.txt` nesta pasta. Alguns destaques relevantes
pra ONU (lista "Alarm definition list (OLT)", ja que e a OLT que reporta
alarme de ONU, igual a Parks):

| Alarm ID | Alarm Name | Nivel | Equivalente Parks |
|---|---|---|---|
| 110004 | ILEGAL_ONU_REGISTE | Major | - (ONU invalida tentando registrar) |
| 110008 | ONU_Power_Fail | Critical | `dGi`/`dYINGGASP` (falta de energia na ONU) |
| 310003 | NO_OPTICS_SIGNAL (uplink port) | Critical | - (nivel OLT, nao ONU) |
| 310005 | ONU_OFF_LINE | Critical | `oNUDNi` (ONU down) |
| 310009 | RX_POWER_ALARM (OLT PON port) | Major | `sDi`/sinal degradado |
| 310011 | ONU_Uplink_Error-Frame_Too_Many | Major | - |

Ha tambem uma "Alarm definition list (FTTB ONU)" (alarmes da propria ONU
como NE gerenciavel - CPU/temperatura/bateria) e uma "Alarm definition
list (EMS)" (saude do proprio servidor de gerencia) - ambas tambem
extraidas no arquivo.

**Ainda nao confirmado com dado real**: o formato exato da mensagem
autonoma TL1 que carrega um alarme de verdade (o manual mostra o formato
de resposta de comando tipo `SUBSCRIBE`, mas nao um exemplo completo de
alarme chegando via `REPT ALM` com todos os campos - severidade, ONU
serial/posicao etc). Isso so da pra confirmar com uma sessao TL1 real
(`SUBSCRIBE` numa OLT que realmente tenha um evento acontecendo).

## Proximos passos

1. **Pedir ao cliente usuario/senha TL1** do ANM2000/UNM2000 dele (contato
   com a FiberHome/revenda, ou verificar se ja existe uma credencial
   dedicada pra integracao - alguns integradores brasileiros ja tem isso
   documentado nas wikis deles, ver fontes abaixo).
2. Com a credencial em maos, testar uma sessao TL1 manual (`telnet`/`nc`
   na porta 3337, ou um script simples) - `LOGIN` + `SUBSCRIBE` - e
   provocar um alarme real (desconectar ONU) pra capturar o formato exato
   da mensagem autonoma de alarme.
3. So depois disso da pra desenhar o modulo TL1 (`TrapReceiverService`
   equivalente, mas TCP client com sessao/login em vez de UDP listener) e
   o mapeamento `Alarm ID -> descricao/severidade` (baseado na tabela do
   Capitulo 11, ja extraida).
4. Decidir se vale in paralelo manter um fallback de reconciliacao via
   SNMP GET nas tabelas `currentAlarmTable`/`hisAlarmTable`
   (`1.3.6.1.4.1.5875.800.3.60.3`/`.60.4`, ver secao antiga abaixo) usando
   o campo `Olt.reconciliationIntervalMinutes` que ja existe no schema mas
   nunca foi ligado a nenhum job - baixo custo pro equipamento (poll
   esporadico, nao continuo), mas ainda sofre do mesmo problema de nao ter
   os nomes/severidades documentados por esse canal (a tabela do TL1 e
   estruturada pelo `Alarm ID`, nao necessariamente o mesmo `alarmOrEventCode`
   que aparece na tabela SNMP - precisa confirmar se os IDs batem).

## Historico da investigacao SNMP (mantido por referencia)

A investigacao anterior (documentada abaixo) partiu do pressuposto de que
o SNMP trap seria o canal de alarme, igual a Parks. Ficou provado que
**nao e** pra esse tipo de instalacao/modelo - mas o levantamento da
estrutura SNMP (indication objects, `ifIndex` composto por aritmetica,
`alarmOrEventCode`/`alarmOrEventStatus`) continua util caso outra OLT
FiberHome do cliente esteja configurada de outro jeito (sem UNM no meio,
falando SNMP direto) - vale conferir o IP de origem da trap antes de
assumir que e sempre via UNM.

### Diferenca estrutural em relacao a Parks (canal SNMP)

A MIB da Parks (`GPON-OLT-FAULT.mib`) tem um `NOTIFICATION-TYPE` distinto
por alarme/evento (ex: `oltOnuAlarmIndication.13` = `oNUDNi`), cada um com
OID proprio. A trap SNMP que a FiberHome manda (capturada em producao) usa
um unico OID fixo (`...88.5.888`) com indication objects genericos
(`alarmOrEventCode`/`alarmOrEventStatus`/`ifIndex` composto por aritmetica
`slot × 33554432 + pon × 524288 + onu × 256 + porta`) - mas na pratica,
pra essa instalacao, esse canal so carrega um relatorio de status/PM
periodico, nao alarme de fato (ver conclusao principal acima).

### O que falta nesse canal (se algum dia for usado)

A tabela de valores numericos de `alarmOrEventCode` (SNMP) nao foi
encontrada em nenhuma fonte publica - so a tabela de `Alarm ID` do TL1
(que pode ou nao usar a mesma numeracao).

## Arquivos nesta pasta

- `FIBERHOME-OLT-COMMON-MIB.mib` - MIB bruta (fonte:
  [LibreNMS](https://github.com/librenms/librenms-mibs/blob/master/FIBERHOME-OLT-COMMON-MIB)) -
  define as tabelas de objeto SNMP (incluindo `currentAlarmTable`/
  `hisAlarmTable`), sem nenhum `NOTIFICATION-TYPE`.
- `AN6000-Series-MIB-User-Manual.pdf` - manual oficial FiberHome/Intelbras,
  capitulo 8 "Alarms" - estrutura do trap SNMP generico (ver acima, canal
  que se mostrou nao ser o de alarme real nessa instalacao).
- `AN5116-06B_Alarm-and-Event-Reference_extracted.txt` - texto de preview
  de terceiros (nao o PDF original) com nomes/niveis/causas de alarme no
  estilo do EMS local (ANM2000) - complementa a tabela do TL1.
- **`TL1-Northbound-Interface-User-Manual.pdf`** - manual oficial da
  interface TL1 (fonte principal da conclusao acima) - login, subscribe,
  query/ack/clear de alarme, e a tabela completa de alarmes (Capitulo 11).
- **`TL1-Alarm-List-extracted.txt`** - Capitulo 11 do manual acima extraido
  em texto puro (Alarm Type/Level/ID/Name/Reason) - a fonte pra montar o
  mapeamento de alarme quando o modulo TL1 for implementado.
