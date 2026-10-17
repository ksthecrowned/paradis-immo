-- Spec 11 P0 — état intermédiaire : l'échec transitoire reprogramme l'envoi
-- (retryAfter) tant que les 3 tentatives ne sont pas épuisées.
ALTER TYPE "NotificationStatus" ADD VALUE 'QUEUED';
