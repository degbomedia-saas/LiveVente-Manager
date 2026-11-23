-- Migration 021: Règles de sécurité métier & financière
-- 1. Rôle 'employee' rattaché à stores.id (accès commandes/clients, aucun accès finances ni réglages sensibles)
-- 2. Verrouillage livraison (commande 'confirmed' requise) + historique des tentatives (nom réceptionnaire ou motif obligatoire)
-- 3. Acomptes boutique (deposit_shop_fcfa) & remises partielles dans settlements avec calcul d'écart (remis - attendu)

-- 1. Rattachement du rôle 'employee' à stores.id et verrouillage RLS Finances / Réglages
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'employee';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON public.profiles(store_id);

-- Interdire aux employés ('employee') l'accès aux tables financières settlements & courier_settlements
DROP POLICY IF EXISTS "settlements: lecture seule vendeur et livreur, lecture globale admin" ON public.settlements;
CREATE POLICY "settlements: lecture seule vendeur et livreur (hors employee), lecture globale admin"
  ON public.settlements
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role()::text <> 'employee'
    AND (
      company_id = public.get_my_company_id()
      OR EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = settlements.seller_id
          AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
      )
      OR EXISTS (
        SELECT 1 FROM public.drivers d
        WHERE d.id = settlements.driver_id AND d.user_id = auth.uid()
      )
      OR public.get_my_role()::text IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "settlements: insertion remise par vendeur proprietaire ou admin" ON public.settlements;
CREATE POLICY "settlements: insertion remise par vendeur proprietaire ou admin"
  ON public.settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role()::text IN ('owner', 'seller', 'admin', 'super_admin')
    AND (
      company_id = public.get_my_company_id()
      OR public.get_my_role()::text IN ('admin', 'super_admin')
    )
  );

-- Interdire à 'employee' de modifier les réglages sensibles de la boutique (public.stores)
DROP POLICY IF EXISTS "stores: vendeur modifie sa boutique ou admin" ON public.stores;
CREATE POLICY "stores: vendeur proprietaire modifie sa boutique ou admin"
  ON public.stores
  FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role()::text <> 'employee'
    AND (
      owner_id = auth.uid()
      OR company_id = public.get_my_company_id()
      OR public.get_my_role()::text IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    public.get_my_role()::text <> 'employee'
    AND (
      owner_id = auth.uid()
      OR company_id = public.get_my_company_id()
      OR public.get_my_role()::text IN ('admin', 'super_admin')
    )
  );

-- 2. Verrouillage d'attribution livreur : la commande doit être confirmée
CREATE OR REPLACE FUNCTION public.enforce_confirmed_order_before_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status::text INTO v_status
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_status IN ('pending', 'pending_confirmation', 'missing_info', 'to_confirm', 'cancelled') THEN
    RAISE EXCEPTION 'Verrouillage livraison : la commande doit être confirmée avant d''attribuer un livreur (statut actuel : %).', v_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deliveries_require_confirmed_order ON public.deliveries;
CREATE TRIGGER trg_deliveries_require_confirmed_order
  BEFORE INSERT OR UPDATE OF courier_id, driver_id ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_confirmed_order_before_delivery();

-- Historique immuable de toutes les tentatives de livraison
CREATE TABLE IF NOT EXISTS public.delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  courier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('delivered', 'failed')),
  recipient_name TEXT,
  failure_reason TEXT CHECK (
    failure_reason IS NULL OR failure_reason IN (
      'injoignable',
      'absente',
      'refuse',
      'adresse_introuvable',
      'autre_moment'
    )
  ),
  proof_photo_url TEXT,
  cod_amount_collected INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_attempt_recipient_or_reason CHECK (
    (outcome = 'delivered' AND recipient_name IS NOT NULL AND length(btrim(recipient_name)) > 0)
    OR (outcome = 'failed' AND failure_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_order_id ON public.delivery_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery_id ON public.delivery_attempts(delivery_id);

ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_attempts: lecture et insertion" ON public.delivery_attempts;
CREATE POLICY "delivery_attempts: lecture et insertion"
  ON public.delivery_attempts
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    OR courier_id = auth.uid()
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    OR courier_id = auth.uid()
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

-- 3. Acomptes boutique & Remises partielles dans settlements avec calcul d'écart (remis - attendu)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_shop_fcfa INTEGER NOT NULL DEFAULT 0
  CHECK (deposit_shop_fcfa >= 0);

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS expected_amount_fcfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remitted_amount_fcfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discrepancy_fcfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;
