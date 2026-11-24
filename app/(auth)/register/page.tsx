'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registerSchema } from '@/lib/validations/auth'
import { formatAuthError } from '@/lib/auth-errors'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName]       = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone]             = useState('')
  const [zone, setZone]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [step, setStep]               = useState<'form' | 'check-email'>('form')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const pPhone = params.get('phone')
    const pShop = params.get('shop')
    const pZone = params.get('zone')
    if (pPhone) setPhone(pPhone)
    if (pShop) setCompanyName(pShop)
    if (pZone) setZone(pZone)
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setServerError(null)

    // ✅ RÈGLE AGENTS.md : Validation Zod AVANT la logique métier
    const result = registerSchema.safeParse({ fullName, companyName, email, password })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Étape 1 : Créer le compte Supabase Auth avec données validées
    const { data, error: signUpError } = await supabase.auth.signUp({
      email:    result.data.email,
      password: result.data.password,
      options: {
        data: {
          full_name:    result.data.fullName,
          company_name: result.data.companyName,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(zone.trim() ? { zone: zone.trim() } : {}),
        },
      },
    })

    if (signUpError) {
      // ✅ RÈGLE AGENTS.md : Ne pas exposer les erreurs internes brutes
      setServerError(formatAuthError(signUpError.message))
      setLoading(false)
      return
    }

    // Étape 2 : Créer l'entreprise et le profil (via fonction SQL SECURITY DEFINER)
    if (data.session) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_company_and_profile',
        {
          p_full_name:    result.data.fullName,
          p_company_name: result.data.companyName,
        }
      )

      if (rpcError) {
        setServerError(formatAuthError(rpcError.message))
        setLoading(false)
        return
      }

      const rpcResult = rpcData as { success: boolean; error?: string }
      if (!rpcResult.success) {
        setServerError('Votre compte a été créé mais l\'entreprise n\'a pas pu être initialisée. Contactez le support.')
        setLoading(false)
        return
      }

      router.push('/onboarding')
      router.refresh()
    } else {
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
          <Link href="/login" className="text-blue-700 font-semibold hover:underline text-sm">
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
        <KabaKabaLogo className="h-12 md:h-14 w-auto mx-auto mb-3" />
        <p className="text-slate-300 text-sm font-medium text-center">
          La logistique express de vos ventes et livraisons
        </p>
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

        <form onSubmit={handleRegister} className="space-y-4" noValidate>

          {/* Nom complet */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Votre nom complet
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="ex : Kofi Mensah"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition ${
                errors.fullName ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.fullName && <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* Nom de l'entreprise */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
              Nom de votre entreprise
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="ex : Livraison Express Lomé"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition ${
                errors.companyName ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.companyName && <p className="text-red-600 text-xs mt-1">{errors.companyName}</p>}
          </div>

          {(phone || zone) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-gray-600 mb-1">
                  WhatsApp (+228)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+228 90 12 34 56"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="zone" className="block text-xs font-semibold text-gray-600 mb-1">
                  Quartier / Zone
                </label>
                <input
                  id="zone"
                  type="text"
                  value={zone}
                  onChange={e => setZone(e.target.value)}
                  placeholder="Tokoin, Agoè..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

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
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
              <span className="text-gray-400 font-normal ml-1">(8 car. min., 1 majuscule, 1 chiffre)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 transition ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password}</p>}
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

      <p className="text-center text-slate-300 text-xs mt-6">
        © 2026 kaba kaba. Tous droits réservés.
      </p>
    </div>
  )
}
