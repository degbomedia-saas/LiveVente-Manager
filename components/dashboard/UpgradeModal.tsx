'use client'

import { Check, MessageCircle, Smartphone, Sparkles, X } from 'lucide-react'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  companyName: string
  monthlyPrice?: number
}

export function UpgradeModal({
  isOpen,
  onClose,
  companyName,
  monthlyPrice = 15000,
}: UpgradeModalProps) {
  if (!isOpen) return null

  const formattedPrice = new Intl.NumberFormat('fr-FR').format(monthlyPrice)
  const whatsappMessage = `Bonjour Kaba Kaba, je viens d'effectuer le règlement de ${formattedPrice} FCFA via T-Money / Moov pour activer la Formule Pro de ma boutique "${companyName}". Voici ma capture de preuve de paiement.`
  const whatsappUrl = `https://wa.me/22890000000?text=${encodeURIComponent(
    whatsappMessage
  )}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* En-tête */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
              <Sparkles className="w-3 h-3" />
              <span>FORMULE PRO ILLIMITÉE</span>
            </div>
            <h2 id="upgrade-modal-title" className="text-lg font-bold">
              Activer ou renouveler votre boutique
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Boutique : <strong className="text-white">{companyName}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-5">
          <div className="flex items-baseline justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Tarif mensuel tout inclus
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Activation immédiate après confirmation
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {formattedPrice}
              </span>
              <span className="text-xs font-semibold text-slate-600 ml-1">
                FCFA / mois
              </span>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Commandes, clients et produits illimités</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Livreurs moto illimités + espace mobile dédié</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Clôture de caisse T-Money / Moov / Cash &amp; preuves photo</span>
            </li>
          </ul>

          {/* Coordonnées de paiement Lomé */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Smartphone className="w-4 h-4 text-slate-700" />
              <span>Règlement rapide à Lomé</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
              <div className="rounded-lg bg-white border border-slate-200 p-3">
                <p className="text-xs font-semibold text-amber-700">
                  T-Money (Togocom)
                </p>
                <p className="font-bold text-slate-900 mt-0.5 tabular-nums">
                  +228 90 00 00 00
                </p>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 p-3">
                <p className="text-xs font-semibold text-blue-700">
                  Moov Money (Flooz)
                </p>
                <p className="font-bold text-slate-900 mt-0.5 tabular-nums">
                  +228 96 00 00 00
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Envoyer la preuve sur WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
