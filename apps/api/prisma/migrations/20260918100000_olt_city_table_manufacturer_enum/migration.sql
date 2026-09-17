-- CreateEnum
CREATE TYPE "OltManufacturer" AS ENUM ('PARKS', 'HUAWEI', 'ZTE', 'FIBERHOME', 'DATACOM');

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- Backfill: uma linha de City para cada valor distinto ja usado em Olt.city
-- (texto livre antes desta migration), preservando o dado existente.
INSERT INTO "City" ("id", "name", "createdAt")
SELECT gen_random_uuid()::text, DISTINCT_CITY."city", CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "city" FROM "Olt" WHERE "city" IS NOT NULL) AS DISTINCT_CITY("city");

-- AlterTable: adiciona cityId, migra o dado de "city" (texto) via join, remove a coluna antiga.
ALTER TABLE "Olt" ADD COLUMN "cityId" TEXT;

UPDATE "Olt" o
SET "cityId" = c.id
FROM "City" c
WHERE c.name = o."city";

ALTER TABLE "Olt" DROP COLUMN "city";

-- AlterTable: converte manufacturer de texto livre para o enum OltManufacturer,
-- assumindo PARKS para linhas existentes sem valor reconhecido (unico
-- fabricante com parser de traps ate esta migration).
ALTER TABLE "Olt" ADD COLUMN "manufacturerNew" "OltManufacturer";

UPDATE "Olt"
SET "manufacturerNew" = CASE upper(COALESCE("manufacturer", ''))
  WHEN 'PARKS' THEN 'PARKS'::"OltManufacturer"
  WHEN 'HUAWEI' THEN 'HUAWEI'::"OltManufacturer"
  WHEN 'ZTE' THEN 'ZTE'::"OltManufacturer"
  WHEN 'FIBERHOME' THEN 'FIBERHOME'::"OltManufacturer"
  WHEN 'DATACOM' THEN 'DATACOM'::"OltManufacturer"
  ELSE 'PARKS'::"OltManufacturer"
END;

ALTER TABLE "Olt" DROP COLUMN "manufacturer";
ALTER TABLE "Olt" RENAME COLUMN "manufacturerNew" TO "manufacturer";
ALTER TABLE "Olt" ALTER COLUMN "manufacturer" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Olt" ADD CONSTRAINT "Olt_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
