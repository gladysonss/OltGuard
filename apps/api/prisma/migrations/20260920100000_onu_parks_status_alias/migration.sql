-- A tabela "Onu" nunca e populada por nenhum codigo ate esta migration
-- (confirmado por grep - nenhum "onu.create" no projeto), entao e seguro
-- trocar o enum OnuStatus sem preservar dado nenhum: dropar a coluna e o
-- tipo antigos e recriar com os status exatos que a Parks reporta
-- (oltOnuStatus), em vez do enum generico que nao tinha nenhum codigo
-- mapeando pra ele.
ALTER TABLE "Onu" DROP COLUMN "status";
DROP TYPE "OnuStatus";

CREATE TYPE "OnuStatus" AS ENUM ('INVALID', 'INACTIVE', 'ACTIVATE_PENDING', 'ACTIVE', 'DEACTIVATE_PENDING', 'DISABLE_PENDING', 'DISABLE');

ALTER TABLE "Onu" ADD COLUMN "status" "OnuStatus" NOT NULL DEFAULT 'INACTIVE';

-- AlterTable
ALTER TABLE "Onu" ADD COLUMN "alias" TEXT;
