-- ============================================================
-- MIGRATION 024 — Archivage sécurisé (Soft Delete) & Numéros #KK-XXXX (Africa/Lome)
-- supabase/migrations/024_security_soft_delete_and_lome_numbers.sql
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Soft Delete : colonne is_archived (boolean, défaut false) sur products, drivers, orders
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_not_archived
  ON public.products (company_id, is_archived)
  WHERE is_archived = false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drivers'
  ) THEN
    ALTER TABLE public.drivers
      ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

    CREATE INDEX IF NOT EXISTS idx_drivers_not_archived
      ON public.drivers (company_id, is_archived)
      WHERE is_archived = false;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_not_archived
  ON public.orders (company_id, is_archived)
  WHERE is_archived = false;

-- 2. Séquence SQL atomique sans collision pour order_number (#KK-XXXX)
CREATE SEQUENCE IF NOT EXISTS public.kaba_order_number_seq
  START WITH 1001
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique
  ON public.orders (order_number)
  WHERE order_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_unique_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  v_seq := nextval('public.kaba_order_number_seq');
  RETURN '#KK-' || lpad(v_seq::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_unique_order_number() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_order_number_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR trim(NEW.order_number) = '' THEN
    NEW.order_number := public.generate_unique_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_order_number ON public.orders;
CREATE TRIGGER trg_orders_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_number_before_insert();

-- Rétro-remplir les commandes existantes sans order_number
UPDATE public.orders
SET order_number = public.generate_unique_order_number()
WHERE order_number IS NULL OR trim(order_number) = '';

-- 3. Mise à jour du compteur journalier sur le fuseau Africa/Lome
CREATE OR REPLACE FUNCTION public.get_next_daily_parcel_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_lome DATE := (now() AT TIME ZONE 'Africa/Lome')::date;
  v_max_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(
      NULLIF(regexp_replace(COALESCE(parcel_number, ''), '\D', '', 'g'), '')::INTEGER
    ),
    0
  )
  INTO v_max_num
  FROM public.orders
  WHERE company_id = p_company_id
    AND (ordered_at AT TIME ZONE 'Africa/Lome')::date = v_today_lome;

  RETURN '#' || lpad((v_max_num + 1)::TEXT, 2, '0');
END;
$$;
