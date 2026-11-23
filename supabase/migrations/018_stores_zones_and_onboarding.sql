-- Migration 018: Étape 2 — Tables profiles/platform_settings/stores/delivery_zones/subscription_requests + RLS & Onboarding Vendeur

-- 1. Évolution de l'enum public.user_role et de la table public.profiles
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'seller';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'driver';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'customer';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr'
  CHECK (language IN ('fr', 'en'));

-- Autoriser les 4 nouvelles palettes dans public.companies également (compatibilité ascendante)
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_theme_palette_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_theme_palette_check
  CHECK (theme_palette IN ('emerald', 'sky', 'coral', 'violet', 'indigo', 'terracotta'));

-- 2. Table public.platform_settings (modifiable uniquement par 'admin' / 'super_admin')
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saas_name TEXT NOT NULL DEFAULT 'Kaba Kaba',
  saas_logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (saas_name, saas_logo_url)
SELECT 'Kaba Kaba', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings: lecture publique" ON public.platform_settings;
CREATE POLICY "platform_settings: lecture publique"
  ON public.platform_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "platform_settings: modification admin" ON public.platform_settings;
CREATE POLICY "platform_settings: modification admin"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (public.get_my_role()::text IN ('admin', 'super_admin'))
  WITH CHECK (public.get_my_role()::text IN ('admin', 'super_admin'));

-- 3. Table public.stores
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  store_name TEXT NOT NULL,
  whatsapp_phone TEXT,
  city TEXT NOT NULL DEFAULT 'Lomé',
  logo_url TEXT,
  palette_key TEXT NOT NULL DEFAULT 'emerald'
    CHECK (palette_key IN ('emerald', 'sky', 'coral', 'violet')),
  plan TEXT NOT NULL DEFAULT 'free_mvp'
    CHECK (plan IN ('free_mvp', 'pro', 'business')),
  plan_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (plan_status IN ('active', 'trial', 'suspended')),
  loyalty_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_company_id ON public.stores(company_id);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores: vendeur voit sa boutique ou admin voit tout" ON public.stores;
CREATE POLICY "stores: vendeur voit sa boutique ou admin voit tout"
  ON public.stores
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR company_id = public.get_my_company_id()
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "stores: vendeur cree sa boutique" ON public.stores;
CREATE POLICY "stores: vendeur cree sa boutique"
  ON public.stores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "stores: vendeur modifie sa boutique ou admin" ON public.stores;
CREATE POLICY "stores: vendeur modifie sa boutique ou admin"
  ON public.stores
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR company_id = public.get_my_company_id()
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR company_id = public.get_my_company_id()
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "stores: admin supprime" ON public.stores;
CREATE POLICY "stores: admin supprime"
  ON public.stores
  FOR DELETE
  TO authenticated
  USING (public.get_my_role()::text IN ('admin', 'super_admin'));

-- 4. Table public.delivery_zones (scopée par seller_id -> public.stores.id)
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  fee_fcfa INTEGER NOT NULL DEFAULT 1000 CHECK (fee_fcfa >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_seller_id ON public.delivery_zones(seller_id);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_zones: acces vendeur proprietaire ou admin" ON public.delivery_zones;
CREATE POLICY "delivery_zones: acces vendeur proprietaire ou admin"
  ON public.delivery_zones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = delivery_zones.seller_id
        AND (
          s.owner_id = auth.uid()
          OR s.company_id = public.get_my_company_id()
        )
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = delivery_zones.seller_id
        AND (
          s.owner_id = auth.uid()
          OR s.company_id = public.get_my_company_id()
        )
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

-- Trigger : copie automatique des 5 zones par défaut pour Lomé à la création d'une boutique dans public.stores
CREATE OR REPLACE FUNCTION public.seed_default_lome_delivery_zones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE seller_id = NEW.id) THEN
    INSERT INTO public.delivery_zones (seller_id, zone_name, fee_fcfa, is_active)
    VALUES
      (NEW.id, 'Tokoin', 1000, true),
      (NEW.id, 'Déckon', 1000, true),
      (NEW.id, 'Agoè', 1500, true),
      (NEW.id, 'Adidogomé', 1500, true),
      (NEW.id, 'Baguida', 2000, true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_seed_default_zones ON public.stores;
CREATE TRIGGER trg_stores_seed_default_zones
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_lome_delivery_zones();

-- 5. Table public.subscription_requests
CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  requested_plan TEXT NOT NULL CHECK (requested_plan IN ('free_mvp', 'pro', 'business')),
  mobile_money_ref TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_seller_id ON public.subscription_requests(seller_id);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_requests: lecture vendeur ou admin" ON public.subscription_requests;
CREATE POLICY "subscription_requests: lecture vendeur ou admin"
  ON public.subscription_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = subscription_requests.seller_id
        AND (
          s.owner_id = auth.uid()
          OR s.company_id = public.get_my_company_id()
        )
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "subscription_requests: creation vendeur" ON public.subscription_requests;
CREATE POLICY "subscription_requests: creation vendeur"
  ON public.subscription_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = subscription_requests.seller_id
        AND (
          s.owner_id = auth.uid()
          OR s.company_id = public.get_my_company_id()
        )
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "subscription_requests: validation admin uniquement" ON public.subscription_requests;
CREATE POLICY "subscription_requests: validation admin uniquement"
  ON public.subscription_requests
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role()::text IN ('admin', 'super_admin'))
  WITH CHECK (public.get_my_role()::text IN ('admin', 'super_admin'));
