-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('PERSONAL', 'TEAM', 'GROUP');

-- AlterTable
ALTER TABLE "EventType" ADD COLUMN     "eventCategory" "EventCategory" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "maxInvitees" INTEGER,
ADD COLUMN     "showRemainingSpots" BOOLEAN NOT NULL DEFAULT false;
