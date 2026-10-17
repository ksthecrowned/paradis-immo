-- Spec 11 P0 — fiabilisation : 3 tentatives avec backoff (1 min, 5 min).
-- Tentatives intermédiaires → QUEUED + retryAfter ; 3ᵉ échec → FAILED définitif.
ALTER TABLE "Notification" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
                                   ADD COLUMN     "lastError" TEXT,
                                   ADD COLUMN     "retryAfter" TIMESTAMP(3);

CREATE INDEX "Notification_status_retryAfter_idx" ON "Notification"("status", "retryAfter");
