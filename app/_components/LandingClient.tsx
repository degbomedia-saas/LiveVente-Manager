'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Bike,
  Check,
  CheckCircle2,
  Globe,
  MapPin,
  PhoneCall,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

type Lang = 'fr' | 'en'

const COPY = {
  fr: {
    navFeatures: 'Fonctionnalités',
    navPricing: 'Tarifs',
    login: 'Se connecter',
    signup: 'Ouvrir un compte',
    badge: 'Lomé (+228) & Afrique • TikTok • WhatsApp • Instagram',
    heroTitle1: 'Domptez vos livraisons et votre caisse ',
    heroTitleHighlight: 'sans perdre un seul franc.',
    heroSubtitle:
      'La plateforme mobile-first pensée pour les vendeurs TikTok, WhatsApp et Instagram à Lomé. Générez vos étiquettes QR, suivez vos livreurs moto et réconciliez T-Money, Flooz et Espèces en temps réel.',
    whatsappPlaceholder: '90 12 34 56',
    whatsappCta: 'Ouvrir un compte',
    whatsappHint: 'Démarrez gratuitement avec votre numéro WhatsApp (+228) • Sans carte bancaire',
    ctaSecondary: 'Se connecter à mon espace',
    socialProof: 'Adopté par +42 boutiques à Déckon, Hedzranawoé, Tokoin et Agoè.',
    floatingTitle: 'Recettes du jour',
    floatingSub: 'Caisse réconciliée • 100 %',
    floatingTrend: '+24 % vs hier',
    phoneHeader: 'Commande #KK-228-849',
    phoneLive: 'En livraison • Lomé',
    phoneCustomer: 'Afiwa K. (+228 90 45 •• ••)',
    phoneSource: 'TikTok Live • WhatsApp',
    phoneLandmark: 'Face pharmacie Nation, Tokoin',
    phoneItem: 'Robe Wax Royale + Sac',
    phoneQrLabel: 'Étiquette QR Colis',
    phoneQrHint: 'Scannée au départ & à la remise',
    painTag: 'Réalité du terrain',
    painTitle: 'Ce qui bloque votre croissance chaque semaine',
    pains: [
      {
        title: 'Le livreur injoignable avec votre recette',
        desc: 'Suivez en temps réel chaque colis remis au coursier et le montant net exact qu’il doit vous reverser le soir.',
      },
      {
        title: 'La cliente qui annule au portail',
        desc: 'Statut « À confirmer » avant départ + étiquette QR pour éliminer les déplacements moto à perte.',
      },
      {
        title: 'Le casse-tête Flooz, T-Money et Cash',
        desc: 'Séparation nette en un clic entre paiements mobiles directs et espèces encaissées à la livraison.',
      },
    ],
    pricingTag: 'Tarifs transparents en FCFA',
    pricingTitle: 'Choisissez la formule adaptée à votre volume',
    pricingSubtitle: 'Démarrez gratuitement en 2 minutes. Évoluez quand vos ventes décollent.',
    plans: [
      {
        name: 'MVP Gratuit',
        price: '0 F',
        period: '/ mois',
        desc: 'Pour tester Kaba Kaba et structurer vos premières livraisons.',
        popular: false,
        features: [
          'Jusqu’à 30 commandes / mois',
          '1 boutique & 1 livreur moto',
          'Suivi Espèces, T-Money & Flooz',
          'Étiquette colis standard',
        ],
      },
      {
        name: 'Pro',
        price: '10 000 F',
        period: '/ mois',
        desc: 'Pour les vendeurs actifs sur TikTok, WhatsApp et Instagram.',
        popular: true,
        badge: 'POPULAIRE',
        features: [
          'Commandes & clients illimités',
          'Jusqu’à 5 livreurs + espace mobile',
          'Étiquettes QR & preuves photo',
          'Bilan de caisse quotidien',
        ],
      },
      {
        name: 'Business',
        price: '25 000 F',
        period: '/ mois',
        desc: 'Pour les grandes boutiques, marques et flottes de livraison.',
        popular: false,
        features: [
          'Tout le plan Pro en illimité',
          'Livreurs & employés illimités',
          'Rapports analytiques & export CSV',
          'Support prioritaire WhatsApp (+228)',
        ],
      },
    ],
    footerText: 'Conçu à Lomé pour les entrepreneurs du social commerce.',
  },
  en: {
    navFeatures: 'Features',
    navPricing: 'Pricing',
    login: 'Sign in',
    signup: 'Open an account',
    badge: 'Lomé (+228) & Africa • TikTok • WhatsApp • Instagram',
    heroTitle1: 'Master your deliveries and daily cash ',
    heroTitleHighlight: 'without losing a single franc.',
    heroSubtitle:
      'The mobile-first platform built for TikTok, WhatsApp, and Instagram sellers in Lomé. Generate QR parcel labels, track motorbike couriers, and reconcile T-Money, Flooz, and Cash in real time.',
    whatsappPlaceholder: '90 12 34 56',
    whatsappCta: 'Open an account',
    whatsappHint: 'Start for free with your WhatsApp number (+228) • No credit card required',
    ctaSecondary: 'Sign in to my account',
    socialProof: 'Trusted by 42+ stores across Déckon, Hedzranawoé, Tokoin, and Agoè.',
    floatingTitle: 'Today’s Revenue',
    floatingSub: 'Cash reconciled • 100%',
    floatingTrend: '+24% vs yesterday',
    phoneHeader: 'Order #KK-228-849',
    phoneLive: 'In transit • Lomé',
    phoneCustomer: 'Afiwa K. (+228 90 45 •• ••)',
    phoneSource: 'TikTok Live • WhatsApp',
    phoneLandmark: 'Opposite Nation Pharmacy, Tokoin',
    phoneItem: 'Royal Wax Dress + Bag',
    phoneQrLabel: 'Parcel QR Label',
    phoneQrHint: 'Scanned at dispatch & doorstep delivery',
    painTag: 'Field reality',
    painTitle: 'What holds back your daily sales growth',
    pains: [
      {
        title: 'Unreachable couriers holding your cash',
        desc: 'Track every parcel assigned to riders and know the exact net cash amount owed at the end of the day.',
      },
      {
        title: 'Last-minute doorstep cancellations',
        desc: 'Pre-dispatch confirmation workflow + QR parcel tags to stop wasted courier trips.',
      },
      {
        title: 'Flooz, T-Money & Cash confusion',
        desc: 'One-click separation between mobile money transfers and cash collected on delivery.',
      },
    ],
    pricingTag: 'Transparent FCFA Pricing',
    pricingTitle: 'Pick the plan that fits your order volume',
    pricingSubtitle: 'Start for free in 2 minutes. Upgrade as your social sales scale.',
    plans: [
      {
        name: 'Free MVP',
        price: '0 F',
        period: '/ month',
        desc: 'To test Kaba Kaba and organize your first deliveries.',
        popular: false,
        features: [
          'Up to 30 orders / month',
          '1 store & 1 motorbike courier',
          'Cash, T-Money & Flooz tracking',
          'Standard parcel slip',
        ],
      },
      {
        name: 'Pro',
        price: '10 000 F',
        period: '/ month',
        desc: 'For active sellers on TikTok, WhatsApp, and Instagram.',
        popular: true,
        badge: 'POPULAR',
        features: [
          'Unlimited orders & customers',
          'Up to 5 couriers + mobile app',
          'QR parcel labels & photo proof',
          'Daily cash reconciliation',
        ],
      },
      {
        name: 'Business',
        price: '25 000 F',
        period: '/ month',
        desc: 'For high-volume stores, brands, and delivery fleets.',
        popular: false,
        features: [
          'Everything in Pro, unlimited',
          'Unlimited couriers & staff',
          'Analytics reports & CSV export',
          'Priority WhatsApp support (+228)',
        ],
      },
    ],
    footerText: 'Built in Lomé for social commerce entrepreneurs.',
  },
} as const

export function LandingClient({
  saasName = 'Kaba Kaba',
  saasLogoUrl = null,
}: {
  saasName?: string
  saasLogoUrl?: string | null
}) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const t = COPY[lang]

  function handleWhatsappSignup(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = whatsappPhone.replace(/\s+/g, '').trim()
    const query = cleaned ? `?phone=${encodeURIComponent(`+228${cleaned}`)}` : ''
    router.push(`/signup${query}`)
  }

  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header éditorial blanc */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2.5 shrink-0 group">
            {saasLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={saasLogoUrl}
                alt={saasName}
                className="h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <KabaKabaLogo light className="h-8 sm:h-9 w-auto transition-transform duration-200 group-hover:scale-105" />
            )}
            {saasName !== 'Kaba Kaba' && (
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                {saasName}
              </span>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a
              href="#features"
              className="hover:text-slate-900 transition-colors"
            >
              {t.navFeatures}
            </a>
            <a
              href="#pricing"
              className="hover:text-slate-900 transition-colors"
            >
              {t.navPricing}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Switcher FR / EN */}
            <div
              role="group"
              aria-label="Language switcher"
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1 hidden sm:inline" />
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  lang === 'fr'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>

            <Link
              href="/login"
              className="px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
            >
              {t.login}
            </Link>

            <Link
              href="/signup"
              className="px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
            >
              {t.signup}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Carte Hero arrondie en dégradé lavande-rose #C7D2FE → #FCE0F5 */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 sm:pt-10 sm:pb-24">
          <div
            className="relative overflow-hidden rounded-[32px] sm:rounded-[44px] p-6 sm:p-10 lg:p-14 shadow-xl border border-indigo-100/80"
            style={{
              background: 'linear-gradient(135deg, #C7D2FE 0%, #E9D5FF 50%, #FCE0F5 100%)',
            }}
          >
            {/* Halos décoratifs */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-300/30 blur-3xl" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Colonne Éditoriale + Formulaire WhatsApp +228 */}
              <div className="lg:col-span-7 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-white text-slate-900 text-xs font-bold shadow-2xs mb-6">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{t.badge}</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black tracking-tight leading-[1.08] text-slate-950">
                  {t.heroTitle1}
                  <span className="underline decoration-indigo-500/40 decoration-wavy underline-offset-8">
                    {t.heroTitleHighlight}
                  </span>
                </h1>

                <p className="mt-5 text-base sm:text-lg text-slate-800/90 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium">
                  {t.heroSubtitle}
                </p>

                {/* Formulaire WhatsApp +228 connecté à /signup */}
                <form
                  onSubmit={handleWhatsappSignup}
                  className="mt-8 max-w-xl mx-auto lg:mx-0 bg-white/95 backdrop-blur-md p-2 rounded-2xl sm:rounded-full shadow-lg border border-white flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  <div className="flex items-center gap-2 pl-3.5 pr-2 py-2 flex-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-extrabold shrink-0">
                      🇹🇬 +228
                    </span>
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder={t.whatsappPlaceholder}
                      aria-label="Numéro WhatsApp +228"
                      className="w-full bg-transparent text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl sm:rounded-full bg-slate-950 hover:bg-indigo-950 text-white text-sm font-bold shadow-md hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
                  >
                    <span>{t.whatsappCta}</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </form>

                <p className="mt-3 text-xs text-slate-700 font-medium">
                  {t.whatsappHint}
                </p>

                {/* Actions rapides Se connecter / Ouvrir un compte */}
                <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/90 hover:bg-white text-slate-900 text-xs sm:text-sm font-bold shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>{t.signup}</span>
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/10 hover:bg-slate-900/15 text-slate-900 text-xs sm:text-sm font-bold transition-all duration-200"
                  >
                    <span>{t.ctaSecondary}</span>
                  </Link>
                </div>

                <p className="mt-5 text-xs sm:text-sm text-slate-800/80 font-semibold">
                  {t.socialProof}
                </p>
              </div>

              {/* Colonne Smartphone 3D + Carte flottante de recettes */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-sm pt-6 pb-4">
                  {/* Carte flottante de recettes en surimpression 3D */}
                  <div className="group/float absolute -top-2 -left-3 sm:-left-8 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-white/80 hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {t.floatingTitle}
                        </p>
                        <p className="text-lg font-black text-slate-900 tabular-nums">
                          148 500 FCFA
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          <span className="text-emerald-600">{t.floatingTrend}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{t.floatingSub}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Châssis Smartphone 3D incliné */}
                  <div className="rounded-[36px] bg-slate-950 p-3 shadow-[0_30px_60px_-15px_rgba(15,23,42,0.45)] border-4 border-white/70 transition-transform duration-500 lg:[transform:perspective(1200px)_rotateY(-10deg)_rotateX(4deg)] lg:hover:[transform:perspective(1200px)_rotateY(-2deg)_rotateX(1deg)]">
                    <div className="rounded-[26px] bg-white overflow-hidden border border-slate-100">
                      {/* Barre supérieure du téléphone */}
                      <div className="bg-slate-950 text-white px-4 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold">{saasName}</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {t.phoneLive}
                        </span>
                      </div>

                      {/* Corps de l'écran */}
                      <div className="p-4 space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">
                              {t.phoneHeader}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {t.phoneSource}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            T-Money • 18 500 F
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <p className="font-bold text-slate-900">
                            {t.phoneItem}
                          </p>
                          <p className="text-slate-600 flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{t.phoneCustomer}</span>
                          </p>
                          <p className="text-slate-600 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{t.phoneLandmark}</span>
                          </p>
                        </div>

                        {/* Carte Étiquette QR Colis */}
                        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-3.5 flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-md">
                              <QrCode className="w-3 h-3" />
                              {t.phoneQrLabel}
                            </span>
                            <p className="text-xs font-extrabold text-slate-900 font-mono">
                              KK-228-TOKOIN-09
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {t.phoneQrHint}
                            </p>
                          </div>

                          <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0 shadow-2xs">
                            <QrCode className="w-10 h-10 text-slate-900" />
                          </div>
                        </div>

                        {/* Pied carte livreur */}
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900">
                            <Bike className="w-4 h-4 text-emerald-600" />
                            Livreur : Koffi M.
                          </span>
                          <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Validé
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Fonctionnalités / Réalité du terrain */}
        <section
          id="features"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
        >
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-extrabold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t.painTag}
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
              {t.painTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {t.pains.map((item, idx) => {
              const Icon = idx === 0 ? Bike : idx === 1 ? AlertCircle : Wallet
              return (
                <div
                  key={item.title}
                  className="group rounded-3xl bg-white border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1.5 hover:border-indigo-200 transition-all duration-300 space-y-3.5"
                >
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#C7D2FE] to-[#FCE0F5] text-slate-900 flex items-center justify-center shadow-2xs transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Section Tarifs en FCFA */}
        <section
          id="pricing"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-slate-100"
        >
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-extrabold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              {t.pricingTag}
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
              {t.pricingTitle}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600">
              {t.pricingSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {t.plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl bg-white p-7 flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
                  plan.popular
                    ? 'border-2 border-slate-900 shadow-lg relative'
                    : 'border border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {plan.name}
                  </h3>
                  {plan.popular && 'badge' in plan && (
                    <span
                      className="px-3 py-1 rounded-full text-[11px] font-extrabold text-slate-900"
                      style={{
                        background: 'linear-gradient(135deg, #C7D2FE 0%, #FCE0F5 100%)',
                      }}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-xs text-slate-500">{plan.desc}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-slate-950 tabular-nums">
                    {plan.price}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    FCFA {plan.period}
                  </span>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-slate-700 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7 space-y-2">
                  <Link
                    href="/signup"
                    className={`w-full inline-flex items-center justify-center py-3.5 px-4 rounded-full text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 ${
                      plan.popular
                        ? 'bg-slate-950 hover:bg-indigo-950 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                    }`}
                  >
                    {t.signup}
                  </Link>
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {t.login}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            {saasLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={saasLogoUrl} alt={saasName} className="h-7 w-auto object-contain" />
            ) : (
              <KabaKabaLogo light className="h-7 w-auto" />
            )}
            <span>{t.footerText}</span>
          </div>
          <div className="flex items-center gap-6 font-semibold">
            <Link href="/login" className="hover:text-slate-900 transition-colors">
              {t.login}
            </Link>
            <Link
              href="/signup"
              className="text-slate-900 hover:text-indigo-700 font-bold transition-colors"
            >
              {t.signup}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
