-- ============================================================
-- MIGRATION 011 — Coordonnées de contact sur companies
-- ============================================================

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;
