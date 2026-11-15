'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : error.message
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo / Titre */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
          <span className="text-3xl">🚀</span>
        </div>
        <h1 className="text-3xl font-bold text-white">LiveVente Manager</h1>
        <p className="text-blue-200 mt-1">Gérez vos ventes et livraisons</p>
      </div>

      {/* Carte de connexion */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Connexion</h2>
        <p className="text-gray-500 text-sm mb-6">
          Pas encore de compte ?{' '}
          <Link href="/register" className="text-blue-700 font-semibold hover:underline">
            Créer un compte
          </Link>
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition"
            />
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Connexion en cours...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-blue-200 text-xs mt-6">
        © {new Date().getFullYear()} LiveVente Manager. Tous droits réservés.
      </p>
    </div>
  )
}
