-- Spec 04 P2 — la mise en demeure est un document de bail généré
-- (`LeaseDocument.type = FORMAL_NOTICE`) consultable dans l'onglet Documents.
ALTER TYPE "LeaseDocumentType" ADD VALUE 'FORMAL_NOTICE';
