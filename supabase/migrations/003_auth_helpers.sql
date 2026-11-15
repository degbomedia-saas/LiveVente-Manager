-- ============================================================
-- MIGRATION 003 — Fonction d'aide à l'inscription
-- Appliquer APRÈS 001 et 002
-- ============================================================

-- Cette fonction crée automatiquement une company + un profil owner
-- lors de l'inscription. Elle utilise SECURITY DEFINER pour contourner
-- le RLS (car l'utilisateur n'a pas encore de profil à ce moment).

CREATE OR REPLACE FUNCTION public.create_company_and_profile(
  p_full_name    TEXT,
  p_company_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_slug       TEXT;
BEGIN
  -- Vérifie qu'un utilisateur est bien connecté
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  -- Vérifie qu'un profil n'existe pas déjà pour cet utilisateur
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Un profil existe déjà pour cet utilisateur';
  END IF;

  -- Génère un slug unique à partir du nom de l'entreprise
  v_slug := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := rtrim(v_slug, '-');
  v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);

  -- Crée l'entreprise
  INSERT INTO public.companies (name, slug)
  VALUES (p_company_name, v_slug)
  RETURNING id INTO v_company_id;

  -- Crée le profil owner lié à auth.users
  INSERT INTO public.profiles (id, company_id, full_name, role)
  VALUES (auth.uid(), v_company_id, p_full_name, 'owner');

  RETURN json_build_object(
    'success',    true,
    'company_id', v_company_id,
    'slug',       v_slug
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error',   SQLERRM
    );
END;
$$;

-- Autorise les utilisateurs authentifiés à appeler cette fonction
GRANT EXECUTE ON FUNCTION public.create_company_and_profile(TEXT, TEXT)
  TO authenticated;
