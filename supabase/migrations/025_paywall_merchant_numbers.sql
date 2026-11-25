-- ============================================================
-- MIGRATION 025 — Numéros Marchands T-Money & Flooz (Paywall In-App 20 commandes)
-- supabase/migrations/025_paywall_merchant_numbers.sql
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS merchant_tmoney_phone TEXT NOT NULL DEFAULT '+228 90 12 34 56',
  ADD COLUMN IF NOT EXISTS merchant_flooz_phone TEXT NOT NULL DEFAULT '+228 96 12 34 56';

ALTER TABLE public.platform_settings
  ALTER COLUMN free_mvp_max_orders_month SET DEFAULT 20;

UPDATE public.platform_settings
SET
  merchant_tmoney_phone = COALESCE(NULLIF(trim(merchant_tmoney_phone), ''), '+228 90 12 34 56'),
  merchant_flooz_phone = COALESCE(NULLIF(trim(merchant_flooz_phone), ''), '+228 96 12 34 56'),
  free_mvp_max_orders_month = CASE
    WHEN free_mvp_max_orders_month = 30 THEN 20
    ELSE COALESCE(free_mvp_max_orders_month, 20)
  END;
