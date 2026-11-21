-- Migration 016: Modèle d'abonnements (subscriptions) et rôle super_admin

-- 1. Ajout du rôle 'super_admin' à l'enum public.user_role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Création de la table public.subscriptions liée à public.companies
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial' CHECK (plan_type IN ('trial', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  current_period_starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  monthly_price INTEGER NOT NULL DEFAULT 15000, -- FCFA
  payment_method TEXT DEFAULT 'tmoney_moov',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- 3. Trigger de mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.set_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_subscriptions_updated_at();

-- 4. Attribution automatique d'un essai gratuit de 14 jours à la création d'une boutique
CREATE OR REPLACE FUNCTION public.init_company_subscription_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (
    company_id,
    plan_type,
    status,
    trial_starts_at,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    monthly_price,
    payment_method
  )
  VALUES (
    NEW.id,
    'trial',
    'trialing',
    now(),
    now() + interval '14 days',
    now(),
    now() + interval '14 days',
    15000,
    'tmoney_moov'
  )
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_init_subscription ON public.companies;
CREATE TRIGGER trg_companies_init_subscription
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.init_company_subscription_on_create();

-- Backfill pour les boutiques déjà existantes sans abonnement
INSERT INTO public.subscriptions (
  company_id,
  plan_type,
  status,
  trial_starts_at,
  trial_ends_at,
  current_period_starts_at,
  current_period_ends_at,
  monthly_price,
  payment_method
)
SELECT
  id,
  'trial',
  'trialing',
  now(),
  now() + interval '14 days',
  now(),
  now() + interval '14 days',
  15000,
  'tmoney_moov'
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- 5. RLS & Sécurité sur public.subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture abonnement propre boutique ou super_admin" ON public.subscriptions;
CREATE POLICY "Lecture abonnement propre boutique ou super_admin"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    OR public.get_my_role()::text = 'super_admin'
  );

DROP POLICY IF EXISTS "Insertion abonnement reservee super_admin" ON public.subscriptions;
CREATE POLICY "Insertion abonnement reservee super_admin"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role()::text = 'super_admin');

DROP POLICY IF EXISTS "Mise a jour abonnement reservee super_admin" ON public.subscriptions;
CREATE POLICY "Mise a jour abonnement reservee super_admin"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role()::text = 'super_admin')
  WITH CHECK (public.get_my_role()::text = 'super_admin');

DROP POLICY IF EXISTS "Suppression abonnement reservee super_admin" ON public.subscriptions;
CREATE POLICY "Suppression abonnement reservee super_admin"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (public.get_my_role()::text = 'super_admin');

-- 6. Promotion du compte fondateur en super_admin (à exécuter manuellement dans Supabase SQL Editor) :
-- UPDATE public.profiles
-- SET role = 'super_admin'
-- WHERE id = (
--   SELECT id FROM auth.users WHERE lower(email) = lower('ton_adresse_email@exemple.com')
-- );
