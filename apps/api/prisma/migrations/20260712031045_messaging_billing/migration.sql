-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP_OTP', 'SMS_ALERT');

-- CreateEnum
CREATE TYPE "MessagePayerType" AS ENUM ('USER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "MessageChargeStatus" AS ENUM ('FREE', 'OPEN', 'SETTLED', 'WAIVED');

-- AlterEnum
ALTER TYPE "AllocatableType" ADD VALUE 'MESSAGING_DEBT';

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'SMS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationChannel" "NotificationChannel" NOT NULL DEFAULT 'PUSH';

-- CreateTable
CREATE TABLE "MessageCharge" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "payerType" "MessagePayerType" NOT NULL,
    "payerId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingMonth" TEXT NOT NULL,
    "unitUsd" DECIMAL(12,6) NOT NULL,
    "fxRate" DECIMAL(12,4) NOT NULL,
    "amountXaf" INTEGER NOT NULL,
    "status" "MessageChargeStatus" NOT NULL,
    "settledPaymentId" TEXT,
    "providerMessageId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageCharge_idempotencyKey_key" ON "MessageCharge"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MessageCharge_payerType_payerId_status_idx" ON "MessageCharge"("payerType", "payerId", "status");

-- CreateIndex
CREATE INDEX "MessageCharge_userId_channel_billingMonth_idx" ON "MessageCharge"("userId", "channel", "billingMonth");

-- CreateIndex
CREATE INDEX "MessageCharge_billingMonth_idx" ON "MessageCharge"("billingMonth");

-- AddForeignKey
ALTER TABLE "MessageCharge" ADD CONSTRAINT "MessageCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCharge" ADD CONSTRAINT "MessageCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCharge" ADD CONSTRAINT "MessageCharge_settledPaymentId_fkey" FOREIGN KEY ("settledPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
