-- Spec 04 — la caution est une échéance spéciale (`RentSchedule.kind = DEPOSIT`)
-- due le jour de l'emménagement, donc à la même date que la première ligne de
-- loyer. L'unicité passe de (leaseId, dueDate) à (leaseId, dueDate, kind).
DROP INDEX "RentSchedule_leaseId_dueDate_key";

CREATE UNIQUE INDEX "RentSchedule_leaseId_dueDate_kind_key" ON "RentSchedule"("leaseId", "dueDate", "kind");
