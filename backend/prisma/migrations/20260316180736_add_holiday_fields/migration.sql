-- AlterTable
ALTER TABLE "AvailabilityConfig" ADD COLUMN     "blockedHolidays" JSONB,
ADD COLUMN     "holidayCountry" TEXT DEFAULT 'de';
