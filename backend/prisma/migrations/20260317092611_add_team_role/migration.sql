-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('MEMBER', 'OWNER');

-- AlterTable
ALTER TABLE "TeamMembership" ADD COLUMN     "role" "TeamRole" NOT NULL DEFAULT 'MEMBER';
