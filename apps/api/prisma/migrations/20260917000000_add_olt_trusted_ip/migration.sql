-- CreateTable
CREATE TABLE "OltTrustedIp" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OltTrustedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OltTrustedIp_oltId_ipAddress_key" ON "OltTrustedIp"("oltId", "ipAddress");

-- AddForeignKey
ALTER TABLE "OltTrustedIp" ADD CONSTRAINT "OltTrustedIp_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

