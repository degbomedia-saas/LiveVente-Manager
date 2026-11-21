-- ============================================================
-- MIGRATION 010 — Ajout de is_active sur products (archivage logique)
-- ============================================================

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(company_id, is_active);
