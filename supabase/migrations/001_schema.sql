-- ============================================================
-- MIGRATION 001 — Schéma de base LiveVente Manager
-- Appliquer dans : Supabase > SQL Editor
-- ============================================================

-- ----------------------------------------------------------------
-- 0. Extensions utiles
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ================================================================
-- 1. COMPANIES (Entreprises — racine du multi-tenant)
-- ================================================================
CREATE TABLE public.companies (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  slug         TEXT        UNIQUE NOT NULL,          -- ex: "livraison-dakar"
  country      TEXT        NOT NULL DEFAULT 'SN',
  currency     TEXT        NOT NULL DEFAULT 'XOF',
  logo_url     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.companies IS 'Entreprises clientes du SaaS (multi-tenant)';


-- ================================================================
-- 2. PROFILES (Utilisateurs — liés à auth.users)
-- ================================================================
CREATE TYPE public.user_role AS ENUM ('owner', 'employee', 'courier');

CREATE TABLE public.profiles (
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

CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_profiles_role    ON public.profiles(role);

COMMENT ON TABLE public.profiles IS 'Profils utilisateurs (owner, employee, courier)';


-- ================================================================
-- 3. CUSTOMERS (Clients)
-- ================================================================
CREATE TABLE public.customers (
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

CREATE INDEX idx_customers_company ON public.customers(company_id);
CREATE INDEX idx_customers_phone   ON public.customers(phone);

COMMENT ON TABLE public.customers IS 'Clients de chaque entreprise';


-- ================================================================
-- 4. ORDERS (Commandes)
-- ================================================================
CREATE TYPE public.order_status AS ENUM (
  'pending',      -- En attente
  'confirmed',    -- Confirmée
  'preparing',    -- En préparation
  'shipped',      -- Expédiée
  'delivered',    -- Livrée
  'cancelled'     -- Annulée
);

CREATE TABLE public.orders (
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

CREATE INDEX idx_orders_company    ON public.orders(company_id);
CREATE INDEX idx_orders_customer   ON public.orders(customer_id);
CREATE INDEX idx_orders_status     ON public.orders(status);
CREATE INDEX idx_orders_created_by ON public.orders(created_by);

COMMENT ON TABLE public.orders IS 'Commandes clients';


-- ================================================================
-- 5. ORDER_ITEMS (Articles d'une commande)
-- ================================================================
CREATE TABLE public.order_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID           NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id       UUID           NOT NULL REFERENCES public.orders(id)    ON DELETE CASCADE,
  product_name   TEXT           NOT NULL,
  quantity       INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal       NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_company  ON public.order_items(company_id);
CREATE INDEX idx_order_items_order    ON public.order_items(order_id);

COMMENT ON TABLE public.order_items IS 'Lignes d''articles par commande';


-- ================================================================
-- 6. DELIVERIES (Livraisons)
-- ================================================================
CREATE TYPE public.delivery_status AS ENUM (
  'assigned',     -- Attribuée au livreur
  'in_transit',   -- En cours de livraison
  'delivered',    -- Livrée avec succès
  'failed'        -- Échec de livraison
);

CREATE TABLE public.deliveries (
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

CREATE INDEX idx_deliveries_company   ON public.deliveries(company_id);
CREATE INDEX idx_deliveries_courier   ON public.deliveries(courier_id);
CREATE INDEX idx_deliveries_order     ON public.deliveries(order_id);
CREATE INDEX idx_deliveries_status    ON public.deliveries(status);

COMMENT ON TABLE public.deliveries IS 'Livraisons attribuées aux livreurs';


-- ================================================================
-- 7. DELIVERY_PROOFS (Preuves de livraison)
-- ================================================================
CREATE TABLE public.delivery_proofs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id)   ON DELETE CASCADE,
  delivery_id     UUID        NOT NULL REFERENCES public.deliveries(id)  ON DELETE CASCADE,
  photo_url       TEXT,                          -- URL photo dans Supabase Storage
  signature_url   TEXT,                          -- URL signature
  gps_lat         NUMERIC(10, 7),                -- Latitude GPS
  gps_lng         NUMERIC(10, 7),                -- Longitude GPS
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_proofs_company  ON public.delivery_proofs(company_id);
CREATE INDEX idx_delivery_proofs_delivery ON public.delivery_proofs(delivery_id);

COMMENT ON TABLE public.delivery_proofs IS 'Preuves (photo, signature, GPS) de livraison';


-- ================================================================
-- 8. PAYMENTS (Paiements)
-- ================================================================
CREATE TYPE public.payment_method AS ENUM (
  'cash',           -- Espèces
  'mobile_money',   -- Orange Money, Wave, etc.
  'card',           -- Carte bancaire
  'bank_transfer'   -- Virement
);

CREATE TYPE public.payment_status AS ENUM (
  'pending',    -- En attente
  'completed',  -- Validé
  'failed',     -- Échoué
  'refunded'    -- Remboursé
);

CREATE TABLE public.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID            NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id        UUID            NOT NULL REFERENCES public.orders(id)    ON DELETE RESTRICT,
  amount          NUMERIC(12, 2)  NOT NULL CHECK (amount > 0),
  method          public.payment_method  NOT NULL DEFAULT 'cash',
  status          public.payment_status  NOT NULL DEFAULT 'pending',
  reference       TEXT,                           -- Référence externe (ex: numéro Wave)
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_company ON public.payments(company_id);
CREATE INDEX idx_payments_order   ON public.payments(order_id);
CREATE INDEX idx_payments_status  ON public.payments(status);

COMMENT ON TABLE public.payments IS 'Paiements associés aux commandes';


-- ================================================================
-- 9. COURIER_SETTLEMENTS (Reversements aux livreurs)
-- ================================================================
CREATE TYPE public.settlement_status AS ENUM (
  'pending',  -- En attente de reversement
  'paid'      -- Reversé
);

CREATE TABLE public.courier_settlements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID            NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  courier_id      UUID            NOT NULL REFERENCES public.profiles(id)   ON DELETE RESTRICT,
  amount          NUMERIC(12, 2)  NOT NULL CHECK (amount >= 0),
  status          public.settlement_status NOT NULL DEFAULT 'pending',
  period_start    DATE            NOT NULL,
  period_end      DATE            NOT NULL,
  deliveries_count INTEGER        NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_settlements_company ON public.courier_settlements(company_id);
CREATE INDEX idx_settlements_courier ON public.courier_settlements(courier_id);
CREATE INDEX idx_settlements_status  ON public.courier_settlements(status);

COMMENT ON TABLE public.courier_settlements IS 'Reversements financiers aux livreurs';


-- ================================================================
-- 10. TRIGGER : updated_at automatique
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur toutes les tables avec updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'profiles', 'customers', 'orders',
    'deliveries', 'payments', 'courier_settlements'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON public.%s
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
