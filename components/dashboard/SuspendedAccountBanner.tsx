'use client'

import { useState } from 'react'
import { AlertTriangle, Globe, MessageCircle, Smartphone } from 'lucide-react'

type Lang = 'fr' | 'en'

export function SuspendedAccountBanner({
  storeName,
}: {
  storeName?: string
}) {
  const [lang, setLang] = useState<Lang>('fr')

  const whatsappUrl = `https://wa.me/22890000000?text=${encodeURIComponent(
    `Bonjour Kaba Kaba, je souhaite renouveler l'abonnement de ma boutique "${storeName || 'Ma boutique'}" via T-Money / Flooz.`
  )}`

  return (
    <div className="mb-6 rounded-3xl bg-gradient-to-br from-rose-50 via-amber-50 to-white border-2 border-rose-200 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-extrabold uppercase tracking-wider">
              {lang === 'fr' ? 'Mode Lecture Seule' : 'Read-only mode'}
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[#0F172A]">
              {lang === 'fr'
                ? 'Abonnement suspendu — Renouveler par T-Money / Flooz'
                : 'Subscription suspended — Renew via T-Money / Flooz'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-2xl">
              {lang === 'fr'
                ? 'Vos anciennes commandes, clients et bilans financiers restent consultables. Les créations et modifications sont temporairement bloquées jusqu’au renouvellement.'
                : 'Your past orders, customers and financial records remain readable. Creating or editing records is temporarily paused until renewal.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-bold">
            <Globe className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
            <button
              type="button"
              onClick={() => setLang('fr')}
              className={`px-2 py-1 rounded-lg cursor-pointer ${
                lang === 'fr' ? 'bg-[#0F172A] text-white' : 'text-slate-600'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded-lg cursor-pointer ${
                lang === 'en' ? 'bg-[#0F172A] text-white' : 'text-slate-600'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-rose-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Smartphone className="w-4 h-4 text-[#10B981]" />
          <span>
            {lang === 'fr'
              ? 'T-Money / Flooz : envoyez 10 000 FCFA (Pro) puis confirmez sur WhatsApp.'
              : 'T-Money / Flooz: send 10,000 FCFA (Pro) and confirm on WhatsApp.'}
          </span>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white text-xs sm:text-sm font-extrabold shadow-sm transition"
        >
          <MessageCircle className="w-4 h-4" />
          <span>
            {lang === 'fr'
              ? 'Renouveler par T-Money / Flooz'
              : 'Renew via T-Money / Flooz'}
          </span>
        </a>
      </div>
    </div>
  )
}
