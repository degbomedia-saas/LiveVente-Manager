-- ============================================================
-- MIGRATION 015 — Personnalisation de marque (Nom, Logo, Palette)
-- supabase/migrations/015_store_branding.sql
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Ajouter logo_url et theme_palette sur public.companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS theme_palette TEXT NOT NULL DEFAULT 'indigo';

-- Contrainte sur les palettes autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_theme_palette_check'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_theme_palette_check
      CHECK (theme_palette IN ('indigo', 'emerald', 'terracotta'));
  END IF;
END $$;

-- 2. Bucket Supabase Storage pour les logos boutiques
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques Storage : lecture publique, upload authentifié
DROP POLICY IF EXISTS "store-assets public read" ON storage.objects;
CREATE POLICY "store-assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "store-assets authenticated upload" ON storage.objects;
CREATE POLICY "store-assets authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "store-assets authenticated update" ON storage.objects;
CREATE POLICY "store-assets authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'store-assets');
