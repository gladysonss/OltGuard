# OltGuard

Monitoramento de OLTs GPON (hoje Parks, com outros fabricantes antecipados no
cadastro) via traps SNMP. Monorepo com API (NestJS + Prisma/Postgres) e web
(React + Vite), sem workspace tool (cada app tem seu proprio `node_modules`).

## Estrutura

```
apps/api/   NestJS + Prisma (Postgres). Recebe traps SNMP, ingere alarmes/eventos.
apps/web/   React + Vite, estilo inline (sem CSS framework), tema escuro "NOC".
```

## Comandos

```
apps/api: npm run start:dev | npm run build (nest build) | npx prisma migrate deploy | npx prisma generate
apps/web: npm run dev (vite) | npm run build (tsc -b && vite build)
```

Nao ha shadow DB configurado para `prisma migrate dev` neste ambiente - as
migrations sao escritas a mao (ou via `prisma migrate diff` comparando o
schema antigo/novo) e salvas em pastas timestamped sob
`apps/api/prisma/migrations/`, depois aplicadas com `prisma migrate deploy`.

## Pipeline de ingestao de traps

`TrapReceiverService` (net-snmp `createReceiver`, porta `TRAP_PORT`/1162) →
`TrapSecurityService` identifica a OLT por IP + community (via
`OltRegistryService`, que mantem um snapshot em memoria recarregado a cada
cadastro/edicao de OLT ou rede autorizada) → `parks-trap-mapping.ts`
(`PARKS_TRAP_MAP`, indexado pelo OID completo da trap) descreve cada trap →
`AlarmIngestService.ingest()` decide entre:

- **Alarm** (`isAlarm: true`, grupos "Alarm" da MIB): tem `oltAlarmCondition`
  (SET/CLEAR) e representa algo que pode ser resolvido depois - vira uma
  linha com `condition: ACTIVE/CLEARED`, `raisedAt`/`clearedAt`. Resolver um
  alarme (via trap de CLEAR, botao manual ou reconciliacao de ONU removida)
  **so muda `condition`** - a `severity` original (`MINOR`/`MAJOR`/etc) e
  preservada pra sempre, nunca vira `AlarmSeverity.CLEAR`. Quem indica "isso
  ja foi resolvido" e o `condition`, nao a severidade; sobrescrever a
  severidade perderia a informacao de quao grave o problema era quando
  esteve ativo. `AlarmSeverity.CLEAR` como valor de enum so aparece em dado
  historico anterior a essa correcao.
- **Event** (`isAlarm: false`, grupos "Event"/"Avc"): ocorrencia pontual sem
  par de limpeza - cada trap gera uma linha nova, sempre.

Cada `ParksTrapDefinition` tem `{ mibName, oid, severity, event, isAlarm,
description }` - `description` e uma explicacao em portugues do que o
alarme/evento significa na pratica (gravada na linha do Alarm/Event no
momento da ingestao, para nao depender do mapeamento nao mudar depois).

**So a Parks tem parser implementado hoje** - `parks-trap-mapping.ts` e
usado incondicionalmente pelo trap receiver, independente do campo
`Olt.manufacturer`. Multi-vendor (usar `manufacturer` pra escolher o parser
certo) e trabalho futuro, ainda nao implementado.

### Serial da ONU

Vem na trap como `OCTET STRING(SIZE(16))` - 16 chars ASCII hex (4 bytes de
vendor ID + 4 bytes de serie). `formatOnuSerialNumber()`
(`apps/api/src/olt/onu-serial.util.ts`) decodifica os 8 primeiros chars como
ASCII e mantem os ultimos 8 como hex, **tudo em minusculo** (ex:
`tplg2d01ef28`, inclusive o ID do fabricante, que decodifica em maiusculo
por natureza mas e forcado pra minusculo tambem) - e assim que a interface
da propria Parks mostra/espera o serial, entao da pra copiar direto da tela
do OltGuard e colar no cadastro da ONU na OLT sem converter a caixa
manualmente. A migration `20260923090000_lowercase_onu_serial` fez o
backfill do que ja existia em maiusculo (`Onu`/`OnuRemoved`/`Alarm.serialNumber`).
So a trap `lOSi` carrega esse dado hoje (unica trap Alarm cujo payload MIB
inclui `oltOnuSerialNumber`).

O serial e gravado direto em `Alarm.serialNumber`, **nao** via o relaciona-
mento `Alarm.onuId → Onu` - o vinculo relacional (`prisma.onu.findFirst` por
`oltId`+`serialNumber` em `AlarmIngestService.ingest()`) so passou a poder
resolver depois que o bootstrap ganhou o passo de walk de ONUs (ver
"Bootstrap da OLT" abaixo), que e a primeira coisa no projeto a criar linhas
em `Onu` - antes disso a tabela era sempre vazia e `onuId` sempre `null`.
`AlarmsPage.tsx` mostra o serial na descricao do alarme quando presente,
independente desse vinculo.

## Bootstrap da OLT (walk SNMP)

`Olt` tem um ciclo de bootstrap proprio, separado do pipeline de traps
acima: `bootstrapStatus` (`PENDING → WALKING → ACTIVE`/`FAILED`),
`bootstrapLastOid`, `bootstrapStartedAt`/`CompletedAt`/`Error`. Disparado
fire-and-forget (`void this.bootstrap.walkGpons(olt.id)`, nunca `await`ado)
por `OltService.create()` assim que a OLT e cadastrada - o cadastro nao
espera o walk terminar.

`OltBootstrapService.walkGpons()` (nome historico do metodo publico - ja faz
os dois passos abaixo numa sessao SNMP so, ver `snmp-client.util.ts`
`walkSubtree()`/`createSnmpSession()`, SNMPv2c so):

1. **GPONs**: anda `ifName` (IF-MIB::ifXTable, OID `1.3.6.1.2.1.31.1.1.1.1` -
   nome de toda interface da OLT, indexado por `ifIndex`) e filtra so os
   nomes que comecam com `gpon` (case-insensitive - convencao Parks pra
   porta PON, ex: `gpon0/1`; uplink/mgmt sao descartadas). Substitui (delete
   + insert, sem merge incremental) as `GponInterface` (`oltId`, `ifIndex`,
   `ifName`) da OLT.
2. **ONUs**: anda 3 tabelas Parks - alias (`1.3.6.1.4.1.6771.10.1.5.1.62`),
   serial (`...18`) e status (`...5`) - cada uma indexada pelos 3
   ultimos numeros do OID de cada instancia (`slotNo.portNo.logicalPortNo`,
   ex: `...62.1.1.21` = alias da ONU 1/1/21; **sem** um digito extra de
   "numero de coluna" antes dos 3 indices - o equipamento real da Parks nao
   usa o formato convencional de tabela SNMP com coluna, so
   `base.slot.pon.posicao` direto, confirmado com OIDs reais capturados em
   producao). O serial usa o mesmo
   `formatOnuSerialNumber()` das traps (16 hex chars: 4 bytes de vendor ID
   em ASCII + 4 bytes de serie em hex). O status e o inteiro Parks bruto
   (`OnuStatus`: `INVALID`=0 .. `DISABLE`=6, ver `ONU_STATUS_MAP`) - so serve
   de base inicial/fallback, ja que o valor que importa no dia a dia
   ("a ONU esta ativa ou nao") e mantido em tempo real pelas traps (ver
   "Status em tempo real via trap" abaixo), sem esperar o proximo
   "Sincronizar". Faz upsert em `Onu` por `(oltId, slotNo, portNo,
   logicalPortNo)`, so quando ha serial (sem serial nao da pra identificar
   a ONU de forma estavel entre walks). ONUs que sumiram do walk (posicao
   que existia no banco e nao apareceu mais) sao **movidas pra
   `OnuRemoved`**, nao simplesmente apagadas - ver "Remocao de ONU" abaixo.

**Nunca lanca**: qualquer erro (timeout, community errada, etc) vira
`bootstrapStatus: FAILED` + `bootstrapError` com a mensagem, nunca uma
excecao pro caller - e assim que pode ser fire-and-forget com seguranca.
`GET /olts/:id/gpon-interfaces` e `GET /olts/:id/onus` expõem o resultado.
Testado com um agente SNMP mock (`net-snmp` `createAgent`, sem uso em
producao) simulando `ifXTable` e as 3 tabelas de ONU - nao ha script de
teste no repo, foi so verificacao manual.

**Pegadinha ja vivida em producao**: as constantes `ONU_ALIAS_OID`/
`ONU_SERIAL_OID`/`ONU_STATUS_OID` chegaram a ser cadastradas com um
segmento `.1` extra no final (ex: `...62.1` em vez de `...62`), copiando a
estrutura convencional de tabela SNMP (base + numero de coluna + indice).
Isso passava em todos os testes com o agente mock porque o mock usa
`MibProviderType.Table` do `net-snmp`, que insere esse mesmo `.1` de coluna
sozinho - mock e codigo compartilhavam a mesma premissa errada. Contra uma
OLT Parks real (que nao usa esse formato) o walk completava 100% (varbinds
batendo entre as 3 tabelas, sem timeout nem erro, `bootstrapStatus:
ACTIVE`) mas `parseOnuPosition()` via só 2 numeros sobrando em vez de 3 e
descartava toda linha - 0 ONUs salvas, sem nenhum sinal de erro. Corrigido
removendo o `.1` das 3 constantes. `walkOnus()` loga em `debug` a contagem
de varbinds de cada tabela e uma amostra (ate 3) do que cada uma devolveu -
foi assim que o formato real do OID foi confirmado; util de novo se
aparecer um caso parecido com outro equipamento/versao de firmware.

### Criacao incremental de ONU via trap (sem esperar sincronizar)

A trap `pROVISIONED` (`oltOnuEventIndication.7`, `OltInternalEvent.OnuProvisioned`)
ja traz slot/pon/posicao e serial da ONU que acabou de ser provisionada -
`TrapReceiverService` usa isso pra criar/atualizar a `Onu` na hora
(fire-and-forget, ver `bootstrap.upsertOnuFromProvisionedTrap()`), sem esperar o
cliente clicar em "Sincronizar" de novo. Como a trap nao carrega o alias,
esse metodo faz so um `GET` pontual (`snmp-client.util.ts` `getOid()`, sem
andar a tabela inteira) no OID exato dessa ONU. Se o GET falhar, a ONU e
salva mesmo assim sem alias (`status: ACTIVE` por definicao - a trap so
dispara quando o provisionamento deu certo) - o alias fica pra um proximo
walk completo preencher. `ParsedTrapAlarm.event` (o `OltInternalEvent` de
`ParksTrapDefinition`, ate entao nao propagado) foi adicionado especifica-
mente pra dar esse match sem depender do nome cru da MIB (`mibName`).

**Nao ha trap de remocao de ONU nesta MIB** (`GPON-OLT-FAULT.mib`) -
conferido: nenhum `NOTIFICATION-TYPE` dos grupos ONU (`oltOnuAlarmIndication`,
`oltOnuEventIndication`) fala de remover/desregistrar uma ONU. Uma ONU que
sai fisicamente da rede so aparece como "sumiu do walk" - por isso a
deteccao de remocao (ver abaixo) so acontece no walk de reconciliacao, nao
via trap.

### Status em tempo real via trap

`Onu.status` e mantido pelas proprias traps, sem esperar o cliente clicar
em "Sincronizar" - `TrapReceiverService.resolveOnuStatusFromTrap()` mapeia:

- `oNUDNi` (ONU down, alarme com SET/CLEAR) - SET vira `INACTIVE`, CLEAR
  vira `ACTIVE`. E o sinal mais direto de "ONU ativa ou nao" que a MIB tem.
- `bLACKLISt` (ONU entrou em lista negra) - vira `DISABLE`.

Chama `OltBootstrapService.updateOnuStatusFromTrap(oltId, position, status)`
(so `updateMany` por posicao - nao cria ONU nova, so atualiza uma que ja
existe; a maioria dessas traps nao carrega serial, so slot/pon/posicao).
Trap de qualquer outro tipo (sinal, performance, energia etc) nao mexe em
`status` - so os dois casos acima tem correspondencia direta com os valores
de `OnuStatus`. O walk continua sendo a fonte de verdade inicial (primeira
vez que a ONU e vista) e de reconciliacao (recalcula status do zero se por
algum motivo a ONU nunca mandou uma dessas traps).

### Remocao de ONU (OnuRemoved)

Toda vez que o walk completa com sucesso, `reconcileRemovedOnus()` compara
as posicoes (`slotNo.portNo.logicalPortNo`) encontradas com as que ja
existem em `Onu` pra aquela OLT - o que sumiu e considerado removido.
Serial e posicao podem ser reaproveitados depois por outro cliente/ONU
(hardware trocado de lugar, ONU reaproveitada), entao a linha da `Onu` **e
apagada** (nao fica "zumbi" configuravel por engano) e o que ela era vira
um snapshot em `OnuRemoved` (mesmos campos + `removedAt`) - assim da pra
ver "quem esteve nessa posicao antes" sem reinterpretar a linha atual.

Isso roda numa transacao por ONU removida: cria o snapshot em `OnuRemoved`,
fecha (`CLEARED`) qualquer `Alarm` ainda `ACTIVE` dela (nao faz sentido um
alarme ativo pra sempre de uma ONU que nao existe mais), migra todo
`Alarm`/`Event` que apontava pra ela (`onuId` -> `removedOnuId`) e so entao
apaga a `Onu`. Por isso `Alarm.onuId`/`Event.onuId` sao `onDelete: SetNull`
(nao `Cascade` como antes) - o fluxo controlado sempre desvincula antes de
apagar, o `SetNull` e so rede de seguranca se algo apagar a `Onu` direto.

**Rede de seguranca contra falso-positivo de remocao**: se as 3 tabelas
devolverem varbinds (`> 0`) mas nenhum parsear como posicao valida (ver
`parseOnuPosition`), isso e sinal de erro de formato/OID - exatamente o que
ja aconteceu em producao (ver "Pegadinha ja vivida em producao" acima) -
e **nao** de que todas as ONUs sumiram de verdade. Nesse caso
`reconcileRemovedOnus` e pulado (so um `WARN` no log) em vez de mover toda
ONU cadastrada pra `OnuRemoved` por engano. So reconcilia quando o parsing
bateu com pelo menos alguma posicao, ou quando as 3 tabelas vieram
genuinamente vazias (0 varbinds, sem erro).

### Vinculo Alarm/Event -> Onu por posicao, nao so por serial

`AlarmIngestService.resolveOnu()` tenta achar a `Onu` primeiro por serial
(so `lOSi` carrega esse dado) e, se nao achar, cai pra busca por posicao
exata (`oltId, slotNo, portNo, logicalPortNo`) - sem esse fallback, a
maioria das traps de ONU (`oNUDNi`, `sDi`, `lANLOS` etc, que so trazem
posicao) nunca teria `onuId` preenchido, e o botao "Ver alarmes" da aba
ONUs (que filtra por `onuId`) ficaria vazio pra quase todo alarme.

**Esse vinculo so e resolvido uma vez, no momento da ingestao** - se a trap
chegou antes de `Onu` ter aquela posicao (OLT ainda nao tinha sido
sincronizada, ou a ONU ainda nao tinha sido provisionada), `onuId` fica
`null` pra sempre, mesmo que a ONU aparece depois normalmente na aba ONUs.
A migration `20260922080000_backfill_alarm_event_onu_by_position` fez um
backfill unico pra corrigir o que ja existia (so em `Alarm`/`Event` com
`onuId` e `removedOnuId` ambos `NULL`, casando por posicao com a `Onu`
atual) - mas e so pro dado historico ate aquele momento; nao ha
re-resolucao automatica depois disso. Se aparecer de novo (ex: outra OLT
que so foi sincronizada bem depois de comecar a mandar trap), o mesmo tipo
de backfill manual resolve.

`POST /olts/:id/sync-gpons` (botao "Sincronizar" na listagem de OLTs,
`OltListPage.tsx`) refaz o bootstrap inteiro (GPONs + ONUs) sob demanda -
pras OLTs cadastradas antes dessa feature existir (`bootstrapStatus` ainda
`PENDING`, nunca andou automaticamente) ou pra tentar de novo depois de uma
falha. Ao contrario do disparo automatico do `create()`, esse `await`a o
walk inteiro antes de responder (o cliente pediu explicitamente e espera
ver o resultado).

Na arvore de OLTs da tela de Alarmes, cada OLT tem seu proprio chevron de
expandir/minimizar (independente do collapse de cidade) que mostra as
`GponInterface` daquela OLT como sub-itens, buscadas sob demanda (lazy, so
no primeiro expand) e cacheadas em `gponInterfacesByOlt` no estado do
componente - reabrir nao rebusca. Se a OLT ainda nao tem nenhuma GPON,
mostra o motivo baseado em `bootstrapStatus` (nao sincronizada / sincronizando
/ falhou, com a mensagem de erro) em vez de um vazio sem explicacao.

### Selecao de GPON individual (filtro por slot/porta)

Cada GPON na sub-arvore tem checkbox proprio - so aparece quando `ifName`
bate no formato `gpon{slot}/{porta}` (`parseGponName()` em
`AlarmsPage.tsx`; se o nome nao bate nesse padrao, a GPON aparece so como
texto, sem como saber slot/porta). A chave de selecao e
`"{oltId}:{slotNo}:{portNo}"` (`gponKey()`) - guardada em `selectedGponKeys`.

Quando ha alguma GPON selecionada, ela **substitui** a selecao de OLT
inteira no filtro (mais especifica) - o front manda `oltPort` em vez de
`oltId` pra `/alarms`, `/alarms/summary`, `/events` e `/onus`. No backend,
`parseOltPortKeys()` (`apps/api/src/common/olt-port.util.ts`) decodifica
cada chave `"oltId:slotNo:portNo"` e monta um `OR` de `{oltId, slotNo,
portNo}` no `where` do Prisma (`AlarmService.findAll`/`summary`,
`EventService.findAll`, `OnuService.findAll`) - e como da pra combinar
GPONs de OLTs e slots diferentes numa unica selecao, ao contrario de um
filtro `slotNo`/`portNo` de valor unico.

Cada GPON na sub-arvore tambem tem um indicador de severidade (bolinha
colorida, igual o de cada OLT) - vem de `GET /alarms/summary-by-gpon`
(`AlarmService.summaryByGpon()`), que agrupa `Alarm` por `(oltId, slotNo,
portNo)` (so `condition: ACTIVE`, `portNo` nao nulo) e devolve a pior
severidade por chave `"oltId:slotNo:portNo"` - mesmo formato de
`gponKey()`, mesma logica de `summaryByOlt()` (independente de paginacao/
filtro, senao uma GPON sem alarme na pagina atual pareceria "sem
problema"). Agrupa alarme de ONU e de PON-link juntos (os dois tem `portNo`
setado) porque pra quem esta olhando a arvore os dois sao "problema nessa
GPON".

A arvore de OLTs/cidades comeca **fechada** (`collapsedCities` inicializado
com todas as cidades assim que `olts` carrega pela primeira vez -
`initializedCollapseRef` garante que isso so acontece uma vez, senao um
reload periodico reabriria cidades que o usuario tinha fechado de
proposito). Cada OLT dentro de uma cidade tambem comeca fechada
(`expandedOltIds` vazio por padrao) - so mostra as GPONs quando o usuario
clica no chevron.

### Alarmes/eventos de uma ONU especifica (botao "Ver alarmes")

Cada linha da aba ONUs tem um botao "Ver alarmes" (`OnuAlarmsModal` em
`AlarmsPage.tsx`) que abre um modal com toggle **Ativo**/**Historico**,
filtrando so aquela posicao (`?onuId=<id da Onu>`) - de proposito **nao**
cruza por `serialNumber` entre posicoes/clientes diferentes, ja que a aba
ONUs mostra o que esta ativo na OLT agora (ver "Remocao de ONU" acima pra
entender por que serial/posicao podem ser reaproveitados). Ativo busca
`Alarm` com `condition=ACTIVE`; Historico busca `Alarm` (todas condicoes) +
`Event`. `onuId`/`removedOnuId` em `QueryAlarmsDto`/`QueryEventsDto` sao o
filtro mais especifico de todos - quando presente, substitui
`oltPort`/`oltId`/`slotNo`/`portNo` por completo (uma ONU so pertence a uma
posicao).

O painel de filtros da aba Alarmes tambem tem um campo de busca livre "ONU
(serial ou alias)" (`AlarmFilters.onuSearch` -> `QueryAlarmsDto.onuSearch`
em `AlarmService.findAll`) - pra achar os alarmes de uma ONU especifica sem
precisar saber o `onuId` de antemao (diferente do botao "Ver alarmes", que
ja parte de uma ONU escolhida na aba ONUs). Casa "contem" (case-insensitive,
`mode: 'insensitive'`) contra `Alarm.serialNumber` (so preenchido por
`lOSi`) e `onu`/`removedOnu.serialNumber`/`alias` ao mesmo tempo (`OR`
combinado via `AND` com o resto do `where` - precisa ser um `AND` explicito
porque o filtro de `oltPort` ja usa a chave `OR` pra combinar GPONs, e um
segundo `OR` no mesmo objeto sobrescreveria o primeiro em vez de somar).

A aba ONUs tem o mesmo tipo de busca livre, so que direto no topo da tela
(nao dentro de um painel de filtros - a aba ONUs nao tem um) - campo
"Buscar por serial ou alias..." (`onuListSearch` em `AlarmsPage.tsx` ->
`QueryOnusDto.search` em `OnuService.findAll()`). Mesma logica de `AND`
explicito que o filtro de Alarmes, pelo mesmo motivo (`oltPort` ja usa
`OR`).

`GET /alarms` e `GET /events` tambem incluem `onu`/`removedOnu`
(`{id, serialNumber, alias}`) na resposta - usado pela coluna "Cliente
(ONU)" nas duas telas (`onuIdentity()` em `AlarmsPage.tsx`, que prefere
`onu` e cai pra `removedOnu` quando a ONU ja foi removida desde que o
alarme/evento foi registrado). Sem o fallback pra `removedOnu` a coluna
ficaria vazia pra todo alarme historico de uma posicao que ja nao existe
mais na OLT.

`olt` nessas duas respostas tambem inclui `city` (`{id, name}` ou `null`) -
usado pela coluna "Cidade" nas duas telas, ja que o nome da OLT sozinho nao
e unico (pode ter "OLT 01" em cidades diferentes) e a tabela nao mostra a
arvore de contexto que a lateral mostra.

## Modelo de dados (destaques)

- **Alarm**: um por ocorrencia (raised → cleared). Indice unico PARCIAL
  (`COALESCE` nos campos opcionais, Postgres nao aplica unicidade entre
  NULLs) garante no maximo um alarme `ACTIVE` por `(oltId, trapOid, source,
  slotNo, portNo, logicalPortNo)` - existe so na migration
  `20260917070000_alarm_active_dedup` (Prisma Schema DSL nao representa
  indice parcial). Protege contra a corrida find-then-create em
  `AlarmIngestService.raiseOrRefreshAlarm()` quando duas traps de SET quase
  simultaneas colidem (o codigo trata o erro `P2002` como "a outra chamada
  ganhou a corrida, so atualiza").
- **Event**: ocorrencia pontual sem par de limpeza, sem merge/dedup.
- **OnuRemoved**: snapshot de uma `Onu` cuja posicao sumiu de um walk (ver
  "Remocao de ONU" acima) - `Alarm`/`Event` tem `removedOnuId` opcional pra
  guardar o historico dela mesmo depois que a linha de `Onu` e apagada.
  `Alarm.onuId`/`Event.onuId` sao `onDelete: SetNull` (nao `Cascade`) desde
  essa feature - o fluxo de remocao sempre migra pra `removedOnuId` antes
  de apagar a `Onu`.
- **Olt.manufacturer**: enum `OltManufacturer` (`PARKS`, `HUAWEI`, `ZTE`,
  `FIBERHOME`, `DATACOM`) - **obrigatorio**. E um enum fixo (nao cadastravel
  pelo cliente) porque cada fabricante vai exigir um parser de trap proprio
  quando o suporte multi-vendor for implementado; adicionar um fabricante
  novo e mudanca de codigo (schema + migration), nao de dado.
- **Olt.cityId → City**: opcional. `City` (`id`, `name` unico) e cadastrada
  pelo cliente na tela de Configuracoes (`/cities`, CRUD simples via
  `CityController`/`CityService`) e usada como dropdown no cadastro de OLT.
  Remover uma cidade com OLTs vinculadas e bloqueado (`ConflictException`) -
  o cliente precisa trocar a cidade das OLTs antes.
- A arvore de OLTs na tela de Alarmes (`AlarmsPage.tsx`) agrupa por
  `city.name` (ou "Sem cidade"), mostrando `manufacturer` como subtitulo de
  cada OLT. Cada grupo pode ser minimizado (estado local, nao persiste) e
  tem checkbox proprio (selecao multipla de OLTs, com estado indeterminado
  quando so parte das OLTs da cidade esta selecionada) - filtra `Alarm`/
  `Event` por varias OLTs ao mesmo tempo, nao so uma.

## Paginacao e filtro por OLT (alarmes/eventos/ONUs)

`GET /alarms`, `GET /events` e `GET /onus` sao paginados (`page`/`pageSize`,
resposta `{ data, total, page, pageSize }`) - `pageSize` vai ate 500
(`QueryAlarmsDto`/`QueryEventsDto`/`QueryOnusDto`). O filtro de OLT aceita
uma ou varias (`?oltId=abc` ou `?oltId=abc,def`, mesma convencao de
`?severity=A,B`) ou `?oltPort=oltId:slot:porta,...` pra GPON individual (ver
"Selecao de GPON individual" acima - vale pros 3 endpoints). `/alarms` e
`/events` tambem aceitam `?onuId=...`/`?removedOnuId=...`, mais especifico
ainda que `oltPort` (ver "Alarmes/eventos de uma ONU especifica" acima).
`OnuModule` (`apps/api/src/onu/`) e um modulo a parte, nao dentro de
`OltModule` - segue o mesmo padrao de `EventModule` (recurso paginavel e
filtravel tipo log), so que consultando a tabela `Onu` em vez de `Event`.

O indicador de severidade de cada OLT na arvore (`AlarmsPage.tsx`) **nao**
vem da lista paginada/filtrada de alarmes - viria errado assim que a
paginacao ou a selecao de OLT excluisse o alarme mais grave de uma OLT da
pagina atual. Vem de `GET /alarms/summary-by-olt`
(`AlarmService.summaryByOlt()`), que agrupa por `oltId` sem filtro nenhum
(sempre `condition: ACTIVE`, todas as OLTs) e devolve so a pior severidade
de cada uma.

## Frontend

- Sem CSS framework - estilo inline (`React.CSSProperties`) com tema escuro
  via custom properties (`var(--surface)`, `var(--text-muted)`, etc.).
- `AlarmsPage.tsx` tem 3 abas (Alarmes/Eventos/ONUs) que reusam a mesma
  arvore de OLTs/GPONs do menu lateral pra filtrar - so a aba Alarmes tem o
  painel de filtros extra (severidade/slot/porta/data), que nao faz sentido
  pras outras. `onu-status.ts` (`ONU_STATUS_LABEL`/`ONU_STATUS_COLOR_VAR`)
  e o equivalente de `severity.ts` pro status da ONU (ver "Bootstrap da
  OLT" acima pros valores).
- **Atualizacao automatica**: dropdown ao lado do botao "Atualizar"
  (desligado/10s/30s/1min/5min, `autoRefreshSeconds` em `AlarmsPage.tsx`)
  chama `reload()` num `setInterval` enquanto ligado - vale pras 3 abas
  (Alarmes/Eventos/ONUs), ja que `reload()` busca tudo de uma vez
  (`Promise.all`). Persistido em `localStorage`
  (`oltguard_auto_refresh_seconds`) pra nao precisar reconfigurar a cada
  visita, mesmo padrao ja usado pro token de auth (`AuthContext.tsx`).
  `reload()` nao usa `setLoading(true)` no inicio (so `setLoading(false)`
  no fim) - de proposito, senao a tela piscaria "Carregando..." a cada tick
  automatico; `loading` fica reservado pro carregamento inicial da pagina.
- `SEVERITY_ORDER` (`severity.ts`) **nao inclui `CLEAR`** de proposito: e
  usado so no grafico de barras de "alarmes ativos agora" na tela de
  Alarmes, que reflete o estado atual (via `/alarms/summary`, que so conta
  `condition=ACTIVE`). Incluir `CLEAR` faria o grafico virar um contador
  historico que so cresce, nunca um indicador do que esta acontecendo agora.
  `SEVERITY_LABEL`/`SEVERITY_COLOR_VAR` continuam mapeando `CLEAR` so pra
  nao quebrar em dado historico anterior a essa correcao - um alarme
  resolvido hoje mantem a severidade original no badge (ver nota sobre
  `Alarm.severity`/`condition` em "Pipeline de ingestao de traps" acima),
  entao `CLEAR` na pratica nao aparece mais em alarme novo.
- Padrao de tela de configuracao simples (lista + form de adicionar +
  remover): ver `AllowedNetwork` (filtro de rede de traps) e `City` em
  `SettingsPage.tsx` - mesmo padrao serve de referencia para futuras
  entidades cadastraveis pelo cliente.
- O `<aside>` da tela de Alarmes tem dois blocos empilhados com scroll
  independente: a arvore de OLTs (`flex: 1, overflow: auto`) e o grafico de
  severidade "Alarmes" (`flexShrink: 0`, fixo embaixo, fora da area com
  scroll). O `<aside>` em si e `overflow: hidden` - sem isso os dois filhos
  com `overflow: auto` nao conseguem ficar cada um do seu tamanho (o
  `<aside>` tentaria crescer pra caber tudo). Importante manter essa
  estrutura ao mexer na arvore: expandir uma OLT com muitas GPONs nao pode
  empurrar o grafico pra fora da tela nem fazer o menu inteiro rolar junto.

## Convencoes gerais

- Comentarios de codigo em portugues, explicando o "porque" (constraint
  escondida, workaround, coisa que surpreenderia quem le), nunca o "o que".
- Todo texto de UI e mensagem de erro voltado ao usuario e em portugues.
- Migrations do Prisma sao escritas a mao neste projeto (ver acima) - ao
  alterar um campo que ja tem dado em producao/teste, escrever a migration
  preservando o dado existente (ver
  `20260918100000_olt_city_table_manufacturer_enum` como exemplo: cria
  `City` e faz backfill a partir dos valores distintos de texto livre antes
  de trocar o tipo da coluna).
