-- Migration 020: Étape 4 — Livreurs (drivers), Livraisons POD/COD (deliveries), Retours (returns), Règlements (settlements) & Suivi public QR

-- 1. Table public.drivers
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  zone_name TEXT DEFAULT 'Tokoin',
  invite_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  deliveries_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drivers_seller_id ON public.drivers(seller_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON public.drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_invite_token ON public.drivers(invite_token);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers: lecture invitation publique par token" ON public.drivers;
CREATE POLICY "drivers: lecture invitation publique par token"
  ON public.drivers
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "drivers: gestion par vendeur ou admin" ON public.drivers;
CREATE POLICY "drivers: gestion par vendeur ou admin"
  ON public.drivers
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id = public.get_my_company_id()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = drivers.seller_id
        AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR company_id = public.get_my_company_id()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = drivers.seller_id
        AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

-- 2. Évolution de la table public.deliveries (POD, GPS, COD, notation client)
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_gps TEXT,
  ADD COLUMN IF NOT EXISTS cod_amount_collected INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_status TEXT NOT NULL DEFAULT 'pending_collection'
    CHECK (cod_status IN ('not_applicable', 'pending_collection', 'collected', 'disputed')),
  ADD COLUMN IF NOT EXISTS driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON public.deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_seller_id ON public.deliveries(seller_id);

-- 3. Table public.returns (Gestion des retours & remise en stock auto)
CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'in_transit', 'received', 'restocked', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returns_seller_id ON public.returns(seller_id);
CREATE INDEX IF NOT EXISTS idx_returns_company_id ON public.returns(company_id);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns: gestion vendeur ou admin" ON public.returns;
CREATE POLICY "returns: gestion vendeur ou admin"
  ON public.returns
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = returns.seller_id
        AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = returns.seller_id
        AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

-- Trigger : remise en stock automatique lorsque le retour passe au statut 'restocked'
CREATE OR REPLACE FUNCTION public.restock_products_on_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'restocked' AND NEW.status = 'restocked') THEN
    UPDATE public.products p
    SET stock_qty = COALESCE(p.stock_qty, 0) + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.order_id
      AND (
        oi.product_id = p.id
        OR (oi.product_id IS NULL AND lower(p.name) = lower(split_part(oi.product_name, ' (', 1)))
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_returns_restock_products ON public.returns;
CREATE TRIGGER trg_returns_restock_products
  AFTER UPDATE ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.restock_products_on_return();

-- 4. Table public.settlements (Règlements financiers : lecture seule pour Vendeurs/Livreurs, gestion complète Admin)
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  total_cod_fcfa INTEGER NOT NULL DEFAULT 0,
  delivery_fees_fcfa INTEGER NOT NULL DEFAULT 0,
  platform_fee_fcfa INTEGER NOT NULL DEFAULT 0,
  net_payout_fcfa INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid_out')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_seller_id ON public.settlements(seller_id);
CREATE INDEX IF NOT EXISTS idx_settlements_driver_id ON public.settlements(driver_id);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlements: lecture seule vendeur et livreur, lecture globale admin" ON public.settlements;
CREATE POLICY "settlements: lecture seule vendeur et livreur, lecture globale admin"
  ON public.settlements
  FOR SELECT
  TO authenticated
  USING (
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
  );

DROP POLICY IF EXISTS "settlements: ecriture admin uniquement" ON public.settlements;
CREATE POLICY "settlements: ecriture admin uniquement"
  ON public.settlements
  FOR ALL
  TO authenticated
  USING (public.get_my_role()::text IN ('admin', 'super_admin'))
  WITH CHECK (public.get_my_role()::text IN ('admin', 'super_admin'));

-- 5. Fonctions SECURITY DEFINER pour la page client sans connexion (/track/[qr_token])
CREATE OR REPLACE FUNCTION public.get_public_tracking_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'order_id', o.id,
    'order_number', COALESCE(o.order_number, o.parcel_number, left(o.id::text, 8)),
    'status', o.status::text,
    'total_amount', COALESCE(NULLIF(o.total_cod_fcfa, 0), ROUND(o.total_amount)::integer),
    'delivery_fee', COALESCE(NULLIF(o.delivery_fee_fcfa, 0), ROUND(o.delivery_fee)::integer),
    'ordered_at', o.ordered_at,
    'store_name', COALESCE(c.name, 'Boutique Kaba Kaba'),
    'store_logo', c.logo_url,
    'palette_key', COALESCE(c.theme_palette, 'emerald'),
    'customer_name', cu.full_name,
    'customer_phone', cu.phone,
    'loyalty_points', COALESCE(cu.loyalty_points, 1),
    'loyalty_threshold', 5,
    'driver_rating', d.driver_rating,
    'customer_confirmed_at', d.customer_confirmed_at
  )
  INTO v_result
  FROM public.orders o
  LEFT JOIN public.companies c ON c.id = o.company_id
  LEFT JOIN public.customers cu ON cu.id = o.customer_id
  LEFT JOIN public.deliveries d ON d.order_id = o.id
  WHERE o.qr_token = p_token OR o.id::text = p_token
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_public_delivery_and_rate(
  p_token TEXT,
  p_rating INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_new_points INTEGER := 1;
BEGIN
  SELECT id, customer_id INTO v_order
  FROM public.orders
  WHERE qr_token = p_token OR id::text = p_token
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable');
  END IF;

  UPDATE public.orders
  SET status = 'delivered'
  WHERE id = v_order.id;

  UPDATE public.deliveries
  SET
    driver_rating = LEAST(5, GREATEST(1, COALESCE(p_rating, 5))),
    customer_confirmed_at = now(),
    status = 'delivered'
  WHERE order_id = v_order.id;

  IF v_order.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET loyalty_points = COALESCE(loyalty_points, 0) + 1
    WHERE id = v_order.customer_id
    RETURNING loyalty_points INTO v_new_points;
  END IF;

  RETURN jsonb_build_object('success', true, 'loyalty_points', v_new_points);
END;
$$;
