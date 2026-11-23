'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Compass, Globe, Home, RefreshCw } from 'lucide-react'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

type Lang = 'fr' | 'en'

export default function NotFound() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')

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
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#0F172A] text-[#10B981] flex items-center justify-center shadow-lg">
            <Compass className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/80 border border-white text-xs font-extrabold text-[#0F172A]">
            <span>404</span>
            <span>•</span>
            <span>
              {lang === 'fr' ? 'Page introuvable' : 'Page not found'}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A]">
              {lang === 'fr'
                ? 'Oups ! Ce colis a changé d’adresse'
                : 'Oops! This parcel moved to another address'}
            </h1>
            <p className="text-sm sm:text-base font-medium text-slate-700 leading-relaxed">
              {lang === 'fr'
                ? 'La page que vous cherchez n’existe pas ou a été déplacée.'
                : 'The page you are looking for does not exist or has been moved.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-extrabold shadow-md hover:-translate-y-0.5 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Réessayer' : 'Try again'}</span>
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-extrabold shadow-md hover:-translate-y-0.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Retour' : 'Go back'}</span>
            </button>

            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/90 hover:bg-white text-[#0F172A] border border-slate-200/80 text-sm font-bold transition"
            >
              <Home className="w-4 h-4 text-[#10B981]" />
              <span>{lang === 'fr' ? 'Accueil' : 'Home'}</span>
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Kaba Kaba — Lomé, Togo
      </footer>
    </div>
  )
}
