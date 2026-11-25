'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatAuthError } from '@/lib/auth-errors'
import { activateCourierAccount } from '@/app/actions/couriers'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

function normalizeIdentifierToEmail(rawInput: string): {
  resolvedEmail: string
  isPhone: boolean
  displayPhone?: string
} {
  const trimmed = rawInput.trim()
  if (trimmed.includes('@')) {
    return {
      resolvedEmail: trimmed.toLowerCase(),
      isPhone: false,
    }
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 8) {
    const normalizedDigits =
      digits.length === 8
        ? `228${digits}`
        : digits.startsWith('00228')
          ? digits.slice(2)
          : digits
    return {
      resolvedEmail: `${normalizedDigits}@kabakaba.tg`,
      isPhone: true,
      displayPhone: `+${normalizedDigits}`,
    }
  }

  return {
    resolvedEmail: trimmed.toLowerCase(),
    isPhone: false,
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [rawSupabaseError, setRawSupabaseError] = useState<string | null>(null)
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setServerError(null)
    setRawSupabaseError(null)
    setEmailNotConfirmed(false)
    setResendMessage(null)

    try {
      const cleanId = identifier.trim()
      const fieldErrors: Record<string, string> = {}

      if (!cleanId) {
        fieldErrors.email =
          'Veuillez saisir votre adresse email ou votre numéro WhatsApp (+228).'
      } else if (!cleanId.includes('@') && cleanId.replace(/\D/g, '').length < 8) {
        fieldErrors.email =
          'Saisissez un email valide (ex: vous@exemple.com) ou un numéro à 8 chiffres (ex: 90 12 34 56).'
      }

      if (!password) {
        fieldErrors.password = 'Mot de passe requis.'
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
        setLoading(false)
        return
      }

      const { resolvedEmail, isPhone } = normalizeIdentifierToEmail(cleanId)

      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      })

      if (error) {
        setEmailNotConfirmed(error.message === 'Email not confirmed')
        const formatted = formatAuthError(error.message)
        setServerError(
          isPhone && error.message === 'Invalid login credentials'
            ? 'Identifiants invalides avec ce numéro. Si vous avez créé votre compte avec une adresse email, connectez-vous avec votre email (ou créez votre compte gratuit).'
            : formatted || error.message || 'Email ou mot de passe incorrect.'
        )
        setRawSupabaseError(
          `Supabase Auth (${error.status ?? '400'}${error.code ? ` / ${error.code}` : ''}) : "${error.message}" [identifiant testé : ${resolvedEmail}]`
        )
        setLoading(false)
        return
      }

      let destination = '/dashboard'
      if (data.user) {
        try {
          await activateCourierAccount({
            invitedProfileId:
              (data.user.user_metadata?.courier_profile_id as string) || null,
            email: data.user.email || null,
          })

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()

          if (profile?.role === 'super_admin' || profile?.role === 'admin') {
            destination = '/admin'
          } else if (
            profile?.role === 'courier' ||
            profile?.role === 'driver' ||
            data.user.user_metadata?.role === 'courier'
          ) {
            destination = '/mes-livraisons'
          }
        } catch (profileErr) {
          console.warn('Erreur vérification profil rôle:', profileErr)
        }
      }

      router.push(destination)
      router.refresh()

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            window.location.href = destination
          }
        }, 800)
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Connexion interrompue ou signal réseau trop faible. Veuillez réessayer.'
      console.error('Erreur connexion:', err)
      setServerError(msg)
      setRawSupabaseError(`Exception client : ${msg}`)
      setLoading(false)
    }
  }

  async function handleResendConfirmation() {
    setResending(true)
    setResendMessage(null)

    const { resolvedEmail } = normalizeIdentifierToEmail(identifier)
    if (!resolvedEmail || !resolvedEmail.includes('@')) {
      setServerError('Adresse email invalide pour le renvoi.')
      setResending(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: resolvedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
      },
    })

    if (error) {
      setServerError(formatAuthError(error.message))
      setRawSupabaseError(`Supabase Resend : "${error.message}"`)
    } else {
      setResendMessage(
        'Email de confirmation renvoyé. Vérifiez votre boîte mail et vos spams.'
      )
    }
    setResending(false)
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

      {/* Carte de connexion */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Connexion</h2>
        <p className="text-gray-500 text-sm mb-6">
          Pas encore de compte ?{' '}
          <Link
            href="/signup"
            className="text-blue-700 font-semibold hover:underline"
          >
            Créer un compte
          </Link>
        </p>

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          {/* Email ou WhatsApp */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Adresse email ou Numéro WhatsApp (+228)
            </label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="vous@exemple.com ou 90 12 34 56"
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
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Mot de passe
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 transition ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {serverError && (
            <div className="bg-red-50 border-2 border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm space-y-2 shadow-xs">
              <div className="flex items-start gap-2.5 font-bold">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <span>{serverError}</span>
              </div>
              {rawSupabaseError && (
                <p className="text-xs font-mono bg-red-100/80 border border-red-200 rounded-lg px-2.5 py-1.5 text-red-900 break-words">
                  {rawSupabaseError}
                </p>
              )}
              {emailNotConfirmed && (
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendConfirmation}
                  className="text-xs font-bold text-blue-800 underline hover:opacity-80 disabled:opacity-50 block mt-1"
                >
                  {resending
                    ? 'Envoi en cours...'
                    : "Renvoyer l'email de confirmation"}
                </button>
              )}
            </div>
          )}

          {resendMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-semibold">
              ✅ {resendMessage}
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2 shadow-md active:scale-98 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="animate-spin text-lg">⏳</span>
                <span>Connexion en cours...</span>
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-slate-300 text-xs mt-6">
        © 2026 kaba kaba. Tous droits réservés.
      </p>
    </div>
  )
}
