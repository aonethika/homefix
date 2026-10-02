-- IF NOT EXISTS accommodates existing installations that used prisma db push.
ALTER TABLE "WorkerProfile"
  ADD COLUMN IF NOT EXISTS "profilePhotoKey" TEXT,
  ADD COLUMN IF NOT EXISTS "panDocumentKey" TEXT,
  ADD COLUMN IF NOT EXISTS "faceFrontKey" TEXT,
  ADD COLUMN IF NOT EXISTS "faceLeftKey" TEXT,
  ADD COLUMN IF NOT EXISTS "faceRightKey" TEXT,
  ADD COLUMN IF NOT EXISTS "panVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "faceVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "kycReport" JSONB;

CREATE TABLE IF NOT EXISTS "PendingUpload" (
  "key" TEXT NOT NULL,
  "ownerHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimId" TEXT,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "PendingUpload_claimId_idx" ON "PendingUpload"("claimId");
CREATE INDEX IF NOT EXISTS "PendingUpload_expiresAt_idx" ON "PendingUpload"("expiresAt");
