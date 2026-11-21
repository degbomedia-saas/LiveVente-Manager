-- ============================================================
-- PURGE ABSOLUE ET RESET COMPLET POUR NOUVELLE INSCRIPTION
-- À exécuter dans : Supabase > SQL Editor > Run
--
-- Vide intégralement la base de données (données métier,
-- entreprises, profils ET utilisateurs auth.users) sans laisser
-- aucune clé orpheline, afin de repartir d'une inscription vierge
-- sur /register avec le même email.
--
-- Le compteur quotidien de colis (get_next_daily_parcel_number)
-- lit MAX(parcel_number) sur public.orders : il redémarrera
-- automatiquement à #01 dès la première commande.
-- ============================================================

BEGIN;

-- 1. Suppression en cascade des données opérationnelles & catalogue
DELETE FROM public.courier_settlements;
DELETE FROM public.payments;
DELETE FROM public.delivery_proofs;
DELETE FROM public.deliveries;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.customers;
DELETE FROM public.products;

-- 2. Purge des profils et entreprises
DELETE FROM public.profiles;
DELETE FROM public.companies;

-- 3. Purge des utilisateurs d'authentification Supabase (libère tous les emails)
DELETE FROM auth.identities;
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.users;

COMMIT;
