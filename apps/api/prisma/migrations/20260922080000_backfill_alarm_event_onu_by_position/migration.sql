-- Backfill de dado (sem mudanca de schema): alarmes/eventos que ficaram sem
-- onuId porque foram ingeridos ANTES da Onu correspondente existir na tabela
-- (antes do primeiro "Sincronizar" da OLT, ou antes da trap pROVISIONED
-- criar a ONU, ou antes do fix que passou a vincular por posicao quando a
-- trap nao carrega serial - ver AlarmIngestService.resolveOnu). O vinculo
-- so e resolvido uma vez, no momento da ingestao - sem esse backfill, uma
-- ONU que ja aparece certinho na aba ONUs continuaria sem serial/alias no
-- historico de alarmes/eventos dela pra sempre.
--
-- So atualiza quem esta genuinamente orfao (onuId e removedOnuId ambos
-- NULL) e tem uma Onu com a mesma posicao exata hoje - nao mexe em nada que
-- ja foi resolvido ou ja foi migrado pra OnuRemoved.
UPDATE "Alarm" a
SET "onuId" = o.id
FROM "Onu" o
WHERE a."oltId" = o."oltId"
  AND a."slotNo" = o."slotNo"
  AND a."portNo" = o."portNo"
  AND a."logicalPortNo" = o."logicalPortNo"
  AND a."onuId" IS NULL
  AND a."removedOnuId" IS NULL;

UPDATE "Event" e
SET "onuId" = o.id
FROM "Onu" o
WHERE e."oltId" = o."oltId"
  AND e."slotNo" = o."slotNo"
  AND e."portNo" = o."portNo"
  AND e."logicalPortNo" = o."logicalPortNo"
  AND e."onuId" IS NULL
  AND e."removedOnuId" IS NULL;
