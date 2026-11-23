-- Migration 022: Pack Express Live (/live/[store_slug]), Collage WhatsApp + Dictée Groq & Quotas SaaS par forfait

-- 1. Toggle "Afficher dans le Live du jour" sur public.products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_in_live BOOLEAN NOT NULL DEFAULT true;

-- 2. Slug et compteur d'essais IA sur public.stores et public.companies
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS ai_trials_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ai_trials_used INTEGER NOT NULL DEFAULT 0;

-- 3. Quotas configurables par forfait dans public.platform_settings (modifiables dans /admin)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS free_mvp_max_orders_month INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS free_mvp_max_drivers INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS free_mvp_max_ai_trials INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS pro_max_drivers INTEGER NOT NULL DEFAULT 3;

-- 4. Fonctions SECURITY DEFINER pour la mini-page publique /live/[store_slug] (sans connexion)
CREATE OR REPLACE FUNCTION public.get_public_live_store_catalog(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company RECORD;
  v_store RECORD;
  v_products JSONB;
  v_zones JSONB;
BEGIN
  SELECT id, name, slug, logo_url, theme_palette, phone
  INTO v_company
  FROM public.companies
  WHERE lower(slug) = lower(p_slug) OR id::text = p_slug
  LIMIT 1;

  IF v_company.id IS NULL THEN
    SELECT s.id, s.company_id, s.store_name, s.logo_url, s.palette_key, s.whatsapp_phone
    INTO v_store
    FROM public.stores s
    WHERE lower(COALESCE(s.slug, '')) = lower(p_slug) OR s.id::text = p_slug
    LIMIT 1;

    IF v_store.company_id IS NOT NULL THEN
      SELECT id, name, slug, logo_url, theme_palette, phone
      INTO v_company
      FROM public.companies
      WHERE id = v_store.company_id
      LIMIT 1;
    END IF;
  END IF;

  IF v_company.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'price_fcfa', COALESCE(NULLIF(p.price_fcfa, 0), ROUND(p.base_price)::integer),
      'stock_qty', COALESCE(p.stock_qty, 10),
      'category', COALESCE(p.category, 'Mode'),
      'available_sizes', p.available_sizes,
      'available_colors', p.available_colors
    )
  ), '[]'::jsonb)
  INTO v_products
  FROM public.products p
  WHERE p.company_id = v_company.id
    AND p.is_active = true
    AND COALESCE(p.show_in_live, true) = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'zone_name', dz.zone_name,
      'fee_fcfa', dz.fee_fcfa
    )
  ), '[]'::jsonb)
  INTO v_zones
  FROM public.delivery_zones dz
  JOIN public.stores s ON s.id = dz.seller_id
  WHERE s.company_id = v_company.id AND dz.is_active = true;

  RETURN jsonb_build_object(
    'company_id', v_company.id,
    'store_name', v_company.name,
    'slug', v_company.slug,
    'logo_url', v_company.logo_url,
    'palette_key', COALESCE(v_company.theme_palette, 'emerald'),
    'whatsapp_phone', v_company.phone,
    'products', v_products,
    'zones', v_zones
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_live_order(
  p_company_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_zone_name TEXT,
  p_delivery_fee INTEGER,
  p_address_note TEXT,
  p_payment_method TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_order_id UUID;
  v_subtotal INTEGER := 0;
  v_total INTEGER := 0;
  v_item JSONB;
  v_parcel_num TEXT;
BEGIN
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE company_id = p_company_id AND phone = btrim(p_customer_phone)
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (company_id, full_name, phone, city, address)
    VALUES (
      p_company_id,
      COALESCE(NULLIF(btrim(p_customer_name), ''), 'Cliente Live'),
      btrim(p_customer_phone),
      p_zone_name,
      p_address_note
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET
      full_name = COALESCE(NULLIF(btrim(p_customer_name), ''), full_name),
      city = COALESCE(NULLIF(btrim(p_zone_name), ''), city),
      address = COALESCE(NULLIF(btrim(p_address_note), ''), address)
    WHERE id = v_customer_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + (COALESCE((v_item->>'quantity')::integer, 1) * COALESCE((v_item->>'unit_price_fcfa')::integer, 0));
  END LOOP;

  v_total := v_subtotal + GREATEST(0, COALESCE(p_delivery_fee, 0));
  v_parcel_num := '#LIVE-' || upper(substr(md5(random()::text), 1, 4));

  INSERT INTO public.orders (
    company_id,
    customer_id,
    parcel_number,
    order_number,
    source,
    status,
    total_amount,
    delivery_fee,
    delivery_fee_fcfa,
    total_cod_fcfa,
    payment_method,
    address_note,
    notes
  )
  VALUES (
    p_company_id,
    v_customer_id,
    v_parcel_num,
    v_parcel_num,
    'tiktok',
    'pending_confirmation',
    v_total,
    GREATEST(0, COALESCE(p_delivery_fee, 0)),
    GREATEST(0, COALESCE(p_delivery_fee, 0)),
    v_total,
    COALESCE(p_payment_method, 'cash'),
    p_address_note,
    '[CANAL: 🎵 Panier du Live] Quartier: ' || COALESCE(p_zone_name, 'Lomé') ||
      CASE WHEN p_address_note IS NOT NULL AND length(btrim(p_address_note)) > 0 THEN ' | Repère: ' || p_address_note ELSE '' END
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_name,
      quantity,
      unit_price,
      subtotal
    )
    VALUES (
      v_order_id,
      COALESCE(v_item->>'product_name', 'Article Live'),
      GREATEST(1, COALESCE((v_item->>'quantity')::integer, 1)),
      GREATEST(0, COALESCE((v_item->>'unit_price_fcfa')::integer, 0)),
      GREATEST(1, COALESCE((v_item->>'quantity')::integer, 1)) * GREATEST(0, COALESCE((v_item->>'unit_price_fcfa')::integer, 0))
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'parcel_number', v_parcel_num,
    'total_fcfa', v_total
  );
END;
$$;
