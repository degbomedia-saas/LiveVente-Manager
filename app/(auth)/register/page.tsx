'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName]       = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [step, setStep]               = useState<'form' | 'check-email'>('form')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Étape 1 : Créer le compte Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }, // Métadonnées du compte
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Étape 2 : Si la session est disponible (email confirmation désactivée)
    if (data.session) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_company_and_profile',
        {
          p_full_name:    fullName,
          p_company_name: companyName,
        }
      )

      if (rpcError) {
        setError('Erreur lors de la création de votre entreprise : ' + rpcError.message)
        setLoading(false)
        return
      }

      const result = rpcData as { success: boolean; error?: string }
      if (!result.success) {
        setError(result.error || 'Une erreur est survenue.')
        setLoading(false)
        return
      }

      // Succès → tableau de bord
      router.push('/dashboard')
      router.refresh()
    } else {
      // Email de confirmation envoyé
      setStep('check-email')
      setLoading(false)
    }
  }

  // Écran de confirmation email
  if (step === 'check-email') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez votre email</h2>
          <p className="text-gray-500 mb-4">
            Un email de confirmation a été envoyé à <strong>{email}</strong>.
            <br />Cliquez sur le lien pour activer votre compte.
          </p>
          <Link
            href="/login"
            className="text-blue-700 font-semibold hover:underline text-sm"
          >
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo / Titre */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
          <span className="text-3xl">🚀</span>
        </div>
        <h1 className="text-3xl font-bold text-white">LiveVente Manager</h1>
        <p className="text-blue-200 mt-1">Créez votre compte gratuitement</p>
      </div>

      {/* Carte d'inscription */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Créer un compte</h2>
        <p className="text-gray-500 text-sm mb-6">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-blue-700 font-semibold hover:underline">
            Se connecter
          </Link>
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Nom complet */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Votre nom complet
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="ex : Kofi Mensah"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          {/* Nom de l'entreprise */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
              Nom de votre entreprise
            </label>
            <input
              id="companyName"
              type="text"
              required
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="ex : Livraison Express Lomé"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition"
            />
          </div>

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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
              <span className="text-gray-400 font-normal ml-1">(8 caractères min.)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 transition"
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
                Création en cours...
              </>
            ) : (
              'Créer mon compte'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center pt-1">
            En créant un compte, vous acceptez nos conditions d&apos;utilisation.
          </p>
        </form>
      </div>

      <p className="text-center text-blue-200 text-xs mt-6">
        © {new Date().getFullYear()} LiveVente Manager. Tous droits réservés.
      </p>
    </div>
  )
}
