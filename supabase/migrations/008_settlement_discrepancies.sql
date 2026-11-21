-- ============================================================
-- MIGRATION 008 — Traçabilité des écarts de caisse (Settlement Discrepancies)
-- À exécuter dans : Supabase > SQL Editor > Run
-- Migration non destructive et rétrocompatible
-- ============================================================

ALTER TABLE public.courier_settlements
  ADD COLUMN IF NOT EXISTS difference_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difference_reason TEXT;

COMMENT ON COLUMN public.courier_settlements.difference_amount IS
  'Écart constaté entre le montant théorique attendu et le montant réellement reversé (positif ou négatif).';

COMMENT ON COLUMN public.courier_settlements.difference_reason IS
  'Motif explicatif obligatoire en cas d''écart non nul (ex: Monnaie manquante, Course contestée, Perte).';
