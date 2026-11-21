-- ============================================================
-- MIGRATION 006 — Catalogue de produits (products) + RLS
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID           NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name             TEXT           NOT NULL,
  base_price       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  available_sizes  TEXT[]         NOT NULL DEFAULT '{}',
  available_colors TEXT[]         NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products: voir son entreprise" ON public.products;
CREATE POLICY "products: voir son entreprise" ON public.products FOR SELECT
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "products: owner/employee peut creer" ON public.products;
CREATE POLICY "products: owner/employee peut creer" ON public.products FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

DROP POLICY IF EXISTS "products: owner/employee peut modifier" ON public.products;
CREATE POLICY "products: owner/employee peut modifier" ON public.products FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

DROP POLICY IF EXISTS "products: owner/employee peut supprimer" ON public.products;
CREATE POLICY "products: owner/employee peut supprimer" ON public.products FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );
