-- ==============================================================================
-- LIVEVENTE MANAGER — CONSOLIDATION DES MIGRATIONS MANQUANTES (004 À 012)
-- ==============================================================================
-- Ce script est 100% idempotent (peut être rejoué sans risque et sans perte de données).
-- Instructions : Ouvrez votre console Supabase > SQL Editor > Nouveau script > Collez et cliquez sur "Run".
-- ==============================================================================

-- ── 1. MODULE LIVREURS & ATTRIBUTION (MIGRATION 004) ──────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

CREATE OR REPLACE FUNCTION public.create_courier_profile(
  p_full_name TEXT,
  p_phone     TEXT,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_email     TEXT    DEFAULT NULL,
  p_password  TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id  UUID;
  v_role        public.user_role;
  v_courier_id  UUID;
  v_clean_email TEXT;
BEGIN
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

GRANT EXECUTE ON FUNCTION public.create_courier_profile(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;


-- ── 2. CATALOGUE PRODUITS & ARCHIVAGE (MIGRATIONS 006 & 010) ──────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID           NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name             TEXT           NOT NULL,
  base_price       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  available_sizes  TEXT[]         NOT NULL DEFAULT '{}',
  available_colors TEXT[]         NOT NULL DEFAULT '{}',
  is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_active  ON public.products(company_id, is_active);

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


-- ── 3. ÉCARTS DE CAISSE (MIGRATION 008) ────────────────────────────────────────
ALTER TABLE public.courier_settlements
  ADD COLUMN IF NOT EXISTS difference_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difference_reason TEXT;


-- ── 4. PREUVES DE LIVRAISON & STORAGE (MIGRATION 009) ─────────────────────────
ALTER TABLE public.delivery_proofs
  ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- Bucket Storage pour les preuves photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  DROP POLICY IF EXISTS "delivery_proofs: lecture publique" ON storage.objects;
  CREATE POLICY "delivery_proofs: lecture publique"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'delivery-proofs');

  DROP POLICY IF EXISTS "delivery_proofs: upload authentifie" ON storage.objects;
  CREATE POLICY "delivery_proofs: upload authentifie"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'delivery-proofs'
      AND auth.role() = 'authenticated'
    );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


-- ── 5. RPC COMPLETE_COURIER_DELIVERY (AVEC PREUVE, PHOTO, ACOMPTE & MODES) ─────
CREATE OR REPLACE FUNCTION public.complete_courier_delivery(
  p_delivery_id      UUID,
  p_outcome          TEXT,
  p_collected_amount NUMERIC DEFAULT NULL,
  p_payment_mode     TEXT DEFAULT NULL,
  p_failure_reason   TEXT DEFAULT NULL,
  p_comment          TEXT DEFAULT NULL,
  p_recipient_name   TEXT DEFAULT NULL,
  p_photo_url        TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id    UUID;
  v_role          public.user_role;
  v_order_id      UUID;
  v_status        public.delivery_status;
  v_method        public.payment_method;
  v_proof_note    TEXT;
  v_already_paid  NUMERIC := 0;
  v_order_total   NUMERIC := 0;
  v_due_amount    NUMERIC := 0;
  v_safe_amount   NUMERIC := 0;
  v_recipient     TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié.');
  END IF;

  SELECT company_id, role INTO v_company_id, v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_company_id IS NULL OR v_role <> 'courier' THEN
    RETURN json_build_object('success', false, 'error', 'Action réservée aux livreurs.');
  END IF;

  SELECT order_id, status INTO v_order_id, v_status
  FROM public.deliveries
  WHERE id = p_delivery_id
    AND courier_id = auth.uid()
    AND company_id = v_company_id;

  IF v_order_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Livraison introuvable.');
  END IF;

  IF v_status <> 'in_transit' THEN
    RETURN json_build_object('success', false, 'error', 'La livraison doit d''abord être démarrée.');
  END IF;

  IF p_outcome = 'delivered' THEN
    v_recipient := trim(COALESCE(p_recipient_name, ''));
    IF length(v_recipient) < 2 THEN
      RETURN json_build_object('success', false, 'error', 'Le nom du réceptionnaire est requis (2 caractères min.).');
    END IF;

    SELECT COALESCE(total_amount, 0) INTO v_order_total
    FROM public.orders
    WHERE id = v_order_id AND company_id = v_company_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_already_paid
    FROM public.payments
    WHERE order_id = v_order_id
      AND company_id = v_company_id
      AND status = 'completed';

    v_due_amount := GREATEST(0, v_order_total - v_already_paid);

    IF p_collected_amount IS NOT NULL THEN
      v_safe_amount := GREATEST(0, p_collected_amount);
      IF v_safe_amount > v_due_amount THEN
        RETURN json_build_object(
          'success', false,
          'error', format('Le montant saisi (%s) dépasse le solde restant dû (%s FCFA).', v_safe_amount, v_due_amount)
        );
      END IF;
    ELSE
      v_safe_amount := v_due_amount;
    END IF;

    UPDATE public.deliveries
    SET
      status = 'delivered',
      delivered_at = NOW(),
      failed_reason = NULL,
      updated_at = NOW()
    WHERE id = p_delivery_id
      AND courier_id = auth.uid()
      AND company_id = v_company_id;

    UPDATE public.orders
    SET
      status = 'delivered',
      updated_at = NOW()
    WHERE id = v_order_id
      AND company_id = v_company_id;

    IF v_safe_amount > 0 THEN
      CASE COALESCE(p_payment_mode, 'Espèces')
        WHEN 'Flooz' THEN v_method := 'mobile_money';
        WHEN 'Mixx' THEN v_method := 'mobile_money';
        WHEN 'Virement' THEN v_method := 'bank_transfer';
        WHEN 'mobile_money' THEN v_method := 'mobile_money';
        WHEN 'card' THEN v_method := 'card';
        WHEN 'bank_transfer' THEN v_method := 'bank_transfer';
        ELSE v_method := 'cash';
      END CASE;

      INSERT INTO public.payments (
        company_id,
        order_id,
        amount,
        method,
        status,
        reference,
        paid_at
      ) VALUES (
        v_company_id,
        v_order_id,
        v_safe_amount,
        v_method,
        'completed',
        CASE
          WHEN p_payment_mode IS NOT NULL AND p_payment_mode NOT IN ('cash', 'Espèces')
            THEN format('Livreur: %s', p_payment_mode)
          ELSE 'Livreur: Espèces'
        END,
        NOW()
      );
    END IF;

    v_proof_note := format('Réceptionné par : %s', v_recipient);
    IF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
      v_proof_note := v_proof_note || ' — ' || trim(p_comment);
    END IF;

    INSERT INTO public.delivery_proofs (
      company_id,
      delivery_id,
      recipient_name,
      photo_url,
      notes,
      created_at
    ) VALUES (
      v_company_id,
      p_delivery_id,
      v_recipient,
      NULLIF(trim(COALESCE(p_photo_url, '')), ''),
      v_proof_note,
      NOW()
    );

    RETURN json_build_object(
      'success', true,
      'status', 'delivered',
      'collected_amount', v_safe_amount,
      'remaining_order_due', GREATEST(0, v_due_amount - v_safe_amount),
      'recipient_name', v_recipient
    );

  ELSIF p_outcome = 'failed' THEN
    IF p_failure_reason IS NULL OR length(trim(p_failure_reason)) < 3 THEN
      RETURN json_build_object('success', false, 'error', 'Le motif de l''échec est obligatoire (3 caractères min.).');
    END IF;

    UPDATE public.deliveries
    SET
      status = 'failed',
      failed_reason = CASE
        WHEN p_comment IS NOT NULL AND length(trim(p_comment)) > 0
          THEN trim(p_failure_reason) || ' — ' || trim(p_comment)
        ELSE trim(p_failure_reason)
      END,
      updated_at = NOW()
    WHERE id = p_delivery_id
      AND courier_id = auth.uid()
      AND company_id = v_company_id;

    RETURN json_build_object('success', true, 'status', 'failed');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Résultat de livraison invalide (delivered ou failed attendu).');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_courier_delivery(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ── 6. COORDONNÉES BOUTIQUE ET SETTINGS (MIGRATION 011) ───────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;


-- ── 7. PERMISSIONS RLS POUR LA LECTURE DES COURSES PAR LE LIVREUR (MIGRATION 012)
DROP POLICY IF EXISTS "orders: courier voit ses livraisons" ON public.orders;
CREATE POLICY "orders: courier voit ses livraisons" ON public.orders FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND id IN (
      SELECT order_id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

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

DROP POLICY IF EXISTS "order_items: courier voit les articles de ses livraisons" ON public.order_items;
CREATE POLICY "order_items: courier voit les articles de ses livraisons" ON public.order_items FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND order_id IN (
      SELECT order_id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payments: courier voit les paiements de ses commandes" ON public.payments;
CREATE POLICY "payments: courier voit les paiements de ses commandes" ON public.payments FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND order_id IN (
      SELECT order_id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delivery_proofs: courier voit les siennes" ON public.delivery_proofs;
CREATE POLICY "delivery_proofs: courier voit les siennes" ON public.delivery_proofs FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND delivery_id IN (
      SELECT id FROM public.deliveries WHERE courier_id = auth.uid()
    )
  );

-- ── 9. NUMÉRO DE COLIS JOURNALIER & CYCLE DE COMMANDE (MISSION 8) ────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parcel_number TEXT;

DO $$
BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'packed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'assigned';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
    CHECK (status::text IN ('pending_confirmation', 'confirmed', 'packed', 'assigned', 'in_transit', 'delivered', 'cancelled', 'pending', 'preparing', 'shipped'));
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.get_next_daily_parcel_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_max_num INT;
  v_next_num INT;
BEGIN
  -- Recherche le plus grand numéro de colis pour l'entreprise aujourd'hui ou dernières 24h
  -- en inspectant à la fois la colonne parcel_number et les mentions #XX dans notes
  SELECT COALESCE(
    MAX(
      GREATEST(
        COALESCE(NULLIF(regexp_replace(parcel_number, '\D', '', 'g'), '')::INT, 0),
        COALESCE(NULLIF(substring(notes from '#([0-9]+)'), '')::INT, 0)
      )
    ),
    0
  )
  INTO v_max_num
  FROM public.orders
  WHERE company_id = p_company_id
    AND (created_at >= CURRENT_DATE OR created_at >= (NOW() - INTERVAL '24 hours'));

  v_next_num := v_max_num + 1;
  RETURN '#' || LPAD(v_next_num::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_daily_parcel_number(p_company_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN public.get_next_daily_parcel_number(p_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_orders_company_daily_parcel
  ON public.orders (company_id, created_at, parcel_number)
  WHERE parcel_number IS NOT NULL;

