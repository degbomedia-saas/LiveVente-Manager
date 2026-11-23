-- ============================================================
-- MIGRATION 023 — Mode Maintenance & Journaux Système (system_logs)
-- supabase/migrations/023_maintenance_and_system_logs.sql
-- À exécuter dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Colonnes de maintenance globale sur platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS is_maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'Maintenance technique en cours sur Kaba Kaba. Nous revenons très vite ! / Scheduled maintenance in progress. We will be right back!';

-- 2. Table system_logs pour tracer les erreurs serveur (visible uniquement par Super Admin)
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('info', 'warning', 'error', 'critical')),
  source TEXT NOT NULL DEFAULT 'server',
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
  ON public.system_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_level
  ON public.system_logs (level);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS : Lecture et suppression réservées exclusivement aux administrateurs (super_admin / admin)
DROP POLICY IF EXISTS "system_logs_admin_select" ON public.system_logs;
CREATE POLICY "system_logs_admin_select"
  ON public.system_logs
  FOR SELECT
  USING (public.get_my_role()::text IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "system_logs_admin_insert" ON public.system_logs;
CREATE POLICY "system_logs_admin_insert"
  ON public.system_logs
  FOR INSERT
  WITH CHECK (public.get_my_role()::text IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "system_logs_admin_delete" ON public.system_logs;
CREATE POLICY "system_logs_admin_delete"
  ON public.system_logs
  FOR DELETE
  USING (public.get_my_role()::text IN ('super_admin', 'admin'));

-- Fonction SECURITY DEFINER permettant aux routes serveur / actions d'enregistrer une erreur système
-- sans exposer la lecture de system_logs aux utilisateurs non-admin
CREATE OR REPLACE FUNCTION public.log_system_error(
  p_level TEXT DEFAULT 'error',
  p_source TEXT DEFAULT 'server',
  p_message TEXT DEFAULT 'Unexpected server error',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.system_logs (level, source, message, metadata, user_id)
  VALUES (
    CASE WHEN p_level IN ('info', 'warning', 'error', 'critical') THEN p_level ELSE 'error' END,
    COALESCE(NULLIF(trim(p_source), ''), 'server'),
    COALESCE(NULLIF(trim(p_message), ''), 'Unexpected server error'),
    COALESCE(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_system_error(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
