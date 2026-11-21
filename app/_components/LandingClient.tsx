'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'framer-motion'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

const LIVE_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Nouvelle commande • Tokoin',
    amount: '15 000 F CFA (Payé)',
    channel: 'T-Money',
    channelClass: 'bg-[#713F12] text-[#FDE047] border-[#EAB308]/50',
    courier: 'Koffi M. assigné',
  },
  {
    id: 2,
    title: 'Nouvelle commande • Agoè',
    amount: '24 500 F CFA (Validé)',
    channel: 'Flooz',
    channelClass: 'bg-[#1E3A8A] text-[#93C5FD] border-[#2563EB]/50',
    courier: 'En route',
  },
  {
    id: 3,
    title: 'Livraison validée • Bè-Klikamé',
    amount: '18 000 F CFA (Encaissé)',
    channel: 'Espèces',
    channelClass: 'bg-[#064E3B] text-[#6EE7B7] border-[#059669]/50',
    courier: 'Preuve photo reçue',
  },
]

function GlowCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group relative rounded-2xl border border-[#1E293B] bg-[#131C31]/85 backdrop-blur-md p-6 overflow-hidden transition-colors hover:border-[#10B981]/40 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(360px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.16), rgba(6, 182, 212, 0.08) 40%, transparent 75%)`,
        }}
      />
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </motion.div>
  )
}

function ConfirmBadgeDemo() {
  const [confirmed, setConfirmed] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (shouldReduceMotion) return
    const timer = setInterval(() => {
      setConfirmed((prev) => !prev)
    }, 2400)
    return () => clearInterval(timer)
  }, [shouldReduceMotion])

  return (
    <div className="mt-5 rounded-xl bg-slate-900/90 border border-white/10 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Robe Wax Royale • Afi K.</span>
        <span className="font-mono text-slate-300">#KK-409</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-300">
          Taille :{' '}
          <strong className="text-white">
            {confirmed ? 'L (Confirmée)' : 'En attente...'}
          </strong>
        </span>
        <motion.span
          key={confirmed ? 'ok' : 'wait'}
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
            confirmed
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
              : 'bg-amber-500/15 text-amber-300 border-amber-400/40'
          }`}
        >
          {confirmed ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Confirmée
            </>
          ) : (
            'À confirmer'
          )}
        </motion.span>
      </div>
    </div>
  )
}

function CourierGpsDemo() {
  return (
    <div className="mt-5 rounded-xl bg-slate-900/90 border border-white/10 p-3.5 relative overflow-hidden">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
        <span className="inline-flex items-center gap-1.5 text-cyan-300 font-medium">
          <MapPin className="h-3.5 w-3.5" />
          Tokoin → Adidogomé
        </span>
        <span className="text-[11px] text-emerald-400 font-semibold">
          En route
        </span>
      </div>
      <div className="relative h-10 rounded-lg bg-slate-950/80 border border-white/5 flex items-center px-4 overflow-hidden">
        <div className="w-full h-0.5 bg-gradient-to-r from-emerald-500/30 via-cyan-400/50 to-emerald-500/30 rounded-full" />
        <motion.div
          animate={{ x: [0, 120, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-4 flex items-center justify-center"
        >
          <span className="absolute h-6 w-6 rounded-full bg-cyan-400/30 animate-ping" />
          <span className="relative h-3.5 w-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.9)]" />
        </motion.div>
      </div>
    </div>
  )
}

function CashCounterDemo() {
  const [amount, setAmount] = useState(142500)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (shouldReduceMotion) return
    const timer = setInterval(() => {
      setAmount((prev) => (prev >= 217500 ? 142500 : prev + 15000))
    }, 1800)
    return () => clearInterval(timer)
  }, [shouldReduceMotion])

  return (
    <div className="mt-5 rounded-xl bg-slate-900/90 border border-white/10 p-3.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Caisse du jour (T-Money + Cash)</span>
        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <motion.span
          key={amount}
          initial={{ y: 6, opacity: 0.4 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-xl font-bold text-white tabular-nums tracking-tight"
        >
          {new Intl.NumberFormat('fr-FR').format(amount)}
        </motion.span>
        <span className="text-xs font-semibold text-emerald-400">FCFA</span>
      </div>
    </div>
  )
}

export function LandingClient() {
  const [notifIndex, setNotifIndex] = useState(0)
  const [annual, setAnnual] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (shouldReduceMotion) return
    const interval = setInterval(() => {
      setNotifIndex((prev) => (prev + 1) % LIVE_NOTIFICATIONS.length)
    }, 3200)
    return () => clearInterval(interval)
  }, [shouldReduceMotion])

  const activeNotif = LIVE_NOTIFICATIONS[notifIndex]
  const starterPrice = annual ? 7500 : 9000
  const proPrice = annual ? 12000 : 15000
  const enterprisePrice = annual ? 24000 : 30000

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC] relative overflow-hidden selection:bg-[#10B981]/30 selection:text-[#6EE7B7]">
        {/* Arrière-plan Dark Tech : Grille subtile + Orbes animées */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage:
                'radial-gradient(ellipse 80% 60% at 50% 15%, black 40%, transparent 100%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 80% 60% at 50% 15%, black 40%, transparent 100%)',
            }}
          />

          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : { scale: [1, 1.12, 1], opacity: [0.18, 0.26, 0.18] }
            }
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-emerald-500 blur-3xl opacity-20 will-change-transform"
          />

          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : { scale: [1, 1.1, 1], x: [0, -20, 0], opacity: [0.16, 0.24, 0.16] }
            }
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-24 -right-24 h-[460px] w-[460px] rounded-full bg-cyan-500 blur-3xl opacity-20 will-change-transform"
          />
        </div>

        {/* Navigation */}
        <header className="sticky top-0 z-40 border-b border-[#1E293B] bg-[#0B132B]/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <Link href="/" className="shrink-0">
              <KabaKabaLogo className="h-8 sm:h-9 w-auto" />
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <a
                href="#features"
                className="hover:text-emerald-400 transition-colors"
              >
                Fonctionnalités
              </a>
              <a
                href="#pricing"
                className="hover:text-cyan-400 transition-colors"
              >
                Tarifs
              </a>
            </nav>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/login"
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                className="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all"
              >
                Essai 14j gratuit
              </Link>
            </div>
          </div>
        </header>

        <main className="relative z-10">
          {/* Hero Section */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-20 lg:pt-24 lg:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
              <div className="lg:col-span-7 text-center lg:text-left">
                {/* Badge radar pulsant */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 text-emerald-300 text-xs sm:text-sm font-medium mb-6"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                  <span>
                    En direct à Lomé • La logistique nouvelle génération
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08]"
                >
                  Ne perdez plus jamais{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-200">
                    une vente ni un colis.
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.16 }}
                  className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
                >
                  Centralisez vos commandes WhatsApp, assignez vos livreurs moto
                  en un clic et sécurisez chaque franc encaissé via T-Money,
                  Moov ou espèces.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.24 }}
                  className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
                >
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full sm:w-auto"
                  >
                    <Link
                      href="/register"
                      className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl text-sm sm:text-base font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_35px_rgba(16,185,129,0.45)] overflow-hidden"
                    >
                      {/* Reflet shimmer continu */}
                      <motion.span
                        aria-hidden="true"
                        animate={
                          shouldReduceMotion
                            ? undefined
                            : { x: ['-120%', '220%'] }
                        }
                        transition={{
                          duration: 2.6,
                          repeat: Infinity,
                          repeatDelay: 1.2,
                          ease: 'easeInOut',
                        }}
                        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[-20deg]"
                      />
                      <span className="relative">Démarrer l&apos;essai gratuit (14j)</span>
                      <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </motion.div>

                  <Link
                    href="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm sm:text-base font-semibold text-slate-200 border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
                  >
                    Accéder à ma boutique
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-slate-400"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Sans carte bancaire
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Configuration en 2 minutes
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Espace Livreur Mobile inclus
                  </span>
                </motion.div>
              </div>

              {/* Maquette Flottante 3D du Dashboard */}
              <div className="lg:col-span-5">
                <motion.div
                  initial={{ opacity: 0, y: 24, rotateX: 6 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1, y: 0 }
                      : {
                          opacity: 1,
                          y: [0, -8, 0],
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.5 }
                      : {
                          opacity: { duration: 0.6, delay: 0.2 },
                          y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
                        }
                  }
                  className="relative rounded-3xl border border-white/15 bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 shadow-[0_25px_80px_-15px_rgba(6,182,212,0.28)] will-change-transform"
                >
                  {/* Barre fenêtre */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      dashboard.kaba-kaba.app
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  </div>

                  {/* Mini KPIs */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5">
                      <p className="text-[11px] text-slate-400">
                        CA Encaissé (Aujourd&apos;hui)
                      </p>
                      <p className="mt-1 text-lg sm:text-xl font-bold text-white tabular-nums">
                        187 500 F
                      </p>
                      <span className="text-[11px] text-emerald-400 font-medium">
                        +24% vs hier
                      </span>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5">
                      <p className="text-[11px] text-slate-400">
                        Colis en livraison
                      </p>
                      <p className="mt-1 text-lg sm:text-xl font-bold text-cyan-300 tabular-nums">
                        14 / 16
                      </p>
                      <span className="text-[11px] text-slate-400">
                        3 livreurs actifs
                      </span>
                    </div>
                  </div>

                  {/* Flux temps réel */}
                  <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Flux commandes en direct
                      </span>
                      <Zap className="h-3.5 w-3.5 text-cyan-400" />
                    </div>

                    <div className="min-h-[64px] flex items-center">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeNotif.id}
                          initial={{ opacity: 0, x: 18 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -18 }}
                          transition={{ duration: 0.3 }}
                          className="w-full rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {activeNotif.title}
                              </p>
                              <p className="text-[11px] text-emerald-300 font-medium">
                                {activeNotif.amount}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${activeNotif.channelClass}`}
                            >
                              {activeNotif.channel}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#F8FAFC]">
                              {activeNotif.courier}
                            </span>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Section Fonctionnalités Glow Hover */}
          <section
            id="features"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/10"
          >
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-400">
                <Sparkles className="h-3.5 w-3.5" />
                Conçu pour le terrain
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Zéro oubli. Zéro écart de caisse.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400">
                Chaque étape de votre vente — de la discussion WhatsApp jusqu&apos;à
                la remise au livreur moto — est tracée en temps réel.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlowCard>
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 flex items-center justify-center mb-4">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  File &laquo; À confirmer &raquo;
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">
                  Enregistrez une commande même si la cliente hésite encore sur
                  la taille ou le quartier. Validez en 1 clic dès qu&apos;elle
                  répond.
                </p>
                <ConfirmBadgeDemo />
              </GlowCard>

              <GlowCard>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center mb-4">
                  <Truck className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Espace Livreur Moto
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">
                  Vos livreurs voient uniquement leurs courses du jour sur mobile,
                  capturent la preuve photo et signalent la livraison en direct.
                </p>
                <CourierGpsDemo />
              </GlowCard>

              <GlowCard>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Clôture de Caisse
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">
                  Réconciliez automatiquement le cash en main des livreurs et les
                  paiements T-Money / Moov à la fin de chaque journée.
                </p>
                <CashCounterDemo />
              </GlowCard>
            </div>
          </section>

          {/* Section Tarifs Card Highlight */}
          <section
            id="pricing"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/10"
          >
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Un tarif clair, adapté à votre croissance
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400">
                Commencez gratuitement pendant 14 jours. Paiement simple via
                T-Money ou Moov Money.
              </p>

              {/* Switch Mensuel / Annuel */}
              <div className="mt-7 inline-flex items-center p-1 rounded-2xl bg-white/[0.05] border border-white/10">
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                    !annual ? 'text-slate-950' : 'text-slate-300'
                  }`}
                >
                  {!annual && (
                    <motion.span
                      layoutId="billing-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-white"
                    />
                  )}
                  <span className="relative z-10">Mensuel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                    annual ? 'text-slate-950' : 'text-slate-300'
                  }`}
                >
                  {annual && (
                    <motion.span
                      layoutId="billing-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400"
                    />
                  )}
                  <span className="relative z-10">Annuel</span>
                  <span
                    className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      annual
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    -20%
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Starter */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-7 flex flex-col">
                <h3 className="text-lg font-bold text-white">Starter</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Pour les boutiques qui démarrent
                </p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-white tabular-nums">
                    {new Intl.NumberFormat('fr-FR').format(starterPrice)}
                  </span>
                  <span className="text-xs text-slate-400">FCFA / mois</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-300 flex-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    Jusqu&apos;à 150 commandes / mois
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    1 boutique &amp; 2 livreurs
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    Suivi T-Money / Moov / Cash
                  </li>
                </ul>
                <Link
                  href="/register"
                  className="mt-8 w-full inline-flex justify-center py-3 px-4 rounded-xl text-sm font-semibold border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-white transition-colors"
                >
                  Commencer l&apos;essai
                </Link>
              </div>

              {/* Pro Illimité (Card Highlight avec bordure néon animée) */}
              <div className="relative rounded-3xl p-[2px] overflow-hidden shadow-[0_0_50px_-10px_rgba(16,185,129,0.45)]">
                <motion.div
                  aria-hidden="true"
                  animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,#10b981,#06b6d4,#14b8a6,#0f172a,#10b981)] will-change-transform"
                />
                <div className="relative h-full rounded-[22px] bg-slate-900/95 backdrop-blur-xl p-7 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-white">
                      Pro Illimité
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950">
                      RECOMMANDÉ
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Le choix des boutiques e-commerce actives à Lomé
                  </p>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300 tabular-nums">
                      {new Intl.NumberFormat('fr-FR').format(proPrice)}
                    </span>
                    <span className="text-xs text-slate-300">FCFA / mois</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-200 flex-1">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      Commandes &amp; colis illimités
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      Livreurs illimités + app mobile
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      Clôture de caisse &amp; preuves photo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      Personnalisation marque &amp; logo
                    </li>
                  </ul>
                  <Link
                    href="/register"
                    className="mt-8 w-full inline-flex justify-center py-3.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:opacity-95 shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all"
                  >
                    Démarrer 14 jours gratuits
                  </Link>
                </div>
              </div>

              {/* Entreprise */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-7 flex flex-col">
                <h3 className="text-lg font-bold text-white">Entreprise</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Pour les réseaux multi-boutiques et flottes
                </p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-white tabular-nums">
                    {new Intl.NumberFormat('fr-FR').format(enterprisePrice)}
                  </span>
                  <span className="text-xs text-slate-400">FCFA / mois</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-300 flex-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    Tout le forfait Pro Illimité
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    Multi-utilisateurs &amp; rôles avancés
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    Support prioritaire WhatsApp dédié
                  </li>
                </ul>
                <Link
                  href="/register"
                  className="mt-8 w-full inline-flex justify-center py-3 px-4 rounded-xl text-sm font-semibold border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-white transition-colors"
                >
                  Tester gratuitement
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/10 bg-slate-950/90 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <KabaKabaLogo className="h-7 w-auto" />
              <span>© {new Date().getFullYear()} Kaba Kaba • Lomé, Togo</span>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/login" className="hover:text-white transition-colors">
                Connexion
              </Link>
              <Link
                href="/register"
                className="hover:text-emerald-400 transition-colors"
              >
                Créer une boutique
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
