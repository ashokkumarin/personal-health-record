/*
  Warnings:

  - Added the required column `updatedAt` to the `Family` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FamilyMembership` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MedicalRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PatientProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'DEVICE');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('LOGIN', 'LOGOUT', 'REGISTER', 'UPLOAD', 'EDIT', 'DELETE');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('WEB', 'MOBILE', 'API');

-- AlterTable
-- Existing rows have no updatedAt yet — backfill from createdAt (or, for
-- MedicalRecord, uploadedAt) before making the column NOT NULL.
ALTER TABLE "Family" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "Family" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Family" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "FamilyMembership" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "FamilyMembership" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "FamilyMembership" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "MedicalRecord" SET "updatedAt" = "uploadedAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "MedicalRecord" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "PatientProfile" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "PatientProfile" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "User" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "source" "AuditSource" NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "label" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_clientId_key" ON "AuditLog"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_installId_key" ON "Device"("installId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
