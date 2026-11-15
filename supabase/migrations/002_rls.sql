-- ============================================================
-- MIGRATION 002 — Row Level Security (RLS)
-- Appliquer APRÈS la migration 001
-- ============================================================

-- ----------------------------------------------------------------
-- FONCTION HELPER : récupère le company_id de l'utilisateur connecté
-- Utilisée dans toutes les politiques RLS
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ----------------------------------------------------------------
-- FONCTION HELPER : récupère le rôle de l'utilisateur connecté
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ================================================================
-- ACTIVATION RLS SUR TOUTES LES TABLES
-- ================================================================
ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_proofs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_settlements  ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- POLITIQUES RLS — COMPANIES
-- ================================================================
-- Un utilisateur ne voit QUE son entreprise
CREATE POLICY "companies: voir la sienne"
  ON public.companies FOR SELECT
  USING (id = public.get_my_company_id());

-- Seul l'owner peut modifier les infos de l'entreprise
CREATE POLICY "companies: owner peut modifier"
  ON public.companies FOR UPDATE
  USING (
    id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );


-- ================================================================
-- POLITIQUES RLS — PROFILES
-- ================================================================
-- Chacun voit les profils de son entreprise
CREATE POLICY "profiles: voir son entreprise"
  ON public.profiles FOR SELECT
  USING (company_id = public.get_my_company_id());

-- Chacun peut modifier son propre profil
CREATE POLICY "profiles: modifier le sien"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Owner et employee peuvent créer des profils (invitations)
CREATE POLICY "profiles: owner/employee peut créer"
  ON public.profiles FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

-- Seul l'owner peut supprimer un profil
CREATE POLICY "profiles: owner peut supprimer"
  ON public.profiles FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );


-- ================================================================
-- POLITIQUES RLS — CUSTOMERS
-- ================================================================
CREATE POLICY "customers: voir son entreprise"
  ON public.customers FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "customers: owner/employee peut créer"
  ON public.customers FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "customers: owner/employee peut modifier"
  ON public.customers FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "customers: owner peut supprimer"
  ON public.customers FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );


-- ================================================================
-- POLITIQUES RLS — ORDERS
-- ================================================================
-- Owner et employee voient toutes les commandes de l'entreprise
-- Courier ne voit pas les commandes directement (il voit ses livraisons)
CREATE POLICY "orders: owner/employee voit tout"
  ON public.orders FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "orders: owner/employee peut créer"
  ON public.orders FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "orders: owner/employee peut modifier"
  ON public.orders FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "orders: owner peut supprimer"
  ON public.orders FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );


-- ================================================================
-- POLITIQUES RLS — ORDER_ITEMS
-- ================================================================
CREATE POLICY "order_items: owner/employee voit tout"
  ON public.order_items FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "order_items: owner/employee peut créer"
  ON public.order_items FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "order_items: owner/employee peut modifier"
  ON public.order_items FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "order_items: owner peut supprimer"
  ON public.order_items FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );


-- ================================================================
-- POLITIQUES RLS — DELIVERIES
-- ================================================================
-- Owner/employee voient toutes les livraisons de l'entreprise
CREATE POLICY "deliveries: owner/employee voit tout"
  ON public.deliveries FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

-- Courier ne voit QUE ses livraisons attribuées
CREATE POLICY "deliveries: courier voit les siennes"
  ON public.deliveries FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND courier_id = auth.uid()
  );

-- Owner/employee peuvent créer et attribuer une livraison
CREATE POLICY "deliveries: owner/employee peut créer"
  ON public.deliveries FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

-- Owner/employee peuvent modifier n'importe quelle livraison
CREATE POLICY "deliveries: owner/employee peut modifier"
  ON public.deliveries FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

-- Courier peut mettre à jour le statut de SES livraisons uniquement
CREATE POLICY "deliveries: courier peut mettre à jour les siennes"
  ON public.deliveries FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND courier_id = auth.uid()
  );

CREATE POLICY "deliveries: owner peut supprimer"
  ON public.deliveries FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );


-- ================================================================
-- POLITIQUES RLS — DELIVERY_PROOFS
-- ================================================================
CREATE POLICY "delivery_proofs: owner/employee voit tout"
  ON public.delivery_proofs FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

-- Courier voit les preuves de SES livraisons
CREATE POLICY "delivery_proofs: courier voit les siennes"
  ON public.delivery_proofs FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND delivery_id IN (
      SELECT id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

-- Courier peut ajouter des preuves sur SES livraisons
CREATE POLICY "delivery_proofs: courier peut créer"
  ON public.delivery_proofs FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND delivery_id IN (
      SELECT id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

-- Owner/employee peuvent aussi ajouter des preuves
CREATE POLICY "delivery_proofs: owner/employee peut créer"
  ON public.delivery_proofs FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );


-- ================================================================
-- POLITIQUES RLS — PAYMENTS
-- ================================================================
CREATE POLICY "payments: owner/employee voit tout"
  ON public.payments FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "payments: owner/employee peut créer"
  ON public.payments FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "payments: owner/employee peut modifier"
  ON public.payments FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

CREATE POLICY "payments: owner peut supprimer"
  ON public.payments FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );


-- ================================================================
-- POLITIQUES RLS — COURIER_SETTLEMENTS
-- ================================================================
-- Owner/employee voient tous les reversements
CREATE POLICY "settlements: owner/employee voit tout"
  ON public.courier_settlements FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

-- Courier voit uniquement ses propres reversements
CREATE POLICY "settlements: courier voit les siens"
  ON public.courier_settlements FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND courier_id = auth.uid()
  );

-- Seul l'owner peut créer/modifier/supprimer des reversements
CREATE POLICY "settlements: owner peut créer"
  ON public.courier_settlements FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );

CREATE POLICY "settlements: owner peut modifier"
  ON public.courier_settlements FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );

CREATE POLICY "settlements: owner peut supprimer"
  ON public.courier_settlements FOR DELETE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'owner'
  );
