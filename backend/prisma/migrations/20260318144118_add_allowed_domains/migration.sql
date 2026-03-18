-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
