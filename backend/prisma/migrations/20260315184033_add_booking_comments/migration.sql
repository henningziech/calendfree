-- CreateTable
CREATE TABLE "BookingComment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingComment_bookingId_idx" ON "BookingComment"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingComment" ADD CONSTRAINT "BookingComment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingComment" ADD CONSTRAINT "BookingComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
