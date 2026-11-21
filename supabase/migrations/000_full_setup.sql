-- ============================================================
-- SETUP COMPLET & IDEMPOTENT — LiveVente Manager
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'employee', 'courier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'assigned', 'in_transit', 'delivered', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM (
    'cash', 'mobile_money', 'card', 'bank_transfer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.companies (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  slug         TEXT        UNIQUE NOT NULL,
  country      TEXT        NOT NULL DEFAULT 'TG',
  currency     TEXT        NOT NULL DEFAULT 'XOF',
  logo_url     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name    TEXT        NOT NULL,
  phone        TEXT,
  avatar_url   TEXT,
  role         public.user_role NOT NULL DEFAULT 'employee',
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role    ON public.profiles(role);

CREATE TABLE IF NOT EXISTS public.customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name    TEXT        NOT NULL,
  phone        TEXT        NOT NULL,
  email        TEXT,
  address      TEXT,
  city         TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone   ON public.customers(phone);

CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID            NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id     UUID            NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  created_by      UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status          public.order_status NOT NULL DEFAULT 'pending',
  total_amount    NUMERIC(12, 2)  NOT NULL DEFAULT 0,
  delivery_fee    NUMERIC(12, 2)  NOT NULL DEFAULT 0,
  notes           TEXT,
  ordered_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_company    ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer   ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);

CREATE TABLE IF NOT EXISTS public.order_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID           NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id       UUID           NOT NULL REFERENCES public.orders(id)    ON DELETE CASCADE,
  product_name   TEXT           NOT NULL,
  quantity       INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal       NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_company ON public.order_items(company_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON public.order_items(order_id);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID            NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  order_id          UUID            NOT NULL REFERENCES public.orders(id)     ON DELETE CASCADE,
  courier_id        UUID            NOT NULL REFERENCES public.profiles(id)   ON DELETE RESTRICT,
  status            public.delivery_status NOT NULL DEFAULT 'assigned',
  delivery_address  TEXT            NOT NULL,
  scheduled_at      TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  failed_reason     TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_company ON public.deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON public.deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order   ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status  ON public.deliveries(status);

CREATE TABLE IF NOT EXISTS public.delivery_proofs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id)   ON DELETE CASCADE,
  delivery_id     UUID        NOT NULL REFERENCES public.deliveries(id)  ON DELETE CASCADE,
  photo_url       TEXT,
  signature_url   TEXT,
  gps_lat         NUMERIC(10, 7),
  gps_lng         NUMERIC(10, 7),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_proofs_company  ON public.delivery_proofs(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_delivery ON public.delivery_proofs(delivery_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID            NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id        UUID            NOT NULL REFERENCES public.orders(id)    ON DELETE RESTRICT,
  amount          NUMERIC(12, 2)  NOT NULL CHECK (amount > 0),
  method          public.payment_method  NOT NULL DEFAULT 'cash',
  status          public.payment_status  NOT NULL DEFAULT 'pending',
  reference       TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_company ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_order   ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status  ON public.payments(status);

CREATE TABLE IF NOT EXISTS public.courier_settlements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID            NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  courier_id       UUID            NOT NULL REFERENCES public.profiles(id)   ON DELETE RESTRICT,
  amount           NUMERIC(12, 2)  NOT NULL CHECK (amount >= 0),
  status           public.settlement_status NOT NULL DEFAULT 'pending',
  period_start     DATE            NOT NULL,
  period_end       DATE            NOT NULL,
  deliveries_count INTEGER         NOT NULL DEFAULT 0,
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_period CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_settlements_company ON public.courier_settlements(company_id);
CREATE INDEX IF NOT EXISTS idx_settlements_courier ON public.courier_settlements(courier_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status  ON public.courier_settlements(status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'profiles', 'customers', 'orders',
    'deliveries', 'payments', 'courier_settlements'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON public.%s
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Helpers RLS ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_proofs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_settlements  ENABLE ROW LEVEL SECURITY;

-- Nettoyage puis création des policies RLS
DROP POLICY IF EXISTS "companies: voir la sienne" ON public.companies;
CREATE POLICY "companies: voir la sienne" ON public.companies FOR SELECT
  USING (id = public.get_my_company_id());

DROP POLICY IF EXISTS "companies: owner peut modifier" ON public.companies;
CREATE POLICY "companies: owner peut modifier" ON public.companies FOR UPDATE
  USING (id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "profiles: voir son entreprise" ON public.profiles;
CREATE POLICY "profiles: voir son entreprise" ON public.profiles FOR SELECT
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "profiles: modifier le sien" ON public.profiles;
CREATE POLICY "profiles: modifier le sien" ON public.profiles FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles: owner/employee peut créer" ON public.profiles;
CREATE POLICY "profiles: owner/employee peut créer" ON public.profiles FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "profiles: owner peut supprimer" ON public.profiles;
CREATE POLICY "profiles: owner peut supprimer" ON public.profiles FOR DELETE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "customers: voir son entreprise" ON public.customers;
CREATE POLICY "customers: voir son entreprise" ON public.customers FOR SELECT
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "customers: owner/employee peut créer" ON public.customers;
CREATE POLICY "customers: owner/employee peut créer" ON public.customers FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "customers: owner/employee peut modifier" ON public.customers;
CREATE POLICY "customers: owner/employee peut modifier" ON public.customers FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "customers: owner peut supprimer" ON public.customers;
CREATE POLICY "customers: owner peut supprimer" ON public.customers FOR DELETE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "orders: owner/employee voit tout" ON public.orders;
CREATE POLICY "orders: owner/employee voit tout" ON public.orders FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "orders: owner/employee peut créer" ON public.orders;
CREATE POLICY "orders: owner/employee peut créer" ON public.orders FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "orders: owner/employee peut modifier" ON public.orders;
CREATE POLICY "orders: owner/employee peut modifier" ON public.orders FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "orders: owner peut supprimer" ON public.orders;
CREATE POLICY "orders: owner peut supprimer" ON public.orders FOR DELETE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "order_items: owner/employee voit tout" ON public.order_items;
CREATE POLICY "order_items: owner/employee voit tout" ON public.order_items FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "order_items: owner/employee peut créer" ON public.order_items;
CREATE POLICY "order_items: owner/employee peut créer" ON public.order_items FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "order_items: owner/employee peut modifier" ON public.order_items;
CREATE POLICY "order_items: owner/employee peut modifier" ON public.order_items FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "order_items: owner peut supprimer" ON public.order_items;
CREATE POLICY "order_items: owner peut supprimer" ON public.order_items FOR DELETE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "deliveries: owner/employee voit tout" ON public.deliveries;
CREATE POLICY "deliveries: owner/employee voit tout" ON public.deliveries FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "deliveries: courier voit les siennes" ON public.deliveries;
CREATE POLICY "deliveries: courier voit les siennes" ON public.deliveries FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'courier' AND courier_id = auth.uid());

DROP POLICY IF EXISTS "deliveries: owner/employee peut créer" ON public.deliveries;
CREATE POLICY "deliveries: owner/employee peut créer" ON public.deliveries FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "deliveries: owner/employee peut modifier" ON public.deliveries;
CREATE POLICY "deliveries: owner/employee peut modifier" ON public.deliveries FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "deliveries: courier peut mettre à jour les siennes" ON public.deliveries;
CREATE POLICY "deliveries: courier peut mettre à jour les siennes" ON public.deliveries FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'courier' AND courier_id = auth.uid());

DROP POLICY IF EXISTS "deliveries: owner peut supprimer" ON public.deliveries;
CREATE POLICY "deliveries: owner peut supprimer" ON public.deliveries FOR DELETE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "delivery_proofs: owner/employee voit tout" ON public.delivery_proofs;
CREATE POLICY "delivery_proofs: owner/employee voit tout" ON public.delivery_proofs FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "delivery_proofs: courier voit les siennes" ON public.delivery_proofs;
CREATE POLICY "delivery_proofs: courier voit les siennes" ON public.delivery_proofs FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'courier' AND delivery_id IN (SELECT id FROM public.deliveries WHERE courier_id = auth.uid()));

DROP POLICY IF EXISTS "delivery_proofs: courier peut créer" ON public.delivery_proofs;
CREATE POLICY "delivery_proofs: courier peut créer" ON public.delivery_proofs FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND delivery_id IN (SELECT id FROM public.deliveries WHERE courier_id = auth.uid()));

DROP POLICY IF EXISTS "delivery_proofs: owner/employee peut créer" ON public.delivery_proofs;
CREATE POLICY "delivery_proofs: owner/employee peut créer" ON public.delivery_proofs FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "payments: owner/employee voit tout" ON public.payments;
CREATE POLICY "payments: owner/employee voit tout" ON public.payments FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "payments: owner/employee peut créer" ON public.payments;
CREATE POLICY "payments: owner/employee peut créer" ON public.payments FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "payments: owner/employee peut modifier" ON public.payments;
CREATE POLICY "payments: owner/employee peut modifier" ON public.payments FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "payments: owner peut supprimer" ON public.payments;
CREATE POLICY "payments: owner peut supprimer" ON public.payments FOR DELETE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "settlements: owner/employee voit tout" ON public.courier_settlements;
CREATE POLICY "settlements: owner/employee voit tout" ON public.courier_settlements FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "settlements: courier voit les siens" ON public.courier_settlements;
CREATE POLICY "settlements: courier voit les siens" ON public.courier_settlements FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'courier' AND courier_id = auth.uid());

DROP POLICY IF EXISTS "settlements: owner peut créer" ON public.courier_settlements;
CREATE POLICY "settlements: owner peut créer" ON public.courier_settlements FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "settlements: owner peut modifier" ON public.courier_settlements;
CREATE POLICY "settlements: owner peut modifier" ON public.courier_settlements FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

DROP POLICY IF EXISTS "settlements: owner peut supprimer" ON public.courier_settlements;
CREATE POLICY "settlements: owner peut supprimer" ON public.courier_settlements FOR DELETE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() = 'owner');

-- ── RPC idempotent d'inscription ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_company_and_profile(
  p_full_name    TEXT,
  p_company_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_slug       TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Utilisateur non authentifié');
  END IF;

  SELECT company_id INTO v_company_id FROM public.profiles WHERE id = auth.uid();
  IF v_company_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'company_id', v_company_id);
  END IF;

  v_slug := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'entreprise'; END IF;
  v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.companies (name, slug)
  VALUES (p_company_name, v_slug)
  RETURNING id INTO v_company_id;

  INSERT INTO public.profiles (id, company_id, full_name, role)
  VALUES (auth.uid(), v_company_id, p_full_name, 'owner');

  RETURN json_build_object('success', true, 'company_id', v_company_id, 'slug', v_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_and_profile(TEXT, TEXT) TO authenticated;

-- ── Trigger automatique à chaque nouvelle inscription auth.users ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id   UUID;
  v_full_name    TEXT;
  v_company_name TEXT;
  v_slug         TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1), 'Utilisateur');
  v_company_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), ''), 'Entreprise de ' || v_full_name);

  v_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'entreprise'; END IF;
  v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.companies (name, slug)
  VALUES (v_company_name, v_slug)
  RETURNING id INTO v_company_id;

  INSERT INTO public.profiles (id, company_id, full_name, role)
  VALUES (NEW.id, v_company_id, v_full_name, 'owner');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Rattrapage immédiat des comptes auth.users déjà existants sans profil ─────
DO $$
DECLARE
  u RECORD;
  v_company_id UUID;
  v_full_name TEXT;
  v_company_name TEXT;
  v_slug TEXT;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    v_full_name := COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), 'Utilisateur');
    v_company_name := COALESCE(NULLIF(trim(u.raw_user_meta_data->>'company_name'), ''), 'Entreprise de ' || v_full_name);

    v_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    IF v_slug = '' THEN v_slug := 'entreprise'; END IF;
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);

    INSERT INTO public.companies (name, slug)
    VALUES (v_company_name, v_slug)
    RETURNING id INTO v_company_id;

    INSERT INTO public.profiles (id, company_id, full_name, role)
    VALUES (u.id, v_company_id, v_full_name, 'owner');
  END LOOP;
END;
$$;
