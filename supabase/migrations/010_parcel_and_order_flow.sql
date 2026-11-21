-- ============================================================
-- MIGRATION 010 (ou suite) — Numéro de colis journalier & Cycle de commande
-- supabase/migrations/010_parcel_and_order_flow.sql
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Ajout de la colonne parcel_number sur la table orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parcel_number TEXT;

COMMENT ON COLUMN public.orders.parcel_number IS
  'Numéro séquentiel de colis du jour (ex: #01, #02), réinitialisé chaque jour par boutique.';

-- 2. Mise à jour de l'énumération public.order_status
-- PostgreSQL permet d'ajouter des valeurs à un enum via ALTER TYPE ... ADD VALUE IF NOT EXISTS
DO $$
BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'packed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'assigned';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Sécurisation au cas où une contrainte CHECK existe sur orders.status
DO $$
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
    CHECK (status::text IN ('pending_confirmation', 'confirmed', 'packed', 'assigned', 'in_transit', 'delivered', 'cancelled', 'pending', 'preparing', 'shipped'));
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Fonction pour générer le prochain numéro de colis du jour pour une boutique donnée
-- Ex: '#01', '#02', '#03'...
CREATE OR REPLACE FUNCTION public.generate_daily_parcel_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_next_num    INTEGER;
  v_formatted   TEXT;
BEGIN
  -- Début de la journée actuelle en heure UTC / locale
  v_today_start := date_trunc('day', NOW());

  -- Compter le nombre de colis déjà attribués aujourd'hui pour cette boutique ayant un parcel_number
  -- ou récupérer le max pour éviter tout doublon
  SELECT COALESCE(COUNT(*), 0) + 1
  INTO v_next_num
  FROM public.orders
  WHERE company_id = p_company_id
    AND created_at >= v_today_start
    AND parcel_number IS NOT NULL;

  -- Formater avec au minimum 2 chiffres : #01, #02... ou plus si >= 100 (#100)
  v_formatted := '#' || lpad(v_next_num::text, 2, '0');

  -- S'assurer de l'unicité stricte pour la journée si un numéro existe déjà
  WHILE EXISTS (
    SELECT 1 FROM public.orders
    WHERE company_id = p_company_id
      AND created_at >= v_today_start
      AND parcel_number = v_formatted
  ) LOOP
    v_next_num := v_next_num + 1;
    v_formatted := '#' || lpad(v_next_num::text, 2, '0');
  END LOOP;

  RETURN v_formatted;
END;
$$;

-- 4. Index d'optimisation pour la recherche des colis du jour
CREATE INDEX IF NOT EXISTS idx_orders_company_daily_parcel
  ON public.orders (company_id, created_at, parcel_number)
  WHERE parcel_number IS NOT NULL;
