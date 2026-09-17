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
  linha com `condition: ACTIVE/CLEARED`, `raisedAt`/`clearedAt`.
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
ASCII e mantem os ultimos 8 como hex maiusculo (ex: `TPLG2D01EF28`). So a
trap `lOSi` carrega esse dado hoje (unica trap Alarm cujo payload MIB inclui
`oltOnuSerialNumber`).

O serial e gravado direto em `Alarm.serialNumber`, **nao** via o relaciona-
mento `Alarm.onuId → Onu` - a tabela `Onu` nunca e populada por nenhum
codigo hoje (nenhum `onu.create` no projeto), entao esse vinculo relacional
sempre resolve `null` na pratica. `AlarmsPage.tsx` mostra o serial na
descricao do alarme quando presente.

## Bootstrap da OLT (walk SNMP)

`Olt` tem um ciclo de bootstrap proprio, separado do pipeline de traps
acima: `bootstrapStatus` (`PENDING → WALKING → ACTIVE`/`FAILED`),
`bootstrapLastOid`, `bootstrapStartedAt`/`CompletedAt`/`Error`. Disparado
fire-and-forget (`void this.bootstrap.walkGpons(olt.id)`, nunca `await`ado)
por `OltService.create()` assim que a OLT e cadastrada - o cadastro nao
espera o walk terminar.

`OltBootstrapService.walkGpons()` (passo 1 do bootstrap, mais passos vem
depois - mapear slot/porta de cada GPON, andar pelas ONUs de cada uma):
anda `ifName` (IF-MIB::ifXTable, OID `1.3.6.1.2.1.31.1.1.1.1` - retorna o
nome de toda interface da OLT, indexado por `ifIndex`) via
`walkSubtree()`/`createSnmpSession()` (`snmp-client.util.ts`, wrapper fino
sobre `net-snmp` `session.subtree()`, SNMPv2c so) e filtra so os nomes que
comecam com `gpon` (case-insensitive - convencao Parks pra porta PON, ex:
`gpon0/1`; outras interfaces como uplink/mgmt sao descartadas). O resultado
substitui (delete + insert, sem merge incremental ainda) as linhas de
`GponInterface` (`oltId`, `ifIndex`, `ifName`) daquela OLT.

**Nunca lanca**: qualquer erro (timeout, community errada, etc) vira
`bootstrapStatus: FAILED` + `bootstrapError` com a mensagem, nunca uma
excecao pro caller - e assim que pode ser fire-and-forget com seguranca.
`GET /olts/:id/gpon-interfaces` expõe o resultado. Testado com um agente
SNMP mock (`net-snmp` `createAgent`, sem uso em producao) simulando
`ifXTable` - nao ha script de teste no repo, foi so verificacao manual.

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

## Paginacao e filtro por OLT (alarmes/eventos)

`GET /alarms` e `GET /events` sao paginados (`page`/`pageSize`, resposta
`{ data, total, page, pageSize }`) - `pageSize` vai ate 500
(`QueryAlarmsDto`/`QueryEventsDto`). O filtro de OLT aceita uma ou varias
(`?oltId=abc` ou `?oltId=abc,def`, mesma convencao de `?severity=A,B`).

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
- `SEVERITY_ORDER` (`severity.ts`) **nao inclui `CLEAR`** de proposito: e
  usado so no grafico de barras de "alarmes ativos agora" na tela de
  Alarmes, que reflete o estado atual (via `/alarms/summary`, que so conta
  `condition=ACTIVE`). Incluir `CLEAR` faria o grafico virar um contador
  historico que so cresce, nunca um indicador do que esta acontecendo agora.
  `SEVERITY_LABEL`/`SEVERITY_COLOR_VAR` continuam mapeando `CLEAR` (usado
  em badges de alarme resolvido fora do grafico).
- Padrao de tela de configuracao simples (lista + form de adicionar +
  remover): ver `AllowedNetwork` (filtro de rede de traps) e `City` em
  `SettingsPage.tsx` - mesmo padrao serve de referencia para futuras
  entidades cadastraveis pelo cliente.

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
