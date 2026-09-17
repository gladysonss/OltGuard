-- Dedup: uma corrida no AlarmIngestService (find-then-create sem trava) podia
-- criar mais de um alarme ACTIVE para o mesmo (oltId, trapOid, source, slotNo,
-- portNo, logicalPortNo) quando duas traps de SET quase simultaneas para o
-- mesmo problema chegavam antes da primeira terminar de gravar. Pra cada grupo
-- duplicado, mantem so o mais recente como ACTIVE e move os demais pro
-- historico (CLEARED), antes de criar o indice que impede isso de acontecer de novo.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "oltId", "trapOid", "source", "slotNo", COALESCE("portNo", -1), COALESCE("logicalPortNo", -1)
           ORDER BY "raisedAt" DESC
         ) AS rn
  FROM "Alarm"
  WHERE "condition" = 'ACTIVE'
)
UPDATE "Alarm"
SET "condition" = 'CLEARED', "severity" = 'CLEAR', "clearedAt" = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- So um alarme ACTIVE por (oltId, trapOid, source, slotNo, portNo, logicalPortNo)
-- dai em diante. COALESCE nos campos opcionais porque Postgres nao aplica
-- unicidade entre NULLs (cada NULL conta como distinto num indice unico comum).
CREATE UNIQUE INDEX "Alarm_active_dedup_idx" ON "Alarm" (
  "oltId", "trapOid", "source", "slotNo", COALESCE("portNo", -1), COALESCE("logicalPortNo", -1)
) WHERE "condition" = 'ACTIVE';
