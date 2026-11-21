-- ============================================================
-- MIGRATION 014 — Invitation autonome des livreurs par email
-- supabase/migrations/014_courier_invitations.sql
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Colonnes d'invitation et de zone sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_email_courier
  ON public.profiles (lower(email))
  WHERE role = 'courier';

-- 2. Fonction sécurisée pour relier un compte auth.users au profil livreur invité
CREATE OR REPLACE FUNCTION public.link_courier_auth_account(
  p_invited_profile_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id UUID;
  v_auth_email TEXT;
  v_target_profile RECORD;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié.');
  END IF;

  SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_id;

  -- Si le profil existe déjà avec l'id auth.uid(), le marquer actif
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_auth_id AND role = 'courier') THEN
    UPDATE public.profiles
    SET invitation_status = 'active',
        email = COALESCE(email, v_auth_email),
        updated_at = NOW()
    WHERE id = v_auth_id;
    RETURN json_build_object('success', true, 'profile_id', v_auth_id);
  END IF;

  -- Chercher le profil invité par ID ou par email
  IF p_invited_profile_id IS NOT NULL THEN
    SELECT * INTO v_target_profile
    FROM public.profiles
    WHERE id = p_invited_profile_id AND role = 'courier'
    LIMIT 1;
  END IF;

  IF v_target_profile IS NULL AND COALESCE(p_email, v_auth_email) IS NOT NULL THEN
    SELECT * INTO v_target_profile
    FROM public.profiles
    WHERE role = 'courier'
      AND lower(email) = lower(COALESCE(p_email, v_auth_email))
    LIMIT 1;
  END IF;

  IF v_target_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Aucun profil livreur correspondant.');
  END IF;

  -- Créer le profil lié à auth.uid() si différent, puis réassigner les livraisons/versements
  IF v_target_profile.id <> v_auth_id THEN
    INSERT INTO public.profiles (
      id, company_id, full_name, phone, role, is_active, email, zone, invitation_status
    ) VALUES (
      v_auth_id,
      v_target_profile.company_id,
      v_target_profile.full_name,
      v_target_profile.phone,
      'courier',
      v_target_profile.is_active,
      COALESCE(v_target_profile.email, v_auth_email),
      v_target_profile.zone,
      'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      role = 'courier',
      email = EXCLUDED.email,
      zone = EXCLUDED.zone,
      invitation_status = 'active',
      updated_at = NOW();

    UPDATE public.deliveries
    SET courier_id = v_auth_id
    WHERE courier_id = v_target_profile.id;

    UPDATE public.courier_settlements
    SET courier_id = v_auth_id
    WHERE courier_id = v_target_profile.id;

    DELETE FROM public.profiles WHERE id = v_target_profile.id;
  ELSE
    UPDATE public.profiles
    SET invitation_status = 'active',
        email = COALESCE(email, v_auth_email),
        updated_at = NOW()
    WHERE id = v_auth_id;
  END IF;

  RETURN json_build_object('success', true, 'profile_id', v_auth_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_courier_auth_account(UUID, TEXT) TO authenticated;
