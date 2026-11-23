-- Migration 019: Étape 3 — Catalogue, Produits Types, Stocks, Commandes & Base Clients CRM (RLS seller_id)

-- 1. Table public.product_templates (Produits Types pour création rapide)
CREATE TABLE IF NOT EXISTS public.product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_category TEXT NOT NULL DEFAULT 'Mode',
  default_variants JSONB NOT NULL DEFAULT '{"sizes":["S","M","L","XL"],"colors":["Noir","Blanc"]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_templates_seller_id ON public.product_templates(seller_id);
CREATE INDEX IF NOT EXISTS idx_product_templates_company_id ON public.product_templates(company_id);

ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_templates: lecture vendeur ou modeles globaux" ON public.product_templates;
CREATE POLICY "product_templates: lecture vendeur ou modeles globaux"
  ON public.product_templates
  FOR SELECT
  TO authenticated
  USING (
    seller_id IS NULL
    OR company_id = public.get_my_company_id()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = product_templates.seller_id
        AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "product_templates: gestion vendeur proprietaire" ON public.product_templates;
CREATE POLICY "product_templates: gestion vendeur proprietaire"
  ON public.product_templates
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = product_templates.seller_id
        AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = product_templates.seller_id
        AND (s.owner_id = auth.uid() OR s.company_id = public.get_my_company_id())
    )
    OR public.get_my_role()::text IN ('admin', 'super_admin')
  );

-- Insertion de 4 Produits Types par défaut (accessibles à toutes les boutiques)
INSERT INTO public.product_templates (seller_id, company_id, name, default_category, default_variants)
SELECT NULL, NULL, v.name, v.default_category, v.default_variants::jsonb
FROM (
  VALUES
    ('Robe Wax / Prêt-à-porter', 'Vêtements', '{"sizes":["S","M","L","XL","XXL"],"colors":["Multicolore","Émeraude","Or"]}'),
    ('Ensemble Bazin / Boubou', 'Tenues Traditionnelles', '{"sizes":["M","L","XL","XXL"],"colors":["Blanc","Bleu Roi","Bordeaux"]}'),
    ('Sac à Main / Maroquinerie', 'Accessoires', '{"sizes":["Unique"],"colors":["Noir","Camel","Beige"]}'),
    ('Sandales / Chaussures', 'Chaussures', '{"sizes":["37","38","39","40","41","42"],"colors":["Noir","Doré","Nude"]}')
) AS v(name, default_category, default_variants)
WHERE NOT EXISTS (SELECT 1 FROM public.product_templates WHERE seller_id IS NULL);

-- 2. Évolution de la table public.products (Stocks, seuils d'alerte, SKU, catégorie, image)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Mode',
  ADD COLUMN IF NOT EXISTS price_fcfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_qty INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.products
SET price_fcfa = COALESCE(ROUND(base_price)::integer, 0)
WHERE price_fcfa = 0 AND base_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);

-- Synchronisation automatique entre base_price et price_fcfa
CREATE OR REPLACE FUNCTION public.sync_product_price_fcfa()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.price_fcfa IS NOT NULL AND NEW.price_fcfa > 0 AND (NEW.base_price IS NULL OR NEW.base_price = 0) THEN
    NEW.base_price := NEW.price_fcfa;
  ELSIF NEW.base_price IS NOT NULL AND NEW.base_price > 0 THEN
    NEW.price_fcfa := ROUND(NEW.base_price)::integer;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_price ON public.products;
CREATE TRIGGER trg_products_sync_price
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_price_fcfa();

-- 3. Évolution de la table public.customers (CRM, fidélité, unicité par boutique + téléphone)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS default_address TEXT,
  ADD COLUMN IF NOT EXISTS default_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_orders INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent_fcfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_seller_id ON public.customers(seller_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_seller_phone_uniq
  ON public.customers(seller_id, phone)
  WHERE seller_id IS NOT NULL;

-- 4. Évolution de l'enum public.order_status et de la table public.orders
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'missing_info';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'packing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'returned';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (source IN ('tiktok', 'whatsapp', 'instagram', 'manual')),
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_fee_fcfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cod_fcfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'tmoney', 'flooz', 'online')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS barcode_value TEXT,
  ADD COLUMN IF NOT EXISTS qr_token TEXT,
  ADD COLUMN IF NOT EXISTS is_missing_info BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_note TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_missing_info ON public.orders(is_missing_info);

-- 5. Évolution de la table public.order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price_fcfa INTEGER NOT NULL DEFAULT 0;

-- 6. Trigger CRM : mise à jour automatique des compteurs client à chaque nouvelle commande
CREATE OR REPLACE FUNCTION public.update_customer_crm_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_total INTEGER;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    v_order_total := COALESCE(
      NULLIF(NEW.total_cod_fcfa, 0),
      ROUND(COALESCE(NEW.total_amount, 0))::integer
    );

    UPDATE public.customers
    SET
      total_orders = COALESCE(total_orders, 0) + 1,
      total_spent_fcfa = COALESCE(total_spent_fcfa, 0) + GREATEST(0, v_order_total),
      loyalty_points = COALESCE(loyalty_points, 0) + 1
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_update_customer_crm ON public.orders;
CREATE TRIGGER trg_orders_update_customer_crm
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_crm_on_order();

-- 7. Trigger Stock : décrémentation automatique du stock à la confirmation d'une commande
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status::text IS DISTINCT FROM 'confirmed' AND NEW.status::text = 'confirmed') THEN
    UPDATE public.products p
    SET stock_qty = GREATEST(0, COALESCE(p.stock_qty, 0) - oi.quantity)
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND (
        oi.product_id = p.id
        OR (oi.product_id IS NULL AND lower(p.name) = lower(split_part(oi.product_name, ' (', 1)))
      )
      AND p.company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_decrement_stock_confirm ON public.orders;
CREATE TRIGGER trg_orders_decrement_stock_confirm
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_stock_on_order_confirm();
