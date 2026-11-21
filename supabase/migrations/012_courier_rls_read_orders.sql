-- ============================================================
-- MIGRATION 012 — Politiques RLS pour livreurs sur orders, customers & order_items
-- Permet au livreur de lire les détails de ses commandes attribuées
-- ============================================================

-- 1. Orders : le livreur peut lire les commandes dont il a la livraison
DROP POLICY IF EXISTS "orders: courier voit ses livraisons" ON public.orders;
CREATE POLICY "orders: courier voit ses livraisons" ON public.orders FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND id IN (
      SELECT order_id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

-- 2. Customers : le livreur peut lire les informations de contact de ses clients livrés
DROP POLICY IF EXISTS "customers: courier voit les clients de ses livraisons" ON public.customers;
CREATE POLICY "customers: courier voit les clients de ses livraisons" ON public.customers FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND id IN (
      SELECT o.customer_id
      FROM public.orders o
      JOIN public.deliveries d ON d.order_id = o.id
      WHERE d.courier_id = auth.uid()
    )
  );

-- 3. Order_items : le livreur peut lire les articles des commandes qu'il livre
DROP POLICY IF EXISTS "order_items: courier voit les articles de ses livraisons" ON public.order_items;
CREATE POLICY "order_items: courier voit les articles de ses livraisons" ON public.order_items FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND order_id IN (
      SELECT order_id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

-- 4. Payments : le livreur peut lire les paiements des commandes qu'il livre
DROP POLICY IF EXISTS "payments: courier voit les paiements de ses commandes" ON public.payments;
CREATE POLICY "payments: courier voit les paiements de ses commandes" ON public.payments FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND order_id IN (
      SELECT order_id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );
