-- DropForeignKey
ALTER TABLE "OltTrustedIp" DROP CONSTRAINT "OltTrustedIp_oltId_fkey";

-- DropTable
DROP TABLE "OltTrustedIp";

-- CreateTable
CREATE TABLE "AllowedNetwork" (
    "id" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedNetwork_cidr_key" ON "AllowedNetwork"("cidr");

