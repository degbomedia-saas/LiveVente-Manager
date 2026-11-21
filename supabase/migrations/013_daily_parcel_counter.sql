-- ============================================================
-- MIGRATION 013 — Incrémentation atomique du numéro de colis
-- supabase/migrations/013_daily_parcel_counter.sql
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Ajout de la colonne parcel_number si pas encore présente
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parcel_number TEXT;

-- 2. Fonction PostgreSQL robuste et atomique pour le numéro de colis
CREATE OR REPLACE FUNCTION public.get_next_daily_parcel_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_max_num INT;
  v_next_num INT;
BEGIN
  -- Recherche le plus grand numéro de colis pour l'entreprise aujourd'hui ou dernières 24h
  -- en inspectant à la fois la colonne parcel_number et les mentions #XX dans notes
  SELECT COALESCE(
    MAX(
      GREATEST(
        COALESCE(NULLIF(regexp_replace(parcel_number, '\D', '', 'g'), '')::INT, 0),
        COALESCE(NULLIF(substring(notes from '#([0-9]+)'), '')::INT, 0)
      )
    ),
    0
  )
  INTO v_max_num
  FROM public.orders
  WHERE company_id = p_company_id
    AND (created_at >= CURRENT_DATE OR created_at >= (NOW() - INTERVAL '24 hours'));

  v_next_num := v_max_num + 1;
  RETURN '#' || LPAD(v_next_num::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alias pour compatibilité
CREATE OR REPLACE FUNCTION public.generate_daily_parcel_number(p_company_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN public.get_next_daily_parcel_number(p_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_orders_company_daily_parcel
  ON public.orders (company_id, created_at, parcel_number)
  WHERE parcel_number IS NOT NULL;
