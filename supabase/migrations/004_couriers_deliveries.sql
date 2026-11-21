-- ============================================================
-- MIGRATION 004 — Module C : Livreurs, Attribution & Preuves
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Permettre de créer des profils livreurs avec ou sans compte auth.users
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 2. Empêcher handle_new_user de créer une entreprise factice quand skip_auto_profile = true
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id   UUID;
  v_full_name    TEXT;
  v_company_name TEXT;
  v_slug         TEXT;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'skip_auto_profile', '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1), 'Utilisateur');
  v_company_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), ''), 'Entreprise de ' || v_full_name);

  v_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'entreprise'; END IF;
  v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.companies (name, slug)
  VALUES (v_company_name, v_slug)
  RETURNING id INTO v_company_id;

  INSERT INTO public.profiles (id, company_id, full_name, role)
  VALUES (NEW.id, v_company_id, v_full_name, 'owner');

  RETURN NEW;
END;
$$;

-- 3. Policies RLS complémentaires
DROP POLICY IF EXISTS "profiles: owner/employee peut modifier" ON public.profiles;
CREATE POLICY "profiles: owner/employee peut modifier" ON public.profiles FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'employee')
  );

DROP POLICY IF EXISTS "orders: courier voit ses commandes attribuees" ON public.orders;
CREATE POLICY "orders: courier voit ses commandes attribuees" ON public.orders FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND id IN (
      SELECT order_id
      FROM public.deliveries
      WHERE courier_id = auth.uid()
        AND company_id = public.get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "order_items: courier voit ses articles attribues" ON public.order_items;
CREATE POLICY "order_items: courier voit ses articles attribues" ON public.order_items FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND order_id IN (
      SELECT order_id
      FROM public.deliveries
      WHERE courier_id = auth.uid()
        AND company_id = public.get_my_company_id()
    )
  );

-- 4. RPC sécurisé pour créer un livreur (avec ou sans accès /mes-livraisons)
CREATE OR REPLACE FUNCTION public.create_courier_profile(
  p_full_name TEXT,
  p_phone     TEXT,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_email     TEXT DEFAULT NULL,
  p_password  TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_company_id UUID;
  v_role       public.user_role;
  v_courier_id UUID;
  v_clean_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié.');
  END IF;

  SELECT company_id, role INTO v_company_id, v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_company_id IS NULL OR v_role NOT IN ('owner', 'employee') THEN
    RETURN json_build_object('success', false, 'error', 'Permission refusée.');
  END IF;

  v_clean_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');

  IF v_clean_email IS NOT NULL THEN
    IF p_password IS NULL OR length(p_password) < 8 THEN
      RETURN json_build_object('success', false, 'error', 'Mot de passe requis (8 caractères minimum).');
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_clean_email) THEN
      RETURN json_build_object('success', false, 'error', 'Un compte existe déjà avec cet email.');
    END IF;

    v_courier_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_courier_id,
      'authenticated',
      'authenticated',
      v_clean_email,
      crypt(p_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', trim(p_full_name), 'skip_auto_profile', true),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_courier_id,
      v_courier_id::text,
      jsonb_build_object(
        'sub', v_courier_id::text,
        'email', v_clean_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    v_courier_id := gen_random_uuid();
  END IF;

  INSERT INTO public.profiles (id, company_id, full_name, phone, role, is_active)
  VALUES (v_courier_id, v_company_id, trim(p_full_name), trim(p_phone), 'courier', p_is_active);

  RETURN json_build_object('success', true, 'courier_id', v_courier_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_courier_profile(TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  TO authenticated;
