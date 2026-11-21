-- Migration 017: Politiques de lecture globale pour le rôle super_admin
-- Permet au fondateur (role = 'super_admin') de consulter toutes les boutiques,
-- profils propriétaires et volumes de colis dans /super-admin sans exposer la service_role key.

DROP POLICY IF EXISTS "companies: super_admin voit tout" ON public.companies;
CREATE POLICY "companies: super_admin voit tout"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (public.get_my_role()::text = 'super_admin');

DROP POLICY IF EXISTS "profiles: super_admin voit tout" ON public.profiles;
CREATE POLICY "profiles: super_admin voit tout"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.get_my_role()::text = 'super_admin');

DROP POLICY IF EXISTS "orders: super_admin voit tout" ON public.orders;
CREATE POLICY "orders: super_admin voit tout"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.get_my_role()::text = 'super_admin');
