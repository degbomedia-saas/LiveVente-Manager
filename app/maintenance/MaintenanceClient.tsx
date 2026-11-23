'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Globe, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

type Lang = 'fr' | 'en'

export function MaintenanceClient({
  saasName,
  saasLogoUrl,
  maintenanceMessage,
}: {
  saasName: string
  saasLogoUrl: string | null
  maintenanceMessage: string | null
}) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')
  const [checking, setChecking] = useState(false)

  const defaultFr =
    'Nous effectuons une mise à jour rapide pour améliorer vos ventes et livraisons sur Kaba Kaba.Vos données et commandes sont en sécurité.'
  const defaultEn =
    'We are performing a quick upgrade to improve your sales and deliveries on Kaba Kaba. Your data and orders are completely safe.'

  function handleRetry() {
    setChecking(true)
    router.refresh()
    setTimeout(() => {
      window.location.href = '/'
    }, 450)
  }

  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col justify-between px-4 py-6 sm:px-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {saasLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={saasLogoUrl}
              alt={saasName}
              className="h-9 w-9 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <KabaKabaLogo light className="h-9 w-auto" />
          )}
          <span className="text-lg font-black tracking-tight text-[#0F172A]">
            {saasName}
          </span>
        </div>

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
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#0F172A] text-[#10B981] flex items-center justify-center shadow-lg">
            <Wrench className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-white text-xs font-extrabold text-[#0F172A]">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span>
              {lang === 'fr'
                ? 'Maintenance programmée en cours'
                : 'Scheduled maintenance in progress'}
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A]">
              {lang === 'fr'
                ? `${saasName} revient dans quelques instants`
                : `${saasName} will be right back`}
            </h1>
            <p className="text-sm sm:text-base font-medium text-slate-700 leading-relaxed bg-white/75 backdrop-blur-xs rounded-2xl p-4 border border-white/80">
              {maintenanceMessage?.trim()
                ? maintenanceMessage
                : lang === 'fr'
                  ? defaultFr
                  : defaultEn}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRetry}
              disabled={checking}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-extrabold shadow-md hover:-translate-y-0.5 transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`}
              />
              <span>
                {lang === 'fr'
                  ? 'Vérifier la disponibilité'
                  : 'Check availability'}
              </span>
            </button>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/90 hover:bg-white text-[#0F172A] border border-slate-200/80 text-sm font-bold transition"
            >
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span>
                {lang === 'fr' ? 'Accès Administrateur' : 'Admin Sign In'}
              </span>
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {saasName} — Lomé, Togo
      </footer>
    </div>
  )
}
