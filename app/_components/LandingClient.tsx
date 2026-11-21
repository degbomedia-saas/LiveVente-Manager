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
  AlertCircle,
  ArrowRight,
  Bike,
  Check,
  CheckCircle2,
  MapPin,
  MessageCircle,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

const DEMO_STEPS = [
  {
    step: '1 / 3',
    title: 'Commande WhatsApp saisie',
    detail: 'Robe Wax Royale • 15 000 FCFA',
    badge: 'À confirmer',
    badgeClass: 'bg-[#451A03]/60 text-[#FCD34D] border-[#F59E0B]/50',
  },
  {
    step: '2 / 3',
    title: 'Repère local & paiement',
    detail: 'Face pharmacie Nation, Tokoin',
    badge: 'T-Money • Payé',
    badgeClass: 'bg-[#713F12] text-[#FDE047] border-[#EAB308]/50',
  },
  {
    step: '3 / 3',
    title: 'Livreur assigné en 1 clic',
    detail: 'Koffi M. en route • Recette sécurisée',
    badge: 'En route ✓',
    badgeClass: 'bg-[#082F49]/70 text-[#7DD3FC] border-[#0EA5E9]/50',
  },
]

const QUARTIERS = ['Déckon', 'Hedzranawoé', 'Tokoin', 'Agoè', 'Autre'] as const

export function LandingClient() {
  const shouldReduceMotion = useReducedMotion()
  const [heroPhone, setHeroPhone] = useState('')
  const [demoStep, setDemoStep] = useState(0)

  // Formulaire VIP
  const [brandName, setBrandName] = useState('')
  const [quartier, setQuartier] = useState<(typeof QUARTIERS)[number]>('Déckon')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (shouldReduceMotion) return
    const timer = setInterval(() => {
      setDemoStep((prev) => (prev + 1) % DEMO_STEPS.length)
    }, 2600)
    return () => clearInterval(timer)
  }, [shouldReduceMotion])

  function handleHeroSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (heroPhone.trim()) {
      setWhatsapp(heroPhone.trim())
    }
    const formEl = document.getElementById('vip-form')
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' })
    }
  }

  function handleVipSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!whatsapp.trim()) return
    setSubmitted(true)
  }

  const activeDemo = DEMO_STEPS[demoStep]
  const whatsappConfirmUrl = `https://wa.me/22890000000?text=${encodeURIComponent(
    `Bonjour Kaba Kaba ! Je souhaite réserver mon Accès Fondateur (2 mois gratuits).\nBoutique : ${
      brandName.trim() || 'Non précisé'
    }\nQuartier : ${quartier}\nMon WhatsApp : ${whatsapp.trim()}`
  )}`

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC] relative overflow-hidden selection:bg-[#10B981]/30 selection:text-[#6EE7B7]">
        {/* Arrière-plan Dark Tech anti-reflets */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
        >
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
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
                : { scale: [1, 1.1, 1], opacity: [0.16, 0.24, 0.16] }
            }
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 -left-24 h-[400px] w-[400px] rounded-full bg-[#10B981] blur-3xl opacity-20 will-change-transform"
          />
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : { scale: [1, 1.08, 1], opacity: [0.15, 0.22, 0.15] }
            }
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-[#0284C7] blur-3xl opacity-20 will-change-transform"
          />
        </div>

        {/* [ HEADER FIXE ] */}
        <header className="sticky top-0 z-40 border-b border-[#1E293B] bg-[#0B132B]/90 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <Link href="/" className="shrink-0">
              <KabaKabaLogo className="h-8 sm:h-9 w-auto" />
            </Link>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
              >
                Connexion
              </Link>
              <a
                href="#vip-form"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#10B981] hover:bg-[#059669] text-[#0B132B] shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
              >
                <span>Rejoindre la liste VIP</span>
              </a>
            </div>
          </div>
        </header>

        <main className="relative z-10">
          {/* [ HERO SECTION ] */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
            <div className="max-w-3xl mx-auto text-center">
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight leading-[1.1] text-[#F8FAFC]"
              >
                Finis les trous de caisse et les{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#38BDF8]">
                  livraisons perdues à Lomé.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                className="mt-5 text-base sm:text-lg text-[#94A3B8] leading-relaxed"
              >
                L&apos;application mobile conçue pour les commerçantes de mode
                qui vendent sur WhatsApp et TikTok. Suivez vos colis, cadrez vos
                livreurs et encaissez chaque franc sans stress.
              </motion.p>

              {/* CTA Principal : Champ WhatsApp (+228) -> Bouton Obtenir mon accès pilote */}
              <motion.form
                onSubmit={handleHeroSubmit}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16 }}
                className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-xl mx-auto"
              >
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#10B981]">
                    +228
                  </span>
                  <input
                    type="tel"
                    value={heroPhone}
                    onChange={(e) => setHeroPhone(e.target.value)}
                    placeholder="Numéro WhatsApp (ex: 90 12 34 56)"
                    className="w-full pl-14 pr-4 py-3.5 rounded-2xl bg-[#131C31] border border-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-[#0B132B] shadow-[0_0_28px_rgba(16,185,129,0.35)] transition-all shrink-0 cursor-pointer"
                >
                  <span>Obtenir mon accès pilote</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.form>

              {/* Preuve sociale immédiate */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.24 }}
                className="mt-4 inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-[#94A3B8]"
              >
                <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                Déjà <strong className="text-[#F8FAFC]">42 boutiques</strong>{' '}
                inscrites à Déckon, Hedzranawoé et Agoè.
              </motion.p>
            </div>
          </section>

          {/* [ SECTION LA DOULEUR DU TERRAIN (3 Blocs Visuels) ] */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-t border-[#1E293B]">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#0284C7]">
                La réalité du terrain
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
                Ce qui vous fait perdre de l&apos;argent chaque semaine
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-[#1E293B] bg-[#131C31] p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#450A0A]/60 border border-[#EF4444]/40 text-[#FCA5A5] flex items-center justify-center">
                  <PhoneOff className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F8FAFC]">
                  Le livreur injoignable avec votre argent
                </h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Fini les allers-retours pour savoir où est passée la recette
                  de la journée.
                </p>
              </div>

              <div className="rounded-2xl border border-[#1E293B] bg-[#131C31] p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#451A03]/60 border border-[#F59E0B]/40 text-[#FCD34D] flex items-center justify-center">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F8FAFC]">
                  La cliente qui annule au portail
                </h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Système de confirmation avant envoi pour stopper les frais de
                  course inutiles.
                </p>
              </div>

              <div className="rounded-2xl border border-[#1E293B] bg-[#131C31] p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#064E3B]/70 border border-[#10B981]/40 text-[#6EE7B7] flex items-center justify-center">
                  <Wallet className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F8FAFC]">
                  Le casse-tête Flooz, TMoney et Cash
                </h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Séparation nette en un clic entre ce que le client paie et ce
                  que le livreur doit vous remettre.
                </p>
                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#064E3B] text-[#6EE7B7] border border-[#059669]/50">
                    Espèces
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#713F12] text-[#FDE047] border border-[#EAB308]/50">
                    T-Money
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#1E3A8A] text-[#93C5FD] border border-[#2563EB]/50">
                    Flooz
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* [ SECTION DÉMO RAPIDE ] */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-t border-[#1E293B]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#10B981]">
                  Démo rapide • 3 clics
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
                  Enregistrez une livraison en moins de 20 secondes
                </h2>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Ajoutez la commande reçue sur WhatsApp ou TikTok, notez le
                  repère exact à Lomé et suivez l&apos;encaissement en direct.
                </p>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-[#1E293B] bg-[#131C31] p-5 sm:p-6 shadow-xl">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1E293B] text-xs text-[#94A3B8]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#F8FAFC]">
                      <MapPin className="h-3.5 w-3.5 text-[#0284C7]" />
                      Face pharmacie Nation, Tokoin
                    </span>
                    <span className="font-mono text-[#10B981]">
                      Étape {activeDemo.step}
                    </span>
                  </div>

                  <div className="min-h-[86px] flex items-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeDemo.step}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.28 }}
                        className="w-full rounded-xl bg-[#0B1120] border border-[#1E293B] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-[#0284C7]/15 text-[#38BDF8] flex items-center justify-center shrink-0">
                            <Bike className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#F8FAFC]">
                              {activeDemo.title}
                            </p>
                            <p className="text-xs text-[#94A3B8]">
                              {activeDemo.detail}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center self-start sm:self-center px-2.5 py-1 rounded-md text-xs font-semibold border ${activeDemo.badgeClass}`}
                        >
                          {activeDemo.badge}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {DEMO_STEPS.map((s, idx) => (
                      <button
                        key={s.step}
                        type="button"
                        onClick={() => setDemoStep(idx)}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          idx === demoStep ? 'bg-[#10B981]' : 'bg-[#1E293B]'
                        }`}
                        aria-label={`Étape ${s.step}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* [ OFFRE FONDATEUR + FORMULAIRE DE CAPTURE MINIMAL ] */}
          <section
            id="vip-form"
            className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-[#1E293B]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Offre Fondateur */}
              <div className="lg:col-span-6 rounded-2xl border border-[#10B981]/35 bg-[#131C31] p-6 sm:p-8 space-y-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#6EE7B7] border border-[#10B981]/30">
                  <Sparkles className="h-3.5 w-3.5" />
                  OFFRE FONDATEUR • PLACES LIMITÉES
                </span>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] leading-snug">
                  Accès Fondateur : Gratuit pendant 2 mois pour les 50
                  premières boutiques de Lomé.
                </h2>

                <ul className="space-y-3 text-sm text-[#F8FAFC]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-[#10B981] shrink-0 mt-0.5" />
                    <span>
                      Formation personnalisée dans votre boutique offerte.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-[#0284C7] shrink-0 mt-0.5" />
                    <span>
                      Ligne directe WhatsApp avec les fondateurs pour adapter
                      l&apos;outil à vos besoins.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Formulaire de Capture Minimal */}
              <div className="lg:col-span-6 rounded-2xl border border-[#1E293B] bg-[#131C31] p-6 sm:p-8">
                {submitted ? (
                  <div className="text-center space-y-4 py-6">
                    <div className="h-12 w-12 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center mx-auto">
                      <Check className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-[#F8FAFC]">
                      Place réservée !
                    </h3>
                    <p className="text-sm text-[#94A3B8]">
                      Confirmez votre demande sur WhatsApp en 1 clic pour
                      activer vos 2 mois gratuits ou créez votre compte dès
                      maintenant.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <a
                        href={whatsappConfirmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-[#0B132B] transition"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Confirmer sur WhatsApp</span>
                      </a>
                      <Link
                        href="/register"
                        className="inline-flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold border border-[#1E293B] bg-[#0B1120] hover:bg-[#1E293B] text-[#F8FAFC] transition"
                      >
                        Créer mon compte
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleVipSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="brandName"
                        className="block text-xs font-semibold text-[#94A3B8] mb-1.5"
                      >
                        Nom de la boutique / Marque
                      </label>
                      <input
                        id="brandName"
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="Ex : Élégance Wax Lomé"
                        className="w-full px-3.5 py-3 rounded-xl bg-[#0B1120] border border-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="quartier"
                        className="block text-xs font-semibold text-[#94A3B8] mb-1.5"
                      >
                        Quartier
                      </label>
                      <select
                        id="quartier"
                        value={quartier}
                        onChange={(e) =>
                          setQuartier(
                            e.target.value as (typeof QUARTIERS)[number]
                          )
                        }
                        className="w-full px-3.5 py-3 rounded-xl bg-[#0B1120] border border-[#1E293B] text-sm text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                      >
                        {QUARTIERS.map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="whatsapp"
                        className="block text-xs font-semibold text-[#94A3B8] mb-1.5"
                      >
                        Numéro WhatsApp (obligatoire) *
                      </label>
                      <input
                        id="whatsapp"
                        type="tel"
                        required
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="Ex : +228 90 12 34 56"
                        className="w-full px-3.5 py-3 rounded-xl bg-[#0B1120] border border-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 px-5 rounded-xl text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-[#0B132B] shadow-[0_0_24px_rgba(16,185,129,0.3)] transition cursor-pointer"
                    >
                      Réserver mes 2 mois gratuits
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </main>

        {/* [ FOOTER SIMPLE ] */}
        <footer className="relative z-10 border-t border-[#1E293B] bg-[#0B132B] py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]">
            <div className="flex items-center gap-3">
              <KabaKabaLogo className="h-7 w-auto" />
              <span>Made in Lomé pour les entrepreneurs togolais.</span>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/login" className="hover:text-[#F8FAFC] transition">
                Connexion
              </Link>
              <Link
                href="/register"
                className="hover:text-[#10B981] transition"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
