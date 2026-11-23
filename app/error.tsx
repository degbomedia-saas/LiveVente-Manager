'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Globe, RefreshCw } from 'lucide-react'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'
import { createClient } from '@/lib/supabase/client'

type Lang = 'fr' | 'en'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    try {
      const supabase = createClient()
      void supabase.rpc('log_system_error', {
        p_level: 'error',
        p_source: 'app/error.tsx',
        p_message: error?.message || 'Client route boundary error',
        p_metadata: {
          digest: error?.digest ?? null,
          pathname:
            typeof window !== 'undefined' ? window.location.pathname : null,
        },
      })
    } catch {
      // Ignore logging errors
    }
  }, [error])

  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col justify-between px-4 py-6 sm:px-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <KabaKabaLogo light className="h-9 w-auto" />
        </Link>

        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
          <Globe className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
          <button
            type="button"
            onClick={() => setLang('fr')}
            className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
              lang === 'fr'
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
              lang === 'en'
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>
      </header>

      <main className="max-w-xl w-full mx-auto my-auto py-10">
        <div className="rounded-[32px] bg-gradient-to-br from-[#C7D2FE] via-[#E9D5FF] to-[#FCE0F5] p-6 sm:p-10 shadow-xl border border-white/80 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#0F172A] text-amber-400 flex items-center justify-center shadow-lg">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/80 border border-white text-xs font-extrabold text-[#0F172A]">
            <span>
              {lang === 'fr' ? 'Incident temporaire' : 'Temporary issue'}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A]">
              {lang === 'fr'
                ? 'Une erreur inattendue est survenue'
                : 'An unexpected error occurred'}
            </h1>
            <p className="text-sm sm:text-base font-medium text-slate-700 leading-relaxed">
              {lang === 'fr'
                ? 'Pas d’inquiétude, vos commandes et votre caisse Kaba Kaba sont intactes. Vous pouvez réessayer immédiatement.'
                : 'Do not worry, your orders and Kaba Kaba cash register are safe. You can try again right away.'}
            </p>
            {error?.digest && (
              <p className="text-xs font-mono text-slate-500 pt-1">
                Réf: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-extrabold shadow-md hover:-translate-y-0.5 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Réessayer' : 'Try again'}</span>
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-extrabold shadow-md hover:-translate-y-0.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Retour' : 'Go back'}</span>
            </button>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Kaba Kaba — Lomé, Togo
      </footer>
    </div>
  )
}
