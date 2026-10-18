-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_rentalRequestId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "rentalRequestId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_propertyId_tenantId_key" ON "Conversation"("propertyId", "tenantId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
