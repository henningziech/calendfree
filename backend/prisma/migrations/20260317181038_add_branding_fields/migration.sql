-- AlterTable
ALTER TABLE "BrandingConfig" ADD COLUMN     "backgroundColor" TEXT DEFAULT '#F8FAFC',
ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "showPoweredBy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "textColor" TEXT DEFAULT '#1E293B',
ALTER COLUMN "primaryColor" SET DEFAULT '#0B8ECA',
ALTER COLUMN "accentColor" SET DEFAULT '#14B8A6';
