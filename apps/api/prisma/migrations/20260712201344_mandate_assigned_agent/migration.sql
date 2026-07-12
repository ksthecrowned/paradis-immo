-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "assignedAgentId" TEXT;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
