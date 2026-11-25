'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BatteryFull,
  Bike,
  Camera,
  CreditCard,
  Gift,
  MessageCircle,
  Mic,
  QrCode,
  ShoppingBag,
  Wallet,
  Wifi,
} from 'lucide-react'

type Lang = 'fr' | 'en'

interface LandingClientProps {
  saasName: string
  saasLogoUrl: string | null
}

const LIVE_EVENTS: Record<Lang, string[]> = {
  fr: [
    '📸 POD Tokoin (#KK-482)',
    '🎙️ Vocal IA Agoè (+12 000 F)',
    '🎁 +1 pt fidélité client',
  ],
  en: [
    '📸 POD Tokoin (#KK-482)',
    '🎙️ AI Voice Agoè (+12,000 F)',
    '🎁 +1 customer loyalty pt',
  ],
}

const TRANSLATIONS = {
  fr: {
    nav_status: 'Opérationnel à Lomé',
    nav_login: 'Connexion',
    nav_cta: 'Essai gratuit',
    hero_badge: 'Conçu pour les vendeurs TikTok & WhatsApp à Lomé',
    hero_title: 'DIVISEZ PAR 3 VOTRE TEMPS DE GESTION DES COMMANDES',
    hero_subtitle_1:
      'Arrêtez de jongler entre cahiers papier, WhatsApp et appels de livreurs. Utilisez la ',
    hero_subtitle_voice: 'Dictée vocale',
    hero_subtitle_2: ', imprimez vos ',
    hero_subtitle_qr: 'Étiquettes QR',
    hero_subtitle_3: ' et suivez ',
    hero_subtitle_pay: 'T-Money, Flooz et Cash',
    hero_subtitle_4: ' sur un seul écran.',
    hero_cta: "Démarrer en 2 min — C'est gratuit →",
    hero_go: 'Démarrer gratuit →',
    hero_wa_link: '💬 Une question ? Parler sur WhatsApp',
    test_img_alt: 'Commerçante TikTok à Déckon, Lomé',
    test_tag: 'Conçu avec les boutiques du Togo',
    test_quote:
      '« Avant Kaba Kaba, après chaque live TikTok, on passait 2h à recompter sur cahier et on se disputait le lendemain avec les zems. Maintenant, la caisse du soir se fait en 1 clic. »',
    test_author: '— Boutique Mode & Chaussures, Lomé',
    hero_reassure: "Gratuit jusqu'à 20 commandes • Sans carte",
    phone_shop: 'Boutique Lomé',
    phone_live: 'En direct',
    phone_today: 'Caisse sécurisée du jour',
    icon_voice: 'Vocal IA',
    icon_qr: 'Étiquette',
    icon_drivers: 'Livreurs',
    icon_pod: 'Photo',
    icon_loyalty: 'Fidélité',
    card_receipts: 'Mes recettes',
    stat_1_val: '20 commandes offertes',
    stat_1_desc: 'pour tester sur vos vraies livraisons en 2 minutes',
    stat_2_val: '2 minutes',
    stat_2_desc: 'pour ouvrir votre boutique depuis un téléphone',
    stat_3_val: 'T-Money & Flooz',
    stat_3_desc: 'séparés automatiquement du cash livreur',
    comp_title: 'AVANT VS AVEC KABA KABA',
    comp_before_title: '✕ Sans Kaba Kaba (Friction)',
    comp_b1:
      'Commandes perdues pendant vos lives TikTok et sur WhatsApp faute de prise de notes rapide',
    comp_b2:
      'Trous de caisse et disputes le soir avec les livreurs sur les frais et encaissements',
    comp_b3: 'Heures perdues à tout recalculer à la main sur cahier papier',
    comp_after_title: '✓ Avec Kaba Kaba (Vitesse)',
    comp_a1: 'Dictée vocale rapide + Panier du Live pour zéro oubli',
    comp_a2: 'Étiquettes QR + photo de preuve à chaque remise de colis',
    comp_a3: 'Bilan de caisse exact (Cash, T-Money, Flooz) en 1 clic le soir',
    steps_title: 'COMMENT ÇA MARCHE EN 3 ÉTAPES',
    step_1_t: 'Connectez votre numéro',
    step_1_d:
      'Renseignez votre boutique, vos couleurs et vos quartiers de Lomé en 2 minutes.',
    step_2_t: 'Enregistrez à la voix',
    step_2_d:
      'Dictez vos commandes ou collez un message WhatsApp : la fiche se crée seule.',
    step_3_t: 'Encaissez sans écart',
    step_3_d:
      'Vos livreurs valident par photo et vous contrôlez votre caisse en temps réel.',
    final_badge: "Gratuit jusqu'à 20 commandes • Puis 5 000 FCFA / mois",
    final_title: 'PRÊT À SÉCURISER VOS PROCHAINES LIVRAISONS ?',
    final_desc:
      'Sans engagement • Payez par T-Money ou Flooz au mois sans carte bancaire.',
    final_cta_1: 'Créer mon compte gratuit →',
    final_cta_2: 'Discuter sur WhatsApp',
    mobile_bar_sub: '20 commandes gratuites',
  },
  en: {
    nav_status: 'Live in Lomé',
    nav_login: 'Log In',
    nav_cta: 'Free Trial',
    hero_badge: 'Built for TikTok & WhatsApp sellers in Lomé',
    hero_title: 'CUT YOUR ORDER MANAGEMENT TIME BY 3X',
    hero_subtitle_1:
      'Stop juggling paper notebooks, WhatsApp chats, and driver calls. Use ',
    hero_subtitle_voice: 'Voice Dictation',
    hero_subtitle_2: ', print ',
    hero_subtitle_qr: 'QR Labels',
    hero_subtitle_3: ', and track ',
    hero_subtitle_pay: 'T-Money, Flooz, and Cash',
    hero_subtitle_4: ' on one screen.',
    hero_cta: "Start in 2 min — It's Free →",
    hero_go: 'Start Free →',
    hero_wa_link: '💬 Chat on WhatsApp',
    test_img_alt: 'TikTok seller in Déckon, Lomé',
    test_tag: 'Built with shops in Déckon, Tokoin & Agoè',
    test_quote:
      '"Before Kaba Kaba, after every TikTok live we spent 2 hours recounting notebooks and arguing with drivers. Now evening cash takes 1 click."',
    test_author: '— Fashion & Shoes Shop, Déckon (Lomé)',
    hero_reassure: 'Free up to 20 orders • No card • 100% mobile',
    phone_shop: 'Lomé Store',
    phone_live: 'Live',
    phone_today: "Today's secured cash",
    icon_voice: 'AI Voice',
    icon_qr: 'Label',
    icon_drivers: 'Drivers',
    icon_pod: 'Photo',
    icon_loyalty: 'Loyalty',
    card_receipts: 'My revenue',
    stat_1_val: '20 orders',
    stat_1_desc: 'included free to test on real deliveries',
    stat_2_val: '2 minutes',
    stat_2_desc: 'to set up your store right from your phone',
    stat_3_val: 'T-Money & Flooz',
    stat_3_desc: 'automatically separated from driver cash',
    comp_title: 'BEFORE VS WITH KABA KABA',
    comp_before_title: '✕ Without Kaba Kaba (Friction)',
    comp_b1: 'Orders lost in unread WhatsApp chats after a live',
    comp_b2: 'Disputes with drivers over delivery fees and collected cash',
    comp_b3: 'Manual notebook calculations late every evening',
    comp_after_title: '✓ With Kaba Kaba (Speed)',
    comp_a1: 'Fast voice dictation + Live Cart so nothing gets missed',
    comp_a2: 'QR labels + photo proof on every single parcel handoff',
    comp_a3: 'Exact evening cash summary (Cash, T-Money, Flooz) in 1 click',
    steps_title: 'HOW IT WORKS IN 3 STEPS',
    step_1_t: 'Connect your number',
    step_1_d:
      'Set up your store name, colors, and Lomé delivery zones in 2 minutes.',
    step_2_t: 'Record by voice',
    step_2_d:
      'Dictate orders or paste a WhatsApp message: the order fills itself.',
    step_3_t: 'Get paid accurately',
    step_3_d:
      'Drivers confirm with a photo and you track your cash in real time.',
    final_badge: 'Free up to 20 orders • Then 5,000 FCFA / month',
    final_title: 'READY TO SECURE YOUR NEXT DELIVERIES?',
    final_desc:
      'Try Kaba Kaba free today. Easy activation via T-Money or Flooz, no credit card needed.',
    final_cta_1: 'Create Free Account →',
    final_cta_2: 'Chat on WhatsApp',
    mobile_bar_sub: '20 free orders',
  },
} as const

export function LandingClient({ saasName, saasLogoUrl }: LandingClientProps) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')
  const [heroPhone, setHeroPhone] = useState('')
  const [liveIdx, setLiveIdx] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  const t = TRANSLATIONS[lang]

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveIdx((prev) => (prev + 1) % 3)
      setAnimKey((prev) => prev + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )
    const elements = document.querySelectorAll('.reveal')
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  function handleHeroSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanPhone = heroPhone.trim()
    const fullPhone = cleanPhone.startsWith('+228')
      ? cleanPhone
      : cleanPhone
      ? `+228 ${cleanPhone}`
      : ''
    const params = new URLSearchParams()
    if (fullPhone) params.set('phone', fullPhone)
    const qs = params.toString()
    router.push(qs ? `/signup?${qs}` : '/signup')
  }

  return (
    <div className="min-h-screen bg-white text-[#1E1E1E] antialiased overflow-x-hidden pb-16 md:pb-0">
      <style>{`
        .font-display { font-family: var(--font-outfit), var(--font-jakarta), 'Outfit', 'Plus Jakarta Sans', sans-serif; font-weight: 800; letter-spacing: -0.025em; }
        .julaya-gradient { background: linear-gradient(125deg, #C7D2FE 0%, #DFDBFF 42%, #FCE0F5 100%); }
        .julaya-pill-gradient { background: linear-gradient(110deg, #DDE2FF 0%, #FCE0F5 100%); }
        .julaya-cream { background-color: #F6F4EF; }
        .julaya-ice { background-color: #EFF4FF; }
        .julaya-dark { background-color: #242424; }
        @keyframes floatPhone {
          0%, 100% { transform: perspective(950px) rotateY(-12deg) rotateX(4deg) rotateZ(2.5deg) translateY(0px); }
          50% { transform: perspective(950px) rotateY(-8deg) rotateX(2deg) rotateZ(1.5deg) translateY(-8px); }
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmerSweep {
          0% { transform: translateX(-130%); }
          100% { transform: translateX(230%); }
        }
        @keyframes slideInToast {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .phone-3d {
          transform-style: preserve-3d;
          filter: drop-shadow(-16px 24px 32px rgba(15, 23, 42, 0.28));
          animation: floatPhone 5.5s ease-in-out infinite;
        }
        .phone-3d:hover {
          animation-play-state: paused;
          transform: perspective(950px) rotateY(-2deg) rotateX(1deg) rotateZ(0deg) translateY(-4px);
        }
        .animate-float { animation: floatCard 4.2s ease-in-out infinite; }
        .live-feed-item { animation: slideInToast 0.45s ease-out; }
        @keyframes ctaNudge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .btn-motion {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
        }
        .btn-shimmer {
          animation: ctaNudge 3.2s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }
        .btn-shimmer:hover {
          animation-play-state: paused;
        }
        .btn-motion:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 12px 24px -6px rgba(15, 23, 42, 0.22);
        }
        .btn-motion:active { transform: translateY(0) scale(0.97); }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 45%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent);
          animation: shimmerSweep 3.4s infinite;
        }
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 18px 34px -12px rgba(15, 23, 42, 0.12); }
        .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.5s ease-out, transform 0.5s ease-out; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        @media (max-width: 639px) {
          .phone-3d { animation: none; transform: none; }
        }
      `}</style>

      {/* 1. Minimal One-Job Header (No distracting links) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            {saasLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={saasLogoUrl}
                alt={saasName}
                className="h-8 w-8 rounded-xl object-contain border border-slate-900/10"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl julaya-gradient font-display text-sm text-[#242424] border border-slate-900/10">
                {saasName.charAt(0).toUpperCase() || 'K'}
              </div>
            )}
            <span className="font-display text-lg tracking-tight text-[#242424]">
              {saasName}
            </span>
          </a>

          <div className="flex items-center gap-2">
            <button
              id="lang-toggle"
              type="button"
              onClick={() => setLang((prev) => (prev === 'fr' ? 'en' : 'fr'))}
              className="btn-motion inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            >
              <span id="lang-label">{lang.toUpperCase()}</span>
            </button>
            <Link
              href="/login"
              id="btn-login-nav"
              className="btn-motion hidden sm:inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
            >
              {t.nav_login}
            </Link>
            <Link
              href="/signup"
              className="btn-motion btn-shimmer inline-flex items-center rounded-full julaya-dark px-4 py-2 text-xs font-bold text-white hover:bg-black whitespace-nowrap"
            >
              {t.nav_cta}
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section (One-Job Focus + 3D Smartphone) */}
      <section id="top" className="mx-auto max-w-6xl px-3 sm:px-6 pt-3">
        <div className="julaya-gradient relative overflow-hidden rounded-3xl px-5 pt-8 pb-10 sm:px-10 sm:pt-12 sm:pb-12">
          <div className="mx-auto flex max-w-5xl flex-col md:flex-row items-center justify-center gap-8 md:gap-10">
            {/* Left Copy */}
            <div className="w-full md:w-[49%] text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1 text-[11px] font-bold text-[#242424] shadow-sm mb-4">
                <span>⚡</span>
                <span>{t.hero_badge}</span>
              </div>

              <h1 className="font-display text-2xl sm:text-[38px] uppercase leading-[1.06] text-[#242424]">
                {t.hero_title}
              </h1>

              <p className="mt-3.5 mx-auto md:mx-0 max-w-md text-xs sm:text-sm leading-relaxed text-[#2F2F2F]">
                {t.hero_subtitle_1}
                <strong>{t.hero_subtitle_voice}</strong>
                {t.hero_subtitle_2}
                <strong>{t.hero_subtitle_qr}</strong>
                {t.hero_subtitle_3}
                <strong>{t.hero_subtitle_pay}</strong>
                {t.hero_subtitle_4}
              </p>

              {/* Unified Single Action Block + Direct Hero WhatsApp Link */}
              <div className="mt-5 mx-auto md:mx-0 w-full max-w-[360px] space-y-2.5">
                <form
                  id="hero-form"
                  onSubmit={handleHeroSubmit}
                  className="flex w-full items-center gap-1.5 rounded-full bg-white p-1.5 shadow-xl ring-1 ring-slate-900/10"
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
                    id="hero-phone"
                    type="tel"
                    required
                    value={heroPhone}
                    onChange={(e) => setHeroPhone(e.target.value)}
                    placeholder="90 12 34 56"
                    className="min-w-0 w-full bg-transparent px-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="btn-motion btn-shimmer shrink-0 rounded-full julaya-dark px-4 py-2 text-[11px] font-bold text-white hover:bg-black whitespace-nowrap"
                  >
                    {t.hero_go}
                  </button>
                </form>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 text-[11px]">
                  <span className="font-semibold text-slate-700">
                    {t.hero_reassure}
                  </span>
                  <a
                    href="https://wa.me/22890123456?text=Bonjour%2C%20je%20souhaite%20tester%20Kaba%20Kaba%20pour%20mon%20activit%C3%A9%20%C3%A0%20Lom%C3%A9."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-motion inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-bold text-emerald-900 hover:bg-emerald-500/25"
                  >
                    {t.hero_wa_link}
                  </a>
                </div>
              </div>
            </div>

            {/* Right 3D Animated iPhone Mockup */}
            <div className="w-full md:w-[45%] relative flex flex-col items-center">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-white/45 blur-3xl"></div>
              <div className="relative w-full max-w-[320px] flex flex-col items-center">
                <div className="phone-3d relative w-full max-w-[265px] rounded-[2.9rem] bg-gradient-to-b from-slate-200 via-slate-400 to-slate-300 p-[3px] shadow-2xl">
                  <span className="pointer-events-none absolute -left-[3px] top-20 h-5 w-[3px] rounded-l bg-slate-300"></span>
                  <span className="pointer-events-none absolute -left-[3px] top-28 h-9 w-[3px] rounded-l bg-slate-300"></span>
                  <span className="pointer-events-none absolute -right-[3px] top-28 h-12 w-[3px] rounded-r bg-slate-300"></span>

                  <div className="relative rounded-[2.75rem] bg-slate-950 p-[8px]">
                    <div className="relative overflow-hidden rounded-[2.2rem] bg-slate-100 px-2.5 pt-2 pb-2.5">
                      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-tr from-transparent via-white/10 to-white/25"></div>

                      <div className="relative z-10 mb-2 flex items-center justify-between px-2 text-[9px] font-bold text-slate-900">
                        <span>9:41</span>
                        <div className="flex h-[15px] w-[68px] items-center justify-end rounded-full bg-slate-950 px-1.5">
                          <span className="h-2 w-2 rounded-full bg-gradient-to-tr from-indigo-950 via-sky-900 to-slate-800"></span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-800">
                          <Wifi className="h-2.5 w-2.5" />
                          <BatteryFull className="h-3 w-3" />
                        </div>
                      </div>

                      <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 p-3 text-white">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-sky-100">
                            {t.phone_shop}
                          </span>
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold">
                            {t.phone_live}
                          </span>
                        </div>
                        <p id="phone-revenue" className="mt-1 font-display text-lg">
                          154 500 FCFA
                        </p>
                        <p className="text-[9px] text-sky-100">{t.phone_today}</p>
                      </div>

                      <div className="mt-2.5 rounded-2xl bg-white p-2.5 shadow-sm">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white">
                              <Mic className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              {t.icon_voice}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">
                              <QrCode className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              {t.icon_qr}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-white">
                              <Bike className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              {t.icon_drivers}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white">
                              <Camera className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              {t.icon_pod}
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
                              {t.icon_loyalty}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white">
                              <ShoppingBag className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-700">
                              Live
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mx-auto mt-2.5 h-1 w-20 rounded-full bg-slate-900/80"></div>
                    </div>
                  </div>
                </div>

                {/* Floating Live Activity Card */}
                <div className="animate-float relative mt-3 sm:mt-0 sm:absolute sm:-bottom-4 sm:-left-10 z-30 w-full sm:w-[235px] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      {t.card_receipts}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-600">
                      154 500 F
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 text-[11px]">
                    <div className="flex justify-between rounded-lg bg-slate-50 px-2.5 py-1">
                      <span className="text-slate-600">T-Money</span>
                      <span className="font-bold">68 000 F</span>
                    </div>
                    <div
                      key={animKey}
                      id="phone-live-banner"
                      className="live-feed-item rounded-lg bg-[#EFF4FF] px-2.5 py-1.5 font-semibold text-slate-800"
                    >
                      <span id="live-banner-text">
                        {LIVE_EVENTS[lang][liveIdx]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Human Social Proof + Key Guarantees (Under the Fold) */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-5">
        {/* Human Testimonial Card */}
        <div className="card-hover rounded-3xl julaya-cream p-5 sm:p-7 flex flex-col sm:flex-row items-center gap-5 reveal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/testimonial-lome.jpg"
            alt={t.test_img_alt}
            className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-2xl object-cover object-top shadow-md"
          />
          <div className="text-center sm:text-left">
            <div className="text-amber-500 text-xs mb-1">
              ★★★★★{' '}
              <span className="text-slate-500 font-semibold ml-1">
                {t.test_tag}
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#242424] leading-relaxed">
              {t.test_quote}
            </p>
            <p className="mt-2 text-xs font-bold text-slate-600">
              {t.test_author}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-hover rounded-2xl julaya-ice p-5 text-center reveal">
            <p className="font-display text-2xl sm:text-3xl text-[#242424]">
              {t.stat_1_val}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {t.stat_1_desc}
            </p>
          </div>
          <div className="card-hover rounded-2xl bg-[#FCD9B6]/60 p-5 text-center reveal">
            <p className="font-display text-2xl sm:text-3xl text-[#242424]">
              {t.stat_3_val}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {t.stat_3_desc}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Before vs With Kaba Kaba Table */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 reveal">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h2 className="font-display text-2xl sm:text-3xl uppercase text-[#242424]">
            {t.comp_title}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Before */}
          <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6">
            <p className="font-display text-sm uppercase text-rose-700 mb-4">
              {t.comp_before_title}
            </p>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">•</span>
                <span>{t.comp_b1}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">•</span>
                <span>{t.comp_b2}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-500 font-bold">•</span>
                <span>{t.comp_b3}</span>
              </li>
            </ul>
          </div>

          {/* After */}
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
            <p className="font-display text-sm uppercase text-emerald-800 mb-4">
              {t.comp_after_title}
            </p>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-800 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{t.comp_a1}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{t.comp_a2}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{t.comp_a3}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. How it works (3 Quick Steps) */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center font-display text-2xl sm:text-3xl uppercase text-[#242424] mb-8 reveal">
          {t.steps_title}
        </h2>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="card-hover rounded-2xl border border-slate-200 bg-white p-6 reveal">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full julaya-gradient font-display text-sm text-[#242424]">
              1
            </span>
            <h3 className="mt-3 font-display text-base uppercase text-[#242424]">
              {t.step_1_t}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
              {t.step_1_d}
            </p>
          </div>

          <div className="card-hover rounded-2xl border border-slate-200 bg-white p-6 reveal">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full julaya-gradient font-display text-sm text-[#242424]">
              2
            </span>
            <h3 className="mt-3 font-display text-base uppercase text-[#242424]">
              {t.step_2_t}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
              {t.step_2_d}
            </p>
          </div>

          <div className="card-hover rounded-2xl border border-slate-200 bg-white p-6 reveal">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full julaya-gradient font-display text-sm text-[#242424]">
              3
            </span>
            <h3 className="mt-3 font-display text-base uppercase text-[#242424]">
              {t.step_3_t}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
              {t.step_3_d}
            </p>
          </div>
        </div>
      </section>

      {/* 6. Simple Transparent Offer + Double Conversion CTA */}
      <section id="action" className="julaya-dark py-14 text-white mt-6">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 reveal">
          <span className="inline-block rounded-full bg-white/15 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FCD9B6]">
            {t.final_badge}
          </span>
          <h2 className="mt-4 font-display text-2xl sm:text-4xl uppercase leading-tight">
            {t.final_title}
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            {t.final_desc}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
            <Link
              href="/signup"
              id="btn-final-signup"
              className="btn-motion btn-shimmer w-full sm:w-auto flex-1 rounded-full julaya-pill-gradient px-6 py-3.5 text-xs sm:text-sm font-extrabold text-[#242424]"
            >
              {t.final_cta_1}
            </Link>
            <a
              href="https://wa.me/22890123456?text=Bonjour%2C%20je%20souhaite%20tester%20Kaba%20Kaba%20pour%20mon%20activit%C3%A9%20%C3%A0%20Lom%C3%A9."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-motion w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400 bg-emerald-500/15 px-6 py-3.5 text-xs sm:text-sm font-bold text-emerald-300 hover:bg-emerald-500/25"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{t.final_cta_2}</span>
            </a>
          </div>

          <p className="mt-8 text-[11px] text-slate-400">
            © {saasName} 2026 — Lomé, Togo
          </p>
        </div>
      </section>

      {/* Sticky Mobile Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 flex items-center justify-between md:hidden shadow-lg">
        <div>
          <p className="text-xs font-extrabold text-[#242424]">{saasName}</p>
          <p className="text-[10px] text-slate-600 font-semibold">
            {t.mobile_bar_sub}
          </p>
        </div>
        <Link
          href="/signup"
          className="btn-motion btn-shimmer rounded-full julaya-dark px-4 py-2 text-xs font-bold text-white"
        >
          {t.nav_cta}
        </Link>
      </div>
    </div>
  )
}
