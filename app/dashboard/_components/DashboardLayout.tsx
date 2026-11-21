'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  ShoppingCart,
  PackageCheck,
  Wallet,
  Users,
  Tag,
  Bike,
  Settings,
  LogOut,
  ChevronDown,
  Layers,
  Truck,
  Sparkles,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ThemePalette } from '@/lib/supabase/ensure-profile'

interface DashboardLayoutProps {
  children: React.ReactNode
  userName: string
  companyName: string
  userRole?: string
  logoUrl?: string | null
  themePalette?: ThemePalette | null
}

function TopNavContent({
  userName,
  companyName,
  userRole,
  logoUrl,
  themePalette,
}: {
  userName: string
  companyName: string
  userRole?: string
  logoUrl?: string | null
  themePalette?: ThemePalette | null
}) {
  const isCourier = userRole === 'courier'
  const isSuperAdmin = userRole === 'super_admin'
  const isOwner = userRole === 'owner' || isSuperAdmin
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')

  const [menuOpen, setMenuOpen] = useState(false)
  const [gestionOpen, setGestionOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  const gestionRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Fermer les menus déroulants au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (gestionRef.current && !gestionRef.current.contains(event.target as Node)) {
        setGestionOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Synchroniser l'attribut data-theme sur <html>
  useEffect(() => {
    if (themePalette && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themePalette)
    }
  }, [themePalette])

  // Fermer les menus au changement de route
  useEffect(() => {
    setGestionOpen(false)
    setMenuOpen(false)
    setMobileMoreOpen(false)
  }, [pathname, tab])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Détection de l'état actif du flux en 4 étapes
  const isStep1Active = pathname === '/dashboard'
  const isStep2Active = pathname === '/dashboard/orders' && tab !== 'packing'
  const isStep3Active = pathname === '/dashboard/packing' || (pathname === '/dashboard/orders' && tab === 'packing')
  const isStep4Active = pathname === '/dashboard/payments' || pathname === '/paiements'

  // Détection de l'état actif des pages secondaires de gestion
  const isGestionActive =
    pathname.startsWith('/dashboard/clients') ||
    pathname.startsWith('/dashboard/products') ||
    pathname.startsWith('/dashboard/couriers') ||
    pathname.startsWith('/dashboard/analytics') ||
    pathname.startsWith('/dashboard/settings')

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identité Boutique */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            {logoUrl ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={companyName || 'Boutique'} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center group-hover:bg-primary-hover transition shrink-0">
                <Sparkles className="w-5 h-5 text-white" strokeWidth={1.75} />
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary-soft-text leading-none">
                Boutique
              </p>
              <p className="text-sm font-bold text-slate-900 leading-tight truncate max-w-[190px] mt-0.5">
                {companyName || 'Élégance Wax Lomé'}
              </p>
            </div>
          </Link>

          {/* Navigation Desktop : flux linéaire en 4 étapes */}
          <nav className="hidden md:flex items-center gap-1">
            {isCourier ? (
              <Link
                href="/mes-livraisons"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                  pathname === '/mes-livraisons'
                    ? 'bg-primary-soft text-primary-soft-text'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Truck className="w-4 h-4" strokeWidth={1.75} />
                <span>Mes livraisons du jour</span>
              </Link>
            ) : (
              <>
                {[
                  { href: '/dashboard', label: 'Accueil', active: isStep1Active, Icon: LayoutDashboard, title: "Vue d'ensemble et métriques de la journée" },
                  { href: '/dashboard/orders', label: 'Commandes', active: isStep2Active, Icon: ShoppingCart, title: 'Prise et validation des commandes live' },
                  { href: '/dashboard/packing', label: 'Colisage', active: isStep3Active, Icon: PackageCheck, title: 'Numérotation séquentielle et remise aux livreurs' },
                  { href: '/dashboard/payments', label: 'Caisse', active: isStep4Active, Icon: Wallet, title: 'Contrôle caisse, encaissements et écarts de livraison' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition ${
                      item.active
                        ? 'bg-primary-soft text-primary-soft-text font-semibold'
                        : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <item.Icon className="w-4 h-4" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* Section Droite : Menu Déroulant Gestion + Profil */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Menu déroulant GESTION (Secondaire / Données) */}
            {isSuperAdmin && (
              <Link
                href="/super-admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 text-emerald-300 hover:bg-slate-800 border border-emerald-500/30 shadow-xs transition"
              >
                <span>⚡ Panneau Super Admin</span>
              </Link>
            )}

            {!isCourier && (
              <div className="relative" ref={gestionRef}>
                <button
                  type="button"
                  onClick={() => setGestionOpen(!gestionOpen)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border ${
                    isGestionActive || gestionOpen
                      ? 'bg-gray-100 text-gray-900 border-gray-300 shadow-2xs'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200/90'
                  }`}
                  title="Gestion secondaire : Clients, Produits, Livreurs"
                >
                  <Layers className="w-4 h-4 text-gray-500" />
                  <span>Gestion</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${gestionOpen ? 'rotate-180' : ''}`} />
                </button>

                {gestionOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-40 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Données & Administration
                      </p>
                    </div>

                    <Link
                      href="/dashboard/clients"
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50/60 transition ${
                        pathname.startsWith('/dashboard/clients') ? 'bg-blue-50 text-blue-900 font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-gray-900 leading-tight">Clients</p>
                        <p className="text-[11px] text-gray-500">Répertoire et coordonnées</p>
                      </div>
                    </Link>

                    <Link
                      href="/dashboard/products"
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-primary-soft transition ${
                        pathname.startsWith('/dashboard/products') ? 'bg-primary-soft text-primary-soft-text font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary-soft-text flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-gray-900 leading-tight">Produits</p>
                        <p className="text-[11px] text-gray-500">Catalogue, tailles & couleurs</p>
                      </div>
                    </Link>

                    <Link
                      href="/dashboard/couriers"
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-teal-50/60 transition ${
                        pathname.startsWith('/dashboard/couriers') ? 'bg-teal-50 text-teal-900 font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-teal-100/70 text-teal-700 flex items-center justify-center shrink-0">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-gray-900 leading-tight">Livreurs</p>
                        <p className="text-[11px] text-gray-500">Équipe et accès coursiers</p>
                      </div>
                    </Link>

                    <Link
                      href="/dashboard/analytics"
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-violet-50/60 transition ${
                        pathname.startsWith('/dashboard/analytics') ? 'bg-violet-50 text-violet-900 font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-100/70 text-violet-700 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-gray-900 leading-tight">Rapports &amp; Analytics</p>
                        <p className="text-[11px] text-gray-500">CA, quartiers &amp; export CSV</p>
                      </div>
                    </Link>

                    {isOwner && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <Link
                          href="/dashboard/settings"
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition ${
                            pathname.startsWith('/dashboard/settings') ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-700'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                            <Settings className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-gray-900 leading-tight">Paramètres boutique</p>
                            <p className="text-[11px] text-gray-500">Configuration générale</p>
                          </div>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Profil utilisateur & Déconnexion */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-gray-100/80 transition border border-transparent hover:border-gray-200"
              >
                <div className="w-8 h-8 bg-linear-to-br from-blue-700 to-indigo-800 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-2xs">
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:block text-xs font-semibold text-gray-700 max-w-[110px] truncate">
                  {userName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-40">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-[11px] text-gray-400">Connecté en tant que</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{userName}</p>
                    <span className="inline-block mt-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                      {isCourier ? 'Livreur' : isOwner ? 'Propriétaire' : 'Employé'}
                    </span>
                  </div>

                  {isOwner && (
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span>Paramètres boutique</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Mobile : Barre fixe moderne en bas d'écran */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-lg z-30">
        <div className="flex items-center justify-around py-1.5 px-2">
          {isCourier ? (
            <Link
              href="/mes-livraisons"
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition ${
                pathname === '/mes-livraisons' ? 'text-blue-800 font-bold' : 'text-gray-500'
              }`}
            >
              <Truck className="w-5 h-5" />
              <span className="text-[10px]">Livraisons</span>
            </Link>
          ) : (
            <>
              {/* 1. Accueil */}
              <Link
                href="/dashboard"
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                  isStep1Active ? 'text-blue-700 font-bold' : 'text-gray-500'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-[10px]">1. Accueil</span>
              </Link>

              {/* 2. Commandes */}
              <Link
                href="/dashboard/orders"
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                  isStep2Active ? 'text-blue-700 font-bold' : 'text-gray-500'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="text-[10px]">2. Ventes</span>
              </Link>

              {/* 3. Colisage */}
              <Link
                href="/dashboard/packing"
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                  isStep3Active ? 'text-amber-700 font-bold' : 'text-gray-500'
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                <span className="text-[10px]">3. Colisage</span>
              </Link>

              {/* 4. Rapprochement */}
              <Link
                href="/dashboard/payments"
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                  isStep4Active ? 'text-emerald-700 font-bold' : 'text-gray-500'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span className="text-[10px]">4. Caisse</span>
              </Link>

              {/* Plus / Gestion */}
              <button
                type="button"
                onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                  isGestionActive || mobileMoreOpen ? 'text-gray-900 font-bold' : 'text-gray-400'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="text-[10px]">Gestion</span>
              </button>
            </>
          )}
        </div>

        {/* Menu mobile dépliant pour la Gestion secondaire */}
        {mobileMoreOpen && !isCourier && (
          <div className="border-t border-gray-100 bg-white p-3 space-y-2 shadow-xl animate-in slide-in-from-bottom-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
              Gestion secondaire & Données
            </p>
            <div className="grid grid-cols-4 gap-2">
              <Link
                href="/dashboard/clients"
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900 text-center"
              >
                <Users className="w-4 h-4 text-blue-700 mb-1" />
                <span className="text-[11px] font-semibold">Clients</span>
              </Link>
              <Link
                href="/dashboard/products"
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-primary-soft border border-primary-border text-primary-soft-text text-center"
              >
                <Tag className="w-4 h-4 text-primary-soft-text mb-1" />
                <span className="text-[11px] font-semibold">Produits</span>
              </Link>
              <Link
                href="/dashboard/couriers"
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-teal-50/70 border border-teal-100 text-teal-900 text-center"
              >
                <Bike className="w-4 h-4 text-teal-700 mb-1" />
                <span className="text-[11px] font-semibold">Livreurs</span>
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-violet-50/70 border border-violet-100 text-violet-900 text-center"
              >
                <BarChart3 className="w-4 h-4 text-violet-700 mb-1" />
                <span className="text-[11px] font-semibold">Rapports</span>
              </Link>
            </div>
            {isOwner && (
              <Link
                href="/dashboard/settings"
                className="flex items-center justify-center gap-2 w-full p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-xs font-semibold"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Paramètres de la boutique</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function TopNav(props: {
  userName: string
  companyName: string
  userRole?: string
  logoUrl?: string | null
  themePalette?: ThemePalette | null
}) {
  return (
    <Suspense fallback={<div className="h-16 bg-white border-b border-gray-200/80" />}>
      <TopNavContent {...props} />
    </Suspense>
  )
}

export default function DashboardLayout({
  children,
  userName,
  companyName,
  userRole,
  logoUrl,
  themePalette,
}: DashboardLayoutProps) {
  return (
    <div
      data-theme={themePalette ?? 'indigo'}
      className="min-h-screen bg-slate-50 text-slate-900 font-sans"
    >
      <TopNav
        userName={userName}
        companyName={companyName}
        userRole={userRole}
        logoUrl={logoUrl}
        themePalette={themePalette}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
