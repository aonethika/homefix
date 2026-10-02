ALTER TABLE "ServiceRequest" ADD COLUMN "bookingStage" TEXT, ADD COLUMN "expiresAt" TIMESTAMP(3), ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "ServiceRequest_bookingStage_expiresAt_idx" ON "ServiceRequest"("bookingStage", "expiresAt");
