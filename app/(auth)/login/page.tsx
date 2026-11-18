'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setServerError(null)

    // ✅ RÈGLE AGENTS.md : Validation Zod AVANT la logique métier
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      setLoading(false)
      return
    }

    // ✅ Données validées — appel Supabase avec les données propres
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email:    result.data.email,
      password: result.data.password,
    })

    if (error) {
      // ✅ RÈGLE AGENTS.md : Message générique — ne pas révéler d'infos internes
      setServerError(
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : 'Une erreur est survenue. Veuillez réessayer.'
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

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition ${
                errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.email && (
              <p className="text-red-600 text-xs mt-1">{errors.email}</p>
            )}
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 transition ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Erreur serveur */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span>{serverError}</span>
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
