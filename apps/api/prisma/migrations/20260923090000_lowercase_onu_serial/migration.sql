-- Backfill de dado (sem mudanca de schema): o serial da ONU agora e gravado
-- inteiro em minusculo (ver formatOnuSerialNumber em onu-serial.util.ts) -
-- e assim que a interface da propria Parks mostra/espera o serial, pra dar
-- pra copiar direto daqui e colar no cadastro da ONU na OLT sem converter
-- a caixa manualmente. Sem esse backfill, dado gravado antes dessa mudanca
-- ficaria em maiusculo pra sempre, inconsistente com o que passa a ser
-- salvo dai pra frente.
UPDATE "Onu" SET "serialNumber" = LOWER("serialNumber");
UPDATE "OnuRemoved" SET "serialNumber" = LOWER("serialNumber");
UPDATE "Alarm" SET "serialNumber" = LOWER("serialNumber") WHERE "serialNumber" IS NOT NULL;
