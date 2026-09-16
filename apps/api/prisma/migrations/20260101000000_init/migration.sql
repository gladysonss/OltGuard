-- CreateEnum
CREATE TYPE "OltBootstrapStatus" AS ENUM ('PENDING', 'WALKING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "OnuStatus" AS ENUM ('UNKNOWN', 'DISCOVERED', 'PROVISIONED', 'ONLINE', 'OFFLINE', 'DOWN', 'BLACKLISTED', 'SIGNAL_DEGRADED');

-- CreateEnum
CREATE TYPE "SignalReadingSource" AS ENUM ('TRAP', 'RECONCILIATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProvisioningJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AlarmSeverity" AS ENUM ('CLEAR', 'INFO', 'WARNING', 'MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlarmCondition" AS ENUM ('ACTIVE', 'CLEARED');

-- CreateEnum
CREATE TYPE "AlarmSource" AS ENUM ('OLT', 'PON_LINK', 'ONU');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "Olt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "snmpCommunity" TEXT NOT NULL,
    "snmpPort" INTEGER NOT NULL DEFAULT 161,
    "sshUsername" TEXT NOT NULL,
    "sshPassword" TEXT NOT NULL,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "bootstrapStatus" "OltBootstrapStatus" NOT NULL DEFAULT 'PENDING',
    "bootstrapLastOid" TEXT,
    "bootstrapStartedAt" TIMESTAMP(3),
    "bootstrapCompletedAt" TIMESTAMP(3),
    "bootstrapError" TEXT,
    "reconciliationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reconciliationIntervalMinutes" INTEGER NOT NULL DEFAULT 180,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Olt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Onu" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "slotNo" INTEGER NOT NULL,
    "portNo" INTEGER NOT NULL,
    "logicalPortNo" INTEGER NOT NULL,
    "status" "OnuStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Onu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalReading" (
    "id" TEXT NOT NULL,
    "onuId" TEXT NOT NULL,
    "rxPowerDbm" DOUBLE PRECISION,
    "txPowerDbm" DOUBLE PRECISION,
    "source" "SignalReadingSource" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningJob" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "onuId" TEXT,
    "action" TEXT NOT NULL,
    "status" "ProvisioningJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProvisioningJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "onuId" TEXT,
    "source" "AlarmSource" NOT NULL,
    "slotNo" INTEGER NOT NULL,
    "portNo" INTEGER,
    "logicalPortNo" INTEGER,
    "trapOid" TEXT NOT NULL,
    "alarmName" TEXT NOT NULL,
    "severity" "AlarmSeverity" NOT NULL,
    "condition" "AlarmCondition" NOT NULL DEFAULT 'ACTIVE',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Olt_ipAddress_key" ON "Olt"("ipAddress");

-- CreateIndex
CREATE INDEX "Onu_oltId_status_idx" ON "Onu"("oltId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Onu_oltId_slotNo_portNo_logicalPortNo_key" ON "Onu"("oltId", "slotNo", "portNo", "logicalPortNo");

-- CreateIndex
CREATE INDEX "SignalReading_onuId_recordedAt_idx" ON "SignalReading"("onuId", "recordedAt");

-- CreateIndex
CREATE INDEX "ProvisioningJob_oltId_status_idx" ON "ProvisioningJob"("oltId", "status");

-- CreateIndex
CREATE INDEX "Alarm_oltId_condition_idx" ON "Alarm"("oltId", "condition");

-- CreateIndex
CREATE INDEX "Alarm_oltId_slotNo_portNo_idx" ON "Alarm"("oltId", "slotNo", "portNo");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Onu" ADD CONSTRAINT "Onu_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalReading" ADD CONSTRAINT "SignalReading_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningJob" ADD CONSTRAINT "ProvisioningJob_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

