-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('AVAILABLE', 'ABSENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "absentUntil" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'AVAILABLE';
