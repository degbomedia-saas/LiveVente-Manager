-- ============================================================
-- MIGRATION 005 — Finalisation livraisons & Module E (Paiements)
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Policies RLS strictes pour le rôle courier sur payments & orders
DROP POLICY IF EXISTS "payments: courier voit les siens" ON public.payments;
CREATE POLICY "payments: courier voit les siens" ON public.payments FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND order_id IN (
      SELECT order_id FROM public.deliveries
      WHERE courier_id = auth.uid()
        AND company_id = public.get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "payments: courier peut creer" ON public.payments;
CREATE POLICY "payments: courier peut creer" ON public.payments FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND order_id IN (
      SELECT order_id FROM public.deliveries
      WHERE courier_id = auth.uid()
        AND company_id = public.get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "orders: courier peut livrer" ON public.orders;
CREATE POLICY "orders: courier peut livrer" ON public.orders FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'courier'
    AND id IN (
      SELECT order_id FROM public.deliveries
      WHERE courier_id = auth.uid()
        AND company_id = public.get_my_company_id()
    )
  );

-- 2. RPC atomique de finalisation d'une livraison par le livreur
CREATE OR REPLACE FUNCTION public.complete_courier_delivery(
  p_delivery_id      UUID,
  p_outcome          TEXT,
  p_collected_amount NUMERIC DEFAULT NULL,
  p_payment_mode     TEXT DEFAULT NULL,
  p_failure_reason   TEXT DEFAULT NULL,
  p_comment          TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_role       public.user_role;
  v_order_id   UUID;
  v_status     public.delivery_status;
  v_method     public.payment_method;
  v_proof_note TEXT;
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
    IF p_collected_amount IS NULL OR p_collected_amount <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'Le montant encaissé doit être supérieur à 0.');
    END IF;

    IF p_payment_mode NOT IN ('Espèces', 'Mixx', 'Flooz') THEN
      RETURN json_build_object('success', false, 'error', 'Mode de paiement invalide.');
    END IF;

    v_method := CASE
      WHEN p_payment_mode = 'Espèces' THEN 'cash'::public.payment_method
      ELSE 'mobile_money'::public.payment_method
    END;

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

    INSERT INTO public.delivery_proofs (company_id, delivery_id, notes)
    VALUES (
      v_company_id,
      p_delivery_id,
      'Livraison réussie — ' || p_payment_mode || ' (' || p_collected_amount || ' FCFA)'
    );

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
      p_collected_amount,
      v_method,
      'completed',
      p_payment_mode,
      NOW()
    );

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

GRANT EXECUTE ON FUNCTION public.complete_courier_delivery(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT)
  TO authenticated;
