-- ============================================================
-- MIGRATION 009 — Preuve de livraison (Réceptionnaire & Photo de preuve)
-- À exécuter dans : Supabase > SQL Editor > Run
-- Migration non destructive et rétrocompatible
-- ============================================================

-- 1. Ajout de la colonne recipient_name sur delivery_proofs
ALTER TABLE public.delivery_proofs
  ADD COLUMN IF NOT EXISTS recipient_name TEXT;

COMMENT ON COLUMN public.delivery_proofs.recipient_name IS
  'Nom complet de la personne ayant réceptionné le colis.';

-- 2. Configuration du bucket Supabase Storage pour les photos de preuve
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Policies de sécurité Storage pour delivery-proofs
DO $$
BEGIN
  -- Permettre la lecture publique des preuves de livraison
  DROP POLICY IF EXISTS "delivery_proofs: lecture publique" ON storage.objects;
  CREATE POLICY "delivery_proofs: lecture publique"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'delivery-proofs');

  -- Permettre aux utilisateurs authentifiés d'uploader des photos de preuve
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

-- 3. Mise à jour de la fonction RPC complete_courier_delivery pour intégrer récepteur et photo
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

    -- Récupérer le montant total de la commande
    SELECT total_amount INTO v_order_total
    FROM public.orders
    WHERE id = v_order_id AND company_id = v_company_id;

    -- Calculer ce qui a déjà été payé sur cette commande (ex: acompte à la boutique)
    SELECT COALESCE(SUM(amount), 0) INTO v_already_paid
    FROM public.payments
    WHERE order_id = v_order_id
      AND company_id = v_company_id
      AND status = 'completed';

    v_due_amount := GREATEST(0, v_order_total - v_already_paid);
    v_safe_amount := COALESCE(p_collected_amount, 0);

    IF v_due_amount > 0 AND v_safe_amount <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'Veuillez saisir le montant encaissé.');
    END IF;

    IF v_safe_amount > 0 THEN
      IF p_payment_mode NOT IN ('Espèces', 'Flooz', 'Mixx', 'Virement', 'Autre') THEN
        RETURN json_build_object('success', false, 'error', 'Mode de paiement invalide.');
      END IF;

      v_method := CASE
        WHEN p_payment_mode = 'Espèces' THEN 'cash'::public.payment_method
        WHEN p_payment_mode IN ('Flooz', 'Mixx') THEN 'mobile_money'::public.payment_method
        WHEN p_payment_mode = 'Virement' THEN 'bank_transfer'::public.payment_method
        ELSE 'cash'::public.payment_method
      END;
    END IF;

    UPDATE public.deliveries
    SET status = 'delivered',
        delivered_at = NOW(),
        failed_reason = NULL
    WHERE id = p_delivery_id
      AND courier_id = auth.uid()
      AND company_id = v_company_id;

    UPDATE public.orders
    SET status = 'delivered'
    WHERE id = v_order_id
      AND company_id = v_company_id;

    v_proof_note := 'Réceptionné par: ' || v_recipient;
    IF v_safe_amount > 0 THEN
      v_proof_note := v_proof_note || ' — Encaissé: ' || p_payment_mode || ' (' || v_safe_amount || ' FCFA)';
    ELSE
      v_proof_note := v_proof_note || ' — Commande déjà réglée à la boutique';
    END IF;

    INSERT INTO public.delivery_proofs (
      company_id,
      delivery_id,
      recipient_name,
      photo_url,
      notes
    ) VALUES (
      v_company_id,
      p_delivery_id,
      v_recipient,
      NULLIF(trim(COALESCE(p_photo_url, '')), ''),
      v_proof_note
    );

    IF v_safe_amount > 0 THEN
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
        'Livreur: ' || p_payment_mode,
        NOW()
      );
    END IF;

    RETURN json_build_object('success', true);

  ELSIF p_outcome = 'failed' THEN
    IF p_failure_reason IS NULL OR length(trim(p_failure_reason)) = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Motif d''échec obligatoire.');
    END IF;

    v_proof_note := trim(p_failure_reason);
    IF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
      v_proof_note := v_proof_note || ' — ' || trim(p_comment);
    END IF;

    UPDATE public.deliveries
    SET status = 'failed',
        failed_reason = v_proof_note
    WHERE id = p_delivery_id
      AND courier_id = auth.uid()
      AND company_id = v_company_id;

    INSERT INTO public.delivery_proofs (company_id, delivery_id, notes)
    VALUES (v_company_id, p_delivery_id, v_proof_note);

    RETURN json_build_object('success', true);
  END IF;

  RETURN json_build_object('success', false, 'error', 'Résultat invalide.');
END;
$$;

-- Accord des droits d'exécution sur la nouvelle signature
GRANT EXECUTE ON FUNCTION public.complete_courier_delivery(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
