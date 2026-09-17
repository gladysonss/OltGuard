-- CreateTable
CREATE TABLE "GponInterface" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "ifIndex" INTEGER NOT NULL,
    "ifName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GponInterface_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GponInterface_oltId_ifIndex_key" ON "GponInterface"("oltId", "ifIndex");

-- AddForeignKey
ALTER TABLE "GponInterface" ADD CONSTRAINT "GponInterface_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
