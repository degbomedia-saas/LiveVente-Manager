'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatAuthError } from '@/lib/auth-errors'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'
import { LOME_QUARTIERS } from '@/lib/config/lome-zones'

function resolveSignupEmail(rawEmail: string, rawPhone: string): {
  resolvedEmail: string | null
  normalizedPhone: string | null
} {
  const cleanEmail = rawEmail.trim().toLowerCase()
  const phoneDigits = (rawPhone || (!cleanEmail.includes('@') ? cleanEmail : ''))
    .replace(/\D/g, '')

  let normalizedPhone: string | null = null
  if (phoneDigits.length >= 8) {
    normalizedPhone =
      phoneDigits.length === 8
        ? `228${phoneDigits}`
        : phoneDigits.startsWith('00228')
          ? phoneDigits.slice(2)
          : phoneDigits
  }

  if (cleanEmail.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      resolvedEmail: cleanEmail,
      normalizedPhone,
    }
  }

  if (normalizedPhone) {
    return {
      resolvedEmail: `${normalizedPhone}@kabakaba.tg`,
      normalizedPhone,
    }
  }

  return {
    resolvedEmail: null,
    normalizedPhone: null,
  }
}

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [zone, setZone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [rawSupabaseError, setRawSupabaseError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'check-email'>('form')

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
    setRawSupabaseError(null)

    const cleanFullName = fullName.trim()
    const cleanCompanyName = companyName.trim()
    const cleanPhone = phone.trim()
    const cleanZone = zone.trim()
    const { resolvedEmail, normalizedPhone } = resolveSignupEmail(
      email,
      cleanPhone
    )

    const fieldErrors: Record<string, string> = {}
    if (cleanFullName.length < 2) {
      fieldErrors.fullName = 'Le nom doit contenir au moins 2 caractères.'
    }
    if (cleanCompanyName.length < 2) {
      fieldErrors.companyName =
        "Le nom de l'entreprise doit contenir au moins 2 caractères."
    }
    if (!resolvedEmail) {
      fieldErrors.email =
        'Saisissez une adresse email valide ou votre numéro WhatsApp (+228).'
    }
    if (password.length < 6) {
      fieldErrors.password =
        'Le mot de passe doit contenir au moins 6 caractères.'
    }

    if (Object.keys(fieldErrors).length > 0 || !resolvedEmail) {
      setErrors(fieldErrors)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const formattedPhone =
      cleanPhone || (normalizedPhone ? `+${normalizedPhone}` : '')

    // Étape 1 : Créer le compte Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: resolvedEmail,
      password,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/confirm?next=/onboarding`
            : undefined,
        data: {
          full_name: cleanFullName,
          company_name: cleanCompanyName,
          ...(formattedPhone ? { phone: formattedPhone } : {}),
          ...(cleanZone ? { zone: cleanZone } : {}),
        },
      },
    })

    if (signUpError) {
      setServerError(formatAuthError(signUpError.message))
      setRawSupabaseError(
        `Supabase signUp (${signUpError.status ?? '400'}${signUpError.code ? ` / ${signUpError.code}` : ''}) : "${signUpError.message}" [identifiant : ${resolvedEmail}]`
      )
      setLoading(false)
      return
    }

    let activeSession = data.session
    let activeUser = data.user

    if (!activeSession) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      })
      if (signInData?.session) {
        activeSession = signInData.session
        activeUser = signInData.user
      }
    }

    // Étape 2 : Créer l'entreprise, le profil et la boutique
    if (activeSession && activeUser) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_company_and_profile',
        {
          p_full_name: cleanFullName,
          p_company_name: cleanCompanyName,
        }
      )

      if (rpcError) {
        setServerError(formatAuthError(rpcError.message))
        setRawSupabaseError(
          `Supabase RPC create_company_and_profile : "${rpcError.message}"`
        )
        setLoading(false)
        return
      }

      const rpcResult = rpcData as {
        success?: boolean
        company_id?: string
        error?: string
      } | null

      if (rpcResult && rpcResult.success === false) {
        setServerError(
          "Votre compte a été créé mais l'entreprise n'a pas pu être initialisée."
        )
        setRawSupabaseError(
          `RPC create_company_and_profile error : "${rpcResult.error ?? 'unknown'}"`
        )
        setLoading(false)
        return
      }

      // Synchroniser le téléphone, le quartier et la table stores
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', activeUser.id)
          .maybeSingle()

        const companyId = rpcResult?.company_id || prof?.company_id || null

        if (formattedPhone || cleanZone) {
          await supabase
            .from('profiles')
            .update({
              ...(formattedPhone ? { phone: formattedPhone } : {}),
              ...(cleanZone ? { zone: cleanZone } : {}),
            })
            .eq('id', activeUser.id)
        }

        await supabase.from('stores').upsert(
          {
            owner_id: activeUser.id,
            company_id: companyId,
            store_name: cleanCompanyName,
            whatsapp_phone: formattedPhone || null,
            city: cleanZone || 'Lomé — Déckon',
            palette_key: 'emerald',
            plan: 'free_mvp',
            plan_status: 'trial',
          },
          { onConflict: 'owner_id' }
        )
      } catch (syncErr) {
        console.warn('Synchronisation initiale stores/profiles:', syncErr)
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Vérifiez votre email
          </h2>
          <p className="text-gray-500 mb-4">
            Un email de confirmation a été envoyé à <strong>{email}</strong>.
            <br />
            Cliquez sur le lien pour activer votre compte.
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
        <KabaKabaLogo className="h-12 md:h-14 w-auto mx-auto mb-3" />
        <p className="text-slate-300 text-sm font-medium text-center">
          La logistique express de vos ventes et livraisons
        </p>
      </div>

      {/* Carte d'inscription */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Créer un compte
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Déjà un compte ?{' '}
          <Link
            href="/login"
            className="text-blue-700 font-semibold hover:underline"
          >
            Se connecter
          </Link>
        </p>

        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          {/* Nom complet */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Votre nom complet
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ex : Kofi Mensah"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition ${
                errors.fullName ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.fullName && (
              <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>
            )}
          </div>

          {/* Nom de l'entreprise */}
          <div>
            <label
              htmlFor="companyName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nom de votre boutique / entreprise
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ex : Livraison Express Lomé"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition ${
                errors.companyName
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200'
              }`}
            />
            {errors.companyName && (
              <p className="text-red-600 text-xs mt-1">{errors.companyName}</p>
            )}
          </div>

          {/* WhatsApp & Quartier de Lomé (saisie libre + datalist) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                WhatsApp (+228)
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+228 90 12 34 56"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="zone"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Quartier / Zone (Lomé ou libre)
              </label>
              <input
                id="zone"
                type="text"
                list="lome-quartiers-signup"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Tokoin, Agoè, Déckon..."
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="lome-quartiers-signup">
                {LOME_QUARTIERS.map((q) => (
                  <option key={q} value={q} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Email (ou connexion par WhatsApp si laissé vide) */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Adresse email{' '}
              <span className="text-gray-400 font-normal text-xs">
                (optionnel si WhatsApp +228 renseigné)
              </span>
            </label>
            <input
              id="email"
              type="text"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com (ou laissez vide pour utiliser votre n° +228)"
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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Mot de passe
              <span className="text-gray-400 font-normal ml-1">
                (6 caractères minimum)
              </span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 transition ${
                errors.password
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200'
              }`}
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Erreur serveur + vrai message Supabase */}
          {serverError && (
            <div className="bg-red-50 border-2 border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm space-y-2">
              <div className="flex items-start gap-2 font-bold">
                <span>⚠️</span>
                <span>{serverError}</span>
              </div>
              {rawSupabaseError && (
                <p className="text-xs font-mono bg-red-100/80 border border-red-200 rounded-lg px-2.5 py-1.5 text-red-900 break-words">
                  {rawSupabaseError}
                </p>
              )}
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2 cursor-pointer"
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
