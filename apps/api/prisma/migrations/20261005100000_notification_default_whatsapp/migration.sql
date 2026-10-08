-- Spec WhatsApp: the default delivery channel for notifications is WhatsApp
-- (Infobip). PUSH remains available as an explicit opt-in from the profile.
ALTER TABLE "User" ALTER COLUMN "notificationChannel" SET DEFAULT 'WHATSAPP';
