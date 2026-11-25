'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Clock,
  Copy,
  MessageCircle,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import { submitPaywallSubscriptionRequest } from '@/app/actions/step4'

export interface PaywallContextProps {
  plan: 'free_mvp' | 'pro' | 'business'
  storeId: string | null
  storeName: string
  storePhone?: string
  ordersUsed: number
  freeOrdersLimit?: number
  tmoneyPhone: string
  floozPhone: string
  hasPendingRequest?: boolean
  pendingReference?: string | null
}

export function FreeOrdersGaugeBanner({
  paywall,
  onOpenPaywall,
}: {
  paywall: PaywallContextProps
  onOpenPaywall: () => void
}) {
  if (paywall.plan !== 'free_mvp') return null

  const limit = paywall.freeOrdersLimit || 20
  const used = Math.max(0, paywall.ordersUsed)
  const capped = Math.min(limit, used)
  const pct = Math.min(100, Math.round((capped / limit) * 100))
  const isReached = used >= limit
  const isNear = used >= 15 && used < limit

  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 shadow-2xs transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        isReached
          ? 'bg-gradient-to-r from-[#DDE2FF]/70 via-[#FCE0F5]/70 to-white border-indigo-200'
          : isNear
            ? 'bg-amber-50/70 border-amber-200'
            : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                isReached
                  ? 'bg-rose-500 animate-pulse'
                  : isNear
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
            />
            <span className="text-xs font-extrabold text-[#242424] tracking-tight">
              {used} / {limit} commandes gratuites
            </span>
            {paywall.hasPendingRequest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                <Clock className="w-3 h-3" />
                <span>Référence en validation</span>
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold text-slate-600">
            {isReached
              ? 'Quota découverte atteint • Passez en illimité'
              : `${Math.max(0, limit - used)} commande${limit - used > 1 ? 's' : ''} offerte${limit - used > 1 ? 's' : ''} restante${limit - used > 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            style={{ width: `${pct}%` }}
            className={`h-full rounded-full transition-all duration-300 ${
              isReached
                ? 'bg-gradient-to-r from-indigo-600 to-rose-500'
                : isNear
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenPaywall}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#242424] hover:bg-black text-white px-4 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#FCD9B6]" />
        <span>
          {paywall.hasPendingRequest
            ? 'Voir ma demande Pro'
            : isReached
              ? 'Débloquer (5 000 F)'
              : 'Passer en illimité →'}
        </span>
      </button>
    </div>
  )
}

export function InAppPaywallModal({
  isOpen,
  onClose,
  paywall,
  triggerReason = 'quota',
}: {
  isOpen: boolean
  onClose: () => void
  paywall: PaywallContextProps
  triggerReason?: 'quota' | 'bilan' | 'csv' | 'manual'
}) {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly'>(
    'monthly'
  )
  const [mobileMoneyRef, setMobileMoneyRef] = useState(
    paywall.pendingReference ?? ''
  )
  const [senderPhone, setSenderPhone] = useState(paywall.storePhone ?? '')
  const [copiedChannel, setCopiedChannel] = useState<'tmoney' | 'flooz' | null>(
    null
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submittedRef, setSubmittedRef] = useState<string | null>(
    paywall.pendingReference ?? null
  )
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const limit = paywall.freeOrdersLimit || 20
  const isQuotaBlocking =
    paywall.plan === 'free_mvp' && paywall.ordersUsed >= limit

  const selectedAmountLabel =
    billingCycle === 'monthly' ? '5 000 FCFA / mois' : '15 000 FCFA / 3 mois'

  const cleanWaSupportDigits =
    paywall.tmoneyPhone.replace(/\D/g, '').length >= 8
      ? paywall.tmoneyPhone.replace(/\D/g, '').startsWith('228')
        ? paywall.tmoneyPhone.replace(/\D/g, '')
        : `228${paywall.tmoneyPhone.replace(/\D/g, '')}`
      : '22890123456'

  const storeIdLabel = paywall.storeId || 'N/A'
  const refLabel = mobileMoneyRef.trim() || submittedRef || 'En cours'

  const whatsappText = `Bonjour Kaba Kaba 👋, je viens d'effectuer mon transfert Mobile Money pour activer le forfait Pro (${selectedAmountLabel}).
• Boutique : ${paywall.storeName}
• ID Boutique : ${storeIdLabel}
• Référence transfert : ${refLabel}
Voici ma preuve de paiement.`

  const whatsappUrl = `https://wa.me/${cleanWaSupportDigits}?text=${encodeURIComponent(
    whatsappText
  )}`

  function handleCopyNumber(channel: 'tmoney' | 'flooz', rawNumber: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(rawNumber)
      setCopiedChannel(channel)
      setTimeout(() => {
        setCopiedChannel((prev) => (prev === channel ? null : prev))
      }, 2200)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    setErrorMsg(null)

    startTransition(async () => {
      const res = await submitPaywallSubscriptionRequest({
        billingCycle,
        mobileMoneyRef,
        phone: senderPhone,
      })

      if ('error' in res && res.error) {
        setErrorMsg(res.error)
        return
      }

      if ('reference' in res && res.reference) {
        setSubmittedRef(res.reference)
      }
      router.refresh()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
    >
      <div className="relative w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl">
        {/* En-tête dégradé Kaba Kaba */}
        <div
          style={{
            background:
              'linear-gradient(125deg, #C7D2FE 0%, #DFDBFF 42%, #FCE0F5 100%)',
          }}
          className="px-6 pt-6 pb-5 text-[#242424] relative"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[11px] font-extrabold text-[#242424] shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {paywall.ordersUsed} / {limit} commandes gratuites
              </span>
            </span>

            {!isQuotaBlocking && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="rounded-full bg-white/70 hover:bg-white p-1.5 text-[#242424] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <h2
            id="paywall-modal-title"
            className="mt-3 text-xl sm:text-2xl font-black tracking-tight text-[#242424] leading-snug"
          >
            Vos 20 premières commandes sont bouclées ! 🎉
          </h2>

          <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
            {triggerReason === 'csv'
              ? 'Débloquez l’export CSV comptable et les commandes illimitées pour votre boutique.'
              : triggerReason === 'bilan'
                ? 'Débloquez le Bilan de caisse du soir en 1 clic et les commandes illimitées.'
                : 'Félicitations pour votre activité à Lomé ! Toutes vos commandes restent sauvegardées. Activez votre forfait Pro pour continuer en illimité.'}
          </p>
        </div>

        {/* Corps de la modale */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* 1. Offre mise en avant : 5 000 FCFA / mois ou 15 000 FCFA / 3 mois */}
          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              1. Choisissez votre formule (sans engagement • T-Money ou Flooz)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`text-left rounded-2xl border-2 p-3.5 transition cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'border-[#242424] bg-[#EFF4FF]/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Mensuel • Populaire
                  </span>
                  <span
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      billingCycle === 'monthly'
                        ? 'border-[#242424] bg-[#242424] text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {billingCycle === 'monthly' && (
                      <Check className="w-2.5 h-2.5" />
                    )}
                  </span>
                </div>
                <p className="mt-1 text-lg font-black text-[#242424]">
                  5 000 FCFA{' '}
                  <span className="text-xs font-bold text-slate-600">
                    / mois
                  </span>
                </p>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Sans engagement • T-Money ou Flooz
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle('quarterly')}
                className={`text-left rounded-2xl border-2 p-3.5 transition cursor-pointer ${
                  billingCycle === 'quarterly'
                    ? 'border-[#242424] bg-[#F6F4EF] shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                    Pack 3 Mois
                  </span>
                  <span
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      billingCycle === 'quarterly'
                        ? 'border-[#242424] bg-[#242424] text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {billingCycle === 'quarterly' && (
                      <Check className="w-2.5 h-2.5" />
                    )}
                  </span>
                </div>
                <p className="mt-1 text-lg font-black text-[#242424]">
                  15 000 FCFA{' '}
                  <span className="text-xs font-bold text-slate-600">
                    / 3 mois
                  </span>
                </p>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  90 jours continus • T-Money ou Flooz
                </p>
              </button>
            </div>
          </div>

          {/* 2. Copie en 1 clic des numéros marchands T-Money & Flooz */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                <Smartphone className="w-4 h-4 text-[#242424]" />
                <span>2. Numéros marchands (Copie en 1 clic)</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">
                {billingCycle === 'monthly' ? '5 000 FCFA' : '15 000 FCFA'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* T-Money */}
              <div className="rounded-xl bg-white border border-amber-200 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase text-amber-700">
                    T-Money (Togocom)
                  </p>
                  <p className="text-sm font-black text-slate-900 tabular-nums truncate mt-0.5">
                    {paywall.tmoneyPhone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyNumber('tmoney', paywall.tmoneyPhone)
                  }
                  className={`shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    copiedChannel === 'tmoney'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {copiedChannel === 'tmoney' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>

              {/* Flooz */}
              <div className="rounded-xl bg-white border border-sky-200 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase text-sky-700">
                    Flooz (Moov Africa)
                  </p>
                  <p className="text-sm font-black text-slate-900 tabular-nums truncate mt-0.5">
                    {paywall.floozPhone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyNumber('flooz', paywall.floozPhone)}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    copiedChannel === 'flooz'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200'
                  }`}
                >
                  {copiedChannel === 'flooz' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Validation de la référence Mobile Money -> subscription_requests */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              3. Validez votre référence de transfert
            </p>

            {submittedRef && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-start gap-2.5 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">
                    Référence transmise à l&apos;équipe Kaba Kaba !
                  </p>
                  <p className="mt-0.5 text-emerald-800">
                    Réf : <strong className="font-mono">{submittedRef}</strong>.
                    Vous pouvez aussi envoyer votre capture sur WhatsApp pour
                    une activation express.
                  </p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              <div className="sm:col-span-3">
                <label
                  htmlFor="paywall-momo-ref"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Référence SMS T-Money / Flooz *
                </label>
                <input
                  id="paywall-momo-ref"
                  type="text"
                  required
                  value={mobileMoneyRef}
                  onChange={(e) => setMobileMoneyRef(e.target.value)}
                  placeholder="Ex : TM-94827104 ou ID transaction"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="paywall-sender-phone"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Votre numéro (+228)
                </label>
                <input
                  id="paywall-sender-phone"
                  type="tel"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="+228 90 12 34 56"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#242424] hover:bg-black disabled:opacity-50 text-white py-3.5 px-5 text-xs sm:text-sm font-extrabold shadow-md transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isPending
                  ? 'Enregistrement en cours...'
                  : submittedRef
                    ? 'Mettre à jour ma référence Mobile Money'
                    : 'Valider ma référence Mobile Money →'}
              </span>
            </button>
          </form>

          {/* Bouton secondaire WhatsApp pré-rempli avec nom et ID boutique */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 py-3 px-4 text-xs sm:text-sm font-extrabold transition"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Envoyer ma preuve sur WhatsApp</span>
            </a>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>
                Boutique : <strong className="text-slate-700">{paywall.storeName}</strong>
                {paywall.storeId ? ` (#${paywall.storeId.slice(0, 8)})` : ''}
              </span>

              <button
                type="button"
                onClick={onClose}
                className="font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                {isQuotaBlocking
                  ? 'Consulter mes commandes en lecture seule'
                  : 'Plus tard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
