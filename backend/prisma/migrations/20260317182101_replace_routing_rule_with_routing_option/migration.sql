/*
  Warnings:

  - You are about to drop the `RoutingRule` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `createdByUserId` to the `RoutingForm` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RoutingRule" DROP CONSTRAINT "RoutingRule_routingFormId_fkey";

-- AlterTable
ALTER TABLE "RoutingForm" ADD COLUMN     "collectEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collectName" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fallbackType" TEXT NOT NULL DEFAULT 'MESSAGE',
ADD COLUMN     "fallbackValue" TEXT NOT NULL DEFAULT 'Bitte kontaktieren Sie uns direkt.',
ADD COLUMN     "question" TEXT NOT NULL DEFAULT 'Wofür interessieren Sie sich?';

-- DropTable
DROP TABLE "RoutingRule";

-- CreateTable
CREATE TABLE "RoutingOption" (
    "id" TEXT NOT NULL,
    "routingFormId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoutingOption_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RoutingForm" ADD CONSTRAINT "RoutingForm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingOption" ADD CONSTRAINT "RoutingOption_routingFormId_fkey" FOREIGN KEY ("routingFormId") REFERENCES "RoutingForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
