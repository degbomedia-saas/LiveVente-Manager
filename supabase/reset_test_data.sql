-- ============================================================
-- SCRIPT DE RÉINITIALISATION TOTALE (CLIENTS, PRODUITS, COMMANDES)
-- À exécuter dans : Supabase > SQL Editor > Run
--
-- Ce script vide intégralement :
--   - Reversements & caisse (courier_settlements)
--   - Paiements (payments)
--   - Preuves de livraison (delivery_proofs)
--   - Livraisons (deliveries)
--   - Articles de commandes (order_items)
--   - Commandes (orders)
--   - Clients du répertoire (customers)
--   - Produits du catalogue (products)
-- Et met à jour le nom de la boutique vers "Élégance Wax Lomé".
--
-- CONSERVÉS UNIQUEMENT :
--   - Comptes utilisateurs (auth.users) & Entreprise (companies)
--   - Profils & Livreurs (profiles : Kodjo, Moussa, propriétaire...)
--
-- Le compteur de colis quotidien (get_next_daily_parcel_number)
-- lit MAX(parcel_number) sur public.orders : il redémarrera
-- automatiquement à #01 dès la prochaine commande.
-- ============================================================

BEGIN;

-- 1. Vider les reversements de caisse livreurs
DELETE FROM public.courier_settlements;

-- 2. Vider les paiements (référence orders avec ON DELETE RESTRICT)
DELETE FROM public.payments;

-- 3. Vider les preuves de livraison et les livraisons
DELETE FROM public.delivery_proofs;
DELETE FROM public.deliveries;

-- 4. Vider les lignes de commandes et les commandes
DELETE FROM public.order_items;
DELETE FROM public.orders;

-- 5. Vider les clients et les produits du catalogue
DELETE FROM public.customers;
DELETE FROM public.products;

-- 6. Mettre à jour le nom officiel de la boutique
UPDATE public.companies
SET name = 'Élégance Wax Lomé';

COMMIT;
