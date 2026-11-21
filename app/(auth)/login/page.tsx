'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema, loginSchema } from '@/lib/validations/auth'
import { formatAuthError } from '@/lib/auth-errors'
import { activateCourierAccount } from '@/app/actions/couriers'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setServerError(null)
    setEmailNotConfirmed(false)
    setResendMessage(null)

    try {
      const result = loginSchema.safeParse({ email, password })
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email:    result.data.email.trim(),
        password: result.data.password,
      })

      if (error) {
        setEmailNotConfirmed(error.message === 'Email not confirmed')
        const formatted = formatAuthError(error.message)
        setServerError(formatted || error.message || 'Email ou mot de passe incorrect.')
        setLoading(false)
        return
      }

      let destination = '/dashboard'
      if (data.user) {
        try {
          await activateCourierAccount({
            invitedProfileId: (data.user.user_metadata?.courier_profile_id as string) || null,
            email: data.user.email || null,
          })

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()

          if (profile?.role === 'super_admin') {
            destination = '/super-admin'
          } else if (
            profile?.role === 'courier' ||
            data.user.user_metadata?.role === 'courier'
          ) {
            destination = '/mes-livraisons'
          }
        } catch (profileErr) {
          console.warn('Erreur vérification profil rôle:', profileErr)
        }
      }

      // Redirection relative stricte : navigation client puis rechargement plein écran si nécessaire
      router.push(destination)
      router.refresh()

      // Sur certains navigateurs mobiles (ex: Safari iOS via IP locale), forcer la navigation plein écran
      // pour garantir la transmission des cookies de session fraîchement écrits
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            window.location.href = destination
          }
        }, 800)
      }
    } catch (err: any) {
      console.error('Erreur connexion:', err)
      setServerError(
        err?.message ||
          'Connexion interrompue ou signal réseau trop faible. Veuillez réessayer.'
      )
      setLoading(false)
    }
  }

  async function handleResendConfirmation() {
    setResending(true)
    setResendMessage(null)

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? 'Adresse email invalide.')
      setResending(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
      },
    })

    if (error) {
      setServerError(formatAuthError(error.message))
    } else {
      setResendMessage('Email de confirmation renvoyé. Vérifiez votre boîte mail et vos spams.')
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
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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

          {serverError && (
            <div className="bg-red-50 border-2 border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm space-y-2 shadow-xs">
              <div className="flex items-start gap-2.5 font-bold">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <span>{serverError}</span>
              </div>
              {emailNotConfirmed && (
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendConfirmation}
                  className="text-xs font-bold text-blue-800 underline hover:opacity-80 disabled:opacity-50 block mt-1"
                >
                  {resending ? 'Envoi en cours...' : 'Renvoyer l\'email de confirmation'}
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
            className="w-full min-h-[48px] bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2 shadow-md active:scale-98"
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
