'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DashboardLayoutProps {
  children: React.ReactNode
  userName: string
  companyName: string
}

function TopNav({ userName, companyName }: { userName: string; companyName: string }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-800 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">🚀</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs text-gray-500 leading-none">LiveVente Manager</p>
              <p className="text-sm font-semibold text-gray-900 leading-tight truncate max-w-[180px]">
                {companyName}
              </p>
            </div>
          </div>

          {/* Navigation desktop */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">
              🏠 Accueil
            </Link>
            <Link href="/dashboard/clients" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">
              👥 Clients
            </Link>
            <Link href="/dashboard/orders" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">
              📦 Commandes
            </Link>
            <Link href="/dashboard/deliveries" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">
              🚚 Livraisons
            </Link>
          </nav>

          {/* Profil utilisateur */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition"
            >
              <div className="w-8 h-8 bg-blue-800 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                {userName}
              </span>
              <span className="text-gray-400 text-xs">▼</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-40">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500">Connecté en tant que</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  🚪 Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation mobile (bas de page) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-30">
        <div className="flex items-center justify-around py-2">
          <Link href="/dashboard" className="flex flex-col items-center gap-1 px-3 py-2 text-gray-500">
            <span className="text-xl">🏠</span>
            <span className="text-xs">Accueil</span>
          </Link>
          <Link href="/dashboard/clients" className="flex flex-col items-center gap-1 px-3 py-2 text-gray-500">
            <span className="text-xl">👥</span>
            <span className="text-xs">Clients</span>
          </Link>
          <Link href="/dashboard/orders" className="flex flex-col items-center gap-1 px-3 py-2 text-gray-500">
            <span className="text-xl">📦</span>
            <span className="text-xs">Commandes</span>
          </Link>
          <Link href="/dashboard/deliveries" className="flex flex-col items-center gap-1 px-3 py-2 text-gray-500">
            <span className="text-xl">🚚</span>
            <span className="text-xs">Livraisons</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 px-4 py-2 text-gray-500"
          >
            <span className="text-xl">🚪</span>
            <span className="text-xs">Sortir</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default function DashboardLayout({ children, userName, companyName }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav userName={userName} companyName={companyName} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  )
}
