-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "meetLink" TEXT;

-- CreateTable
CREATE TABLE "NotificationConfig" (
    "id" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "confirmationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "confirmationSubject" TEXT,
    "confirmationBody" TEXT,
    "cancellationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cancellationSubject" TEXT,
    "cancellationBody" TEXT,
    "reminder1Enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder1Timing" TEXT NOT NULL DEFAULT '24h',
    "reminder1Subject" TEXT,
    "reminder1Body" TEXT,
    "reminder2Enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder2Timing" TEXT NOT NULL DEFAULT '1h',
    "reminder2Subject" TEXT,
    "reminder2Body" TEXT,
    "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "followUpTiming" TEXT NOT NULL DEFAULT '30min',
    "followUpSubject" TEXT,
    "followUpBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationConfig_eventTypeId_key" ON "NotificationConfig"("eventTypeId");

-- AddForeignKey
ALTER TABLE "NotificationConfig" ADD CONSTRAINT "NotificationConfig_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
