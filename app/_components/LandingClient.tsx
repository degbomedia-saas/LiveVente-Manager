'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BatteryFull,
  Bike,
  Camera,
  ChevronDown,
  CreditCard,
  Gift,
  Menu,
  Mic,
  QrCode,
  ShoppingBag,
  Smartphone,
  Wallet,
  Wifi,
  X,
} from 'lucide-react'

type Lang = 'fr' | 'en'

const TRANSLATIONS = {
  fr: {
    nav_demo: 'Comment ça marche',
    nav_support: 'Support',
    nav_pricing: 'Tarifs',
    nav_login: 'Se connecter',
    nav_cta: 'Ouvrir un compte',
    hero_title_1: 'LE SYSTÈME PRO POUR CHAQUE',
    hero_title_2: 'COMMANDE TIKTOK',
    hero_subtitle:
      'Capturez vos commandes à la voix ou en 1 clic, imprimez vos étiquettes QR, suivez vos livreurs avec preuve photo et encaissez Cash, T-Money et Flooz sans trou de caisse.',
    hero_cta: 'Compte gratuit',
    hero_cta_2: 'Nos Tarifs',
    hero_start: 'Démarrer →',
    demo_kicker: 'Comment ça marche',
    demo_title: "DE LA COMMANDE TIKTOK À L'ENCAISSEMENT EN 3 ÉTAPES",
    pricing_title: 'DES TARIFS SIMPLES EN FCFA',
    pricing_sub:
      'Commencez gratuitement, puis passez au plan supérieur par T-Money ou Flooz.',
    support_title: 'SUPPORT WHATSAPP - 7J/7 À LOMÉ',
    support_desc:
      'Un blocage lors de la configuration de votre boutique ou pour activer votre forfait Pro par T-Money / Flooz ? Notre équipe locale vous accompagne directement sur WhatsApp.',
    faq_title: 'Questions fréquentes',
    cta_title: 'REJOIGNEZ LES BOUTIQUES QUI CARTONNENT À LOMÉ',
    cta_sub:
      "Simplifiez vos livraisons TikTok et libérez-vous des trous de caisse dès aujourd'hui.",
  },
  en: {
    nav_demo: 'How it works',
    nav_support: 'Support',
    nav_pricing: 'Pricing',
    nav_login: 'Log In',
    nav_cta: 'Open Account',
    hero_title_1: 'THE PRO SYSTEM FOR EVERY',
    hero_title_2: 'TIKTOK ORDER',
    hero_subtitle:
      'Capture orders by voice or 1 click, print branded QR labels, track drivers with photo proof, and reconcile Cash, T-Money, and Flooz payouts cleanly.',
    hero_cta: 'Create Free Account',
    hero_cta_2: 'Our Pricing',
    hero_start: 'Start →',
    demo_kicker: 'How it works',
    demo_title: 'FROM TIKTOK ORDER TO SECURED CASH IN 3 STEPS',
    pricing_title: 'SIMPLE PRICING IN FCFA',
    pricing_sub:
      'Start for free, then upgrade anytime via T-Money or Flooz.',
    support_title: '7/7 WHATSAPP SUPPORT IN LOMÉ',
    support_desc:
      'Need help setting up your store or activating your Pro plan via T-Money / Flooz? Our local team assists you directly on WhatsApp.',
    faq_title: 'Frequently asked questions',
    cta_title: 'JOIN TOP-SELLING STORES IN LOMÉ',
    cta_sub:
      'Streamline your TikTok deliveries and eliminate cash discrepancies starting today.',
  },
}

const LIVE_EVENTS = [
  { banner: '📸 POD Tokoin (#KK-482) • +18 500 F', rev: '154 500 FCFA' },
  { banner: '🎙️ Audio IA Agoè (#KK-485) • +12 000 F', rev: '166 500 FCFA' },
  { banner: '🎁 QR Fidélité validé (+1 pt)', rev: '181 500 FCFA' },
]

const STEP_DATA: Record<
  1 | 2 | 3,
  { badge: string; progress: string; text: string; strong: string; tail: string }
> = {
  1: {
    badge: 'Étape 1 / 3 • Audio IA & Étiquette QR',
    progress: '33%',
    text: 'Dictez la commande à la voix pendant votre live ou collez un message WhatsApp. La zone ',
    strong: 'Tokoin (+1 000 F)',
    tail: " et l'étiquette QR aux couleurs de votre boutique sont générées automatiquement.",
  },
  2: {
    badge: 'Étape 2 / 3 • Livreur en route',
    progress: '66%',
    text: 'Livreur assigné : ',
    strong: 'Kodjo M.',
    tail: ' Il scanne le QR code au départ et la cliente reçoit son lien de suivi WhatsApp en direct.',
  },
  3: {
    badge: 'Étape 3 / 3 • POD & Fidélité',
    progress: '100%',
    text: 'Photo preuve enregistrée, encaissement T-Money validé et ',
    strong: '+1 point fidélité',
    tail: ' crédité sur le numéro client sans inscription.',
  },
}

export function LandingClient({
  saasName = 'Kaba Kaba',
  saasLogoUrl = null,
}: {
  saasName?: string
  saasLogoUrl?: string | null
}) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [heroPhone, setHeroPhone] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopZone, setShopZone] = useState('Tokoin')
  const [shopPhone, setShopPhone] = useState('')

  const [liveIdx, setLiveIdx] = useState(0)
  const [calcOrders, setCalcOrders] = useState(40)
  const [calcPrice, setCalcPrice] = useState(12000)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [autoPlay, setAutoPlay] = useState(true)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const t = TRANSLATIONS[lang]
  const currentLive = LIVE_EVENTS[liveIdx]
  const monthlyLoss = Math.round(calcOrders * 4 * calcPrice * 0.08)
  const stepInfo = STEP_DATA[currentStep]
  const initialLetter = (saasName.trim()[0] || 'K').toUpperCase()

  useEffect(() => {
    const id = setInterval(() => {
      setLiveIdx((prev) => (prev + 1) % LIVE_EVENTS.length)
    }, 3200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!autoPlay) return
    const id = setInterval(() => {
      setCurrentStep((prev) => (prev === 3 ? 1 : ((prev + 1) as 1 | 2 | 3)))
    }, 4000)
    return () => clearInterval(id)
  }, [autoPlay])

  function handleHeroSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = heroPhone.replace(/\D/g, '')
    const formatted = digits.length >= 8 ? `+228${digits.slice(-8)}` : heroPhone.trim()
    router.push(
      formatted ? `/signup?phone=${encodeURIComponent(formatted)}` : '/signup'
    )
  }

  function handleFooterSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (shopName.trim()) params.set('shop', shopName.trim())
    if (shopZone) params.set('zone', shopZone)
    const digits = shopPhone.replace(/\D/g, '')
    if (digits.length >= 8) params.set('phone', `+228${digits.slice(-8)}`)
    const qs = params.toString()
    router.push(qs ? `/signup?${qs}` : '/signup')
  }

  return (
    <div className="min-h-screen bg-white text-[#1E1E1E] antialiased overflow-x-hidden pb-16 md:pb-0">
      {/* Google Fonts Outfit + Plus Jakarta Sans (identique à landing-ref.html) */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
      />

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-8">
            <a href="#top" className="flex items-center gap-2.5">
              {saasLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={saasLogoUrl}
                  alt={saasName}
                  className="h-8 w-8 rounded-xl object-cover border border-slate-900/10"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl julaya-gradient font-display text-sm text-[#242424] border border-slate-900/10">
                  {initialLetter}
                </div>
              )}
              <span className="font-sans-bold text-lg font-extrabold tracking-tight text-[#242424]">
                {saasName}
              </span>
            </a>

            <nav className="hidden items-center gap-6 text-xs font-semibold text-slate-700 lg:flex">
              <a href="#demo" className="hover:text-black transition-colors">
                {t.nav_demo}
              </a>
              <a href="#support" className="hover:text-black transition-colors">
                {t.nav_support}
              </a>
              <a href="#tarifs" className="hover:text-black transition-colors">
                {t.nav_pricing}
              </a>
              <a href="#faq" className="hover:text-black transition-colors">
                FAQ
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#inscription"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full julaya-pill-gradient px-3.5 py-2 text-xs font-bold text-[#242424] hover:opacity-90 transition-opacity"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>+228 90 12 34 56</span>
            </a>
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'fr' ? 'en' : 'fr'))}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span>{lang.toUpperCase()}</span>
            </button>
            <Link
              href="/login"
              className="btn-motion hidden sm:inline-flex items-center rounded-full border border-slate-900 px-4 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50 transition-colors"
            >
              {t.nav_login}
            </Link>
            <Link
              href="/signup"
              className="btn-motion btn-shimmer inline-flex items-center rounded-full julaya-dark px-4 py-2 text-xs font-bold text-white hover:bg-black transition-colors"
            >
              {t.nav_cta}
            </Link>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-800 lg:hidden cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-3 text-sm font-semibold text-slate-800">
              <a
                href="#demo"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1"
              >
                {t.nav_demo}
              </a>
              <a
                href="#support"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1"
              >
                {t.nav_support}
              </a>
              <a
                href="#tarifs"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1"
              >
                {t.nav_pricing}
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1"
              >
                FAQ
              </a>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full rounded-full border border-slate-900 py-2.5 text-center text-xs font-bold"
              >
                {t.nav_login}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section (Lavender-Pink Card + 3D Smartphone + Floating Recettes Pop-up) */}
      <section id="top" className="mx-auto max-w-6xl px-3 sm:px-6 pt-3">
        <div className="julaya-gradient relative overflow-hidden rounded-3xl px-5 pt-8 pb-12 sm:px-10 sm:pt-12 sm:pb-14">
          <div className="mx-auto flex max-w-5xl flex-col md:flex-row items-center justify-center gap-8 md:gap-10">
            {/* Left Copy */}
            <div className="w-full md:w-[48%] text-center md:text-left">
              <h1 className="font-display text-2xl sm:text-[36px] uppercase leading-[1.06] text-[#242424]">
                <span>{t.hero_title_1}</span>
                <span className="block">{t.hero_title_2}</span>
              </h1>
              <p className="mt-3.5 mx-auto md:mx-0 max-w-sm text-xs sm:text-sm leading-relaxed text-[#2F2F2F]">
                {t.hero_subtitle}
              </p>

              {/* CTA & WhatsApp Block */}
              <div className="mt-5 mx-auto md:mx-0 w-full max-w-[330px] space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href="/signup"
                    className="btn-motion btn-shimmer inline-flex items-center justify-center rounded-full julaya-dark px-4 py-2.5 text-xs font-bold text-white hover:bg-black shadow-sm whitespace-nowrap"
                  >
                    {t.hero_cta}
                  </Link>
                  <a
                    href="#tarifs"
                    className="btn-motion inline-flex items-center justify-center rounded-full border border-[#242424] bg-white/35 px-4 py-2.5 text-xs font-bold text-[#242424] hover:bg-white/60 whitespace-nowrap"
                  >
                    {t.hero_cta_2}
                  </a>
                </div>

                <form
                  onSubmit={handleHeroSubmit}
                  className="flex w-full items-center gap-1.5 rounded-full bg-white/95 p-1.5 backdrop-blur-md border border-white shadow-md ring-1 ring-slate-900/5"
                >
                  <span className="inline-flex items-center gap-1.5 pl-2.5 pr-2 border-r border-slate-200 text-[11px] font-extrabold text-slate-800 shrink-0 whitespace-nowrap">
                    <svg
                      className="h-3 w-4 rounded-[2px] shrink-0"
                      viewBox="0 0 20 14"
                      aria-hidden="true"
                    >
                      <rect width="20" height="14" fill="#006A4E" />
                      <rect y="2.8" width="20" height="2.8" fill="#FFCE00" />
                      <rect y="8.4" width="20" height="2.8" fill="#FFCE00" />
                      <rect width="8.5" height="8.4" fill="#D21034" />
                      <polygon
                        points="4.25,1.8 4.9,3.7 6.9,3.7 5.3,4.8 5.9,6.7 4.25,5.5 2.6,6.7 3.2,4.8 1.6,3.7 3.6,3.7"
                        fill="#FFFFFF"
                      />
                    </svg>
                    <span>+228</span>
                  </span>
                  <input
                    type="tel"
                    required
                    value={heroPhone}
                    onChange={(e) => setHeroPhone(e.target.value)}
                    placeholder="90 12 34 56"
                    className="min-w-0 w-full bg-transparent px-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="btn-motion btn-shimmer shrink-0 rounded-full julaya-dark px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-black whitespace-nowrap cursor-pointer"
                  >
                    {t.hero_start}
                  </button>
                </form>
              </div>
            </div>

            {/* Right 3D Animated Interactive iPhone */}
            <div className="w-full md:w-[46%] relative flex flex-col items-center">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-white/45 blur-3xl" />
              <div className="relative w-full max-w-[330px] flex flex-col items-center">
                <div className="phone-3d relative w-full max-w-[268px] rounded-[2.9rem] bg-gradient-to-b from-slate-200 via-slate-400 to-slate-300 p-[3px] shadow-2xl">
                  <span className="pointer-events-none absolute -left-[3px] top-20 h-5 w-[3px] rounded-l bg-slate-300" />
                  <span className="pointer-events-none absolute -left-[3px] top-28 h-9 w-[3px] rounded-l bg-slate-300" />
                  <span className="pointer-events-none absolute -left-[3px] top-40 h-9 w-[3px] rounded-l bg-slate-300" />
                  <span className="pointer-events-none absolute -right-[3px] top-28 h-12 w-[3px] rounded-r bg-slate-300" />

                  <div className="relative rounded-[2.75rem] bg-slate-950 p-[8px]">
                    <div className="relative overflow-hidden rounded-[2.2rem] bg-slate-100 px-2.5 pt-2 pb-2.5">
                      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-tr from-transparent via-white/10 to-white/25" />

                      <div className="relative z-10 mb-2 flex items-center justify-between px-2 text-[9px] font-bold text-slate-900">
                        <span>9:41</span>
                        <div className="flex h-[15px] w-[68px] items-center justify-end rounded-full bg-slate-950 px-1.5">
                          <span className="h-2 w-2 rounded-full bg-gradient-to-tr from-indigo-950 via-sky-900 to-slate-800" />
                        </div>
                        <div className="flex items-center gap-1 text-slate-800">
                          <Wifi className="h-2.5 w-2.5" />
                          <BatteryFull className="h-3 w-3" />
                        </div>
                      </div>

                      <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 p-3 text-white">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-sky-100">
                            Boutique Élégance
                          </span>
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold">
                            Lomé • Live
                          </span>
                        </div>
                        <p className="mt-1 font-display text-lg">154 500 FCFA</p>
                        <p className="text-[9px] text-sky-100">
                          Caisse sécurisée du jour
                        </p>
                      </div>

                      <div className="mt-2.5 rounded-2xl bg-white p-2.5 shadow-sm">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white">
                              <Mic className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Audio IA
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">
                              <QrCode className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Étiquettes
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-white">
                              <Bike className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Livreurs
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white">
                              <Camera className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Preuve POD
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500 text-white">
                              <Wallet className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              T-Money
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white">
                              <CreditCard className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Flooz
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white">
                              <Gift className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Fidélité
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white">
                              <ShoppingBag className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Live Shop
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <div className="rounded-xl bg-white p-2 shadow-sm">
                          <p className="text-[9px] font-semibold text-slate-400">
                            Colis livrés
                          </p>
                          <p className="font-display text-xs text-slate-900">
                            98.4 % ✓
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-2 shadow-sm">
                          <p className="text-[9px] font-semibold text-slate-400">
                            Dernier scan
                          </p>
                          <p className="font-display text-xs text-emerald-600">
                            +12 000 F
                          </p>
                        </div>
                      </div>

                      <div className="mx-auto mt-2.5 h-1 w-20 rounded-full bg-slate-900/80" />
                    </div>
                  </div>
                </div>

                {/* Floating Mes recettes Pop-up Card */}
                <div className="animate-float relative mt-3 sm:mt-0 sm:absolute sm:-bottom-5 sm:-left-12 z-30 w-full sm:w-[235px] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#242424] text-[10px] font-black text-white">
                        {initialLetter}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        Mes recettes (3)
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600">
                      {currentLive.rev}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <span className="font-semibold text-slate-700">
                        T-Money • Validé
                      </span>
                      <span className="font-bold text-slate-900">68 000 F</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <span className="font-semibold text-slate-700">
                        Flooz • Validé
                      </span>
                      <span className="font-bold text-slate-900">42 500 F</span>
                    </div>
                    <div
                      key={liveIdx}
                      className="live-feed-item rounded-lg bg-[#EFF4FF] px-2.5 py-1.5 font-semibold text-slate-800"
                    >
                      <span>{currentLive.banner}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Floating Trust Pill */}
        <div className="relative z-10 mx-auto -mt-5 max-w-5xl px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl sm:rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-md p-2 sm:pr-6 shadow-lg">
            <div className="inline-flex items-center gap-2 rounded-full julaya-dark px-4 py-2 text-[11px] font-bold text-white shrink-0 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>+50 boutiques actives à Lomé</span>
            </div>
            <div className="flex flex-1 w-full items-center overflow-hidden px-2 py-1">
              <div className="animate-marquee gap-8 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap items-center">
                <span>TikTok Live</span>
                <span>•</span>
                <span>WhatsApp Business</span>
                <span>•</span>
                <span>T-Money</span>
                <span>•</span>
                <span>Flooz</span>
                <span>•</span>
                <span>Dictée Vocale</span>
                <span>•</span>
                <span>Lomé (+228)</span>
                <span>•</span>
                <span>TikTok Live</span>
                <span>•</span>
                <span>WhatsApp Business</span>
                <span>•</span>
                <span>T-Money</span>
                <span>•</span>
                <span>Flooz</span>
                <span>•</span>
                <span>Dictée Vocale</span>
                <span>•</span>
                <span>Lomé (+228)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche (3-Step Demo + Loss Calculator) */}
      <section id="demo" className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
            {t.demo_kicker}
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-4xl uppercase text-[#242424]">
            {t.demo_title}
          </h2>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Loss Calculator */}
          <div
            id="calculateur"
            className="lg:col-span-5 julaya-cream rounded-3xl p-6 sm:p-7"
          >
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-800">
              Simulateur pertes
            </span>
            <h3 className="mt-3 font-display text-xl uppercase text-[#242424]">
              Combien perdez-vous par mois ?
            </h3>
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Livraisons / semaine</span>
                  <span>{calcOrders} colis / sem</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={calcOrders}
                  onChange={(e) => setCalcOrders(Number(e.target.value))}
                  className="w-full accent-[#242424]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Panier moyen</span>
                  <span>{calcPrice.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <input
                  type="range"
                  min={3000}
                  max={50000}
                  step={1000}
                  value={calcPrice}
                  onChange={(e) => setCalcPrice(Number(e.target.value))}
                  className="w-full accent-[#242424]"
                />
              </div>
              <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                <p className="text-[11px] font-bold uppercase text-slate-400">
                  Pertes évitables / mois
                </p>
                <p className="mt-1 font-display text-2xl text-[#242424]">
                  {monthlyLoss.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            </div>
          </div>

          {/* 3-Step Interactive Demo */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg uppercase text-[#242424]">
                Parcours en 3 clics
              </h3>
              <span className="rounded-full julaya-pill-gradient px-2.5 py-0.5 text-[10px] font-bold text-[#242424]">
                {autoPlay ? 'Lecture auto' : 'Manuel'}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 mb-4">
              {(
                [
                  { id: 1, label: '1. Audio / Étiquette QR' },
                  { id: 2, label: '2. Livreur WhatsApp' },
                  { id: 3, label: '3. POD & Fidélité' },
                ] as const
              ).map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    setAutoPlay(false)
                    setCurrentStep(step.id)
                  }}
                  className={`rounded-xl p-3 text-left text-xs font-bold cursor-pointer transition ${
                    currentStep === step.id
                      ? 'border-2 border-[#242424] bg-slate-50'
                      : 'border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
            <div className="rounded-2xl julaya-ice p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-800">
                  {stepInfo.badge}
                </span>
                <span className="font-display text-sm text-[#242424]">
                  19 500 F
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white overflow-hidden mb-4">
                <div
                  className="h-full bg-[#242424] transition-all duration-500"
                  style={{ width: stepInfo.progress }}
                />
              </div>
              <div className="text-xs text-slate-700 leading-relaxed">
                {stepInfo.text}
                <strong>{stepInfo.strong}</strong>
                {stepInfo.tail}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support WhatsApp 7j/7 */}
      <section id="support" className="julaya-cream py-14 my-4">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 sm:px-6 md:grid-cols-12">
          <div className="md:col-span-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/support-lome.jpg"
              alt="Support Kaba Kaba WhatsApp à Lomé"
              className="w-full rounded-3xl object-cover shadow-lg border border-white"
            />
          </div>
          <div className="md:col-span-6">
            <h2 className="font-display text-2xl sm:text-3xl uppercase text-[#242424]">
              {t.support_title}
            </h2>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {t.support_desc}
            </p>
            <ul className="mt-4 space-y-2 text-xs sm:text-sm font-medium text-slate-800">
              <li>
                ✓ Onboarding guidé pour votre boutique en moins de 10 minutes
              </li>
              <li>✓ Activation rapide de vos abonnements par Mobile Money</li>
              <li>✓ Assistance dédiée pour vos livreurs sur le terrain</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing Section (3 Vertical Cards Side by Side) */}
      <section id="tarifs" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-2xl sm:text-4xl uppercase text-[#242424]">
            {t.pricing_title}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{t.pricing_sub}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Free MVP Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 card-hover shadow-sm flex flex-col justify-between min-h-[420px]">
            <div>
              <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-700">
                Découverte
              </span>
              <h3 className="mt-3 font-display text-xl uppercase text-[#242424]">
                MVP Gratuit
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Pour tester votre boutique sans risque
              </p>
              <p className="mt-5 font-display text-3xl text-[#242424]">
                0 FCFA{' '}
                <span className="font-sans text-xs font-medium text-slate-500">
                  / mois
                </span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li>✓ Jusqu&apos;à 30 commandes / mois</li>
                <li>✓ 3 essais Dictée Vocale IA</li>
                <li>✓ 1 compte vendeur + 1 livreur</li>
                <li>✓ Étiquettes &amp; zones personnalisées</li>
              </ul>
            </div>
            <Link
              href="/signup?plan=free_mvp"
              className="mt-8 block w-full rounded-full border border-[#242424] py-3 text-center text-xs font-bold text-[#242424] hover:bg-slate-50 transition-colors"
            >
              Démarrer gratuitement
            </Link>
          </div>

          {/* Pro Card */}
          <div className="relative rounded-3xl julaya-gradient p-7 shadow-xl card-hover flex flex-col justify-between border border-indigo-200 min-h-[420px]">
            <span className="absolute -top-3 right-6 rounded-full julaya-dark px-3.5 py-1 text-[10px] font-bold uppercase text-white shadow">
              Recommandé
            </span>
            <div>
              <span className="inline-block rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase text-[#242424]">
                Vendeurs actifs
              </span>
              <h3 className="mt-3 font-display text-xl uppercase text-[#242424]">
                Pro
              </h3>
              <p className="mt-1 text-xs text-slate-700">
                Pour les vendeurs TikTok &amp; WhatsApp
              </p>
              <p className="mt-5 font-display text-3xl text-[#242424]">
                10 000 FCFA{' '}
                <span className="font-sans text-xs font-medium text-slate-700">
                  / mois
                </span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-800 font-medium">
                <li>✓ Commandes illimitées</li>
                <li>✓ Dictée Vocale IA &amp; Collage WhatsApp illimités</li>
                <li>✓ Preuve photo POD &amp; QR fidélité</li>
                <li>✓ Logo, 4 palettes &amp; jusqu&apos;à 3 livreurs</li>
              </ul>
            </div>
            <Link
              href="/signup?plan=pro"
              className="mt-8 block w-full rounded-full julaya-dark py-3 text-center text-xs font-bold text-white hover:bg-black transition-colors shadow-md"
            >
              Choisir le plan Pro
            </Link>
          </div>

          {/* Business Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 card-hover shadow-sm flex flex-col justify-between min-h-[420px]">
            <div>
              <span className="inline-block rounded-full bg-[#FCD9B6] px-3 py-1 text-[10px] font-bold uppercase text-[#242424]">
                Équipe &amp; Flotte
              </span>
              <h3 className="mt-3 font-display text-xl uppercase text-[#242424]">
                Business
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Pour les boutiques avec employés
              </p>
              <p className="mt-5 font-display text-3xl text-[#242424]">
                25 000 FCFA{' '}
                <span className="font-sans text-xs font-medium text-slate-500">
                  / mois
                </span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li>✓ Tout le plan Pro inclus</li>
                <li>✓ Multi-employés &amp; livreurs illimités</li>
                <li>✓ Rapprochement complet &amp; Export CSV</li>
                <li>✓ Gestion des retours &amp; Bilan de caisse</li>
              </ul>
            </div>
            <Link
              href="/signup?plan=business"
              className="mt-8 block w-full rounded-full border border-[#242424] py-3 text-center text-xs font-bold text-[#242424] hover:bg-slate-50 transition-colors"
            >
              Choisir Business
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h2 className="text-center font-display text-2xl uppercase text-[#242424] mb-6">
          {t.faq_title}
        </h2>
        <div className="space-y-3">
          {[
            {
              q: "Ai-je besoin d'une imprimante spéciale pour les étiquettes QR ?",
              a: 'Non ! Imprimez sur feuille A4 standard, utilisez une mini-imprimante thermique Bluetooth ou écrivez simplement le numéro de commande au marqueur.',
            },
            {
              q: 'Comment fonctionne la dictée vocale pendant un live TikTok ?',
              a: "Vous appuyez sur le bouton micro, dictez le nom, le numéro, l'article et le quartier, et l'application crée la fiche commande pré-remplie en 2 secondes.",
            },
            {
              q: 'Comment payer mon abonnement sans carte bancaire ?',
              a: "Directement par T-Money ou Flooz : vous envoyez votre référence dans l'application et votre forfait est activé en quelques minutes.",
            },
          ].map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-slate-900 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-500 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-slate-600">{faq.a}</div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Final Dark CTA Block + Rounded Gradient Footer */}
      <section id="inscription" className="julaya-dark pt-16 pb-10 text-white mt-10">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl sm:text-5xl uppercase leading-tight">
            {t.cta_title}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-300">{t.cta_sub}</p>

          <form
            onSubmit={handleFooterSubmit}
            className="mx-auto mt-8 max-w-xl rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/10 grid gap-2.5 sm:grid-cols-3"
          >
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Nom boutique"
              className="rounded-full bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none"
            />
            <select
              value={shopZone}
              onChange={(e) => setShopZone(e.target.value)}
              className="rounded-full bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none"
            >
              <option value="Tokoin">Tokoin</option>
              <option value="Déckon">Déckon</option>
              <option value="Agoè">Agoè</option>
              <option value="Adidogomé">Adidogomé</option>
            </select>
            <input
              type="tel"
              required
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              placeholder="WhatsApp +228"
              className="rounded-full bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              className="btn-motion btn-shimmer sm:col-span-3 rounded-full julaya-pill-gradient py-3.5 text-xs sm:text-sm font-extrabold text-[#242424] hover:opacity-95 transition-opacity cursor-pointer"
            >
              Créer mon compte gratuit maintenant →
            </button>
          </form>
        </div>

        {/* Floating Gradient Rounded Footer Card */}
        <footer className="mx-auto mt-12 max-w-5xl px-4">
          <div className="julaya-gradient rounded-3xl p-8 text-[#242424]">
            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <div className="flex items-center gap-2 font-sans-bold text-lg font-extrabold">
                  <span>{saasName}</span>
                </div>
                <p className="mt-2 text-xs text-slate-700">
                  La gestion logistique et financière pour vendeurs TikTok &amp;
                  WhatsApp au Togo.
                </p>
              </div>
              <div className="text-xs space-y-2">
                <p className="font-bold uppercase tracking-wider text-slate-900">
                  Plateforme
                </p>
                <a href="#demo" className="block hover:underline">
                  Comment ça marche
                </a>
                <a href="#support" className="block hover:underline">
                  Support 7j/7
                </a>
                <a href="#faq" className="block hover:underline">
                  FAQ
                </a>
              </div>
              <div className="text-xs space-y-2">
                <p className="font-bold uppercase tracking-wider text-slate-900">
                  Produit
                </p>
                <a href="#tarifs" className="block hover:underline">
                  Tarifs FCFA
                </a>
                <Link href="/signup" className="block hover:underline">
                  Ouvrir un compte
                </Link>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/10 pt-4 text-[11px] font-medium text-slate-700">
              <span>© {saasName} 2026 — Made in Lomé</span>
              <span>FR • EN</span>
            </div>
          </div>
        </footer>
      </section>

      {/* Sticky Mobile Conversion Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 flex items-center justify-between md:hidden shadow-lg">
        <div>
          <p className="text-xs font-extrabold text-[#242424]">
            {saasName} • MVP Gratuit
          </p>
          <p className="text-[10px] text-slate-600 font-semibold">
            0 FCFA • Sans carte bancaire
          </p>
        </div>
        <Link
          href="/signup"
          className="rounded-full julaya-dark px-4 py-2 text-xs font-bold text-white"
        >
          Ouvrir un compte
        </Link>
      </div>
    </div>
  )
}
