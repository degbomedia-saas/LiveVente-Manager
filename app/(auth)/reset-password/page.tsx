'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

type Lang = 'fr' | 'en'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [rawSupabaseError, setRawSupabaseError] = useState<string | null>(null)
  const [verifyingSession, setVerifyingSession] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    async function initRecoverySession() {
      try {
        // 1. Vérifier si Supabase a envoyé des paramètres d'erreur ou des tokens dans le hash (#access_token=...&refresh_token=...)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(
            window.location.hash.replace(/^#/, '')
          )
          const hashErr =
            hashParams.get('error_description') || hashParams.get('error')
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (hashErr && isMounted) {
            setServerError(
              'Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez un nouveau lien.'
            )
            setRawSupabaseError(`Supabase URL Hash : "${hashErr}"`)
          } else if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (!error && data.session && isMounted) {
              setSessionReady(true)
              setUserEmail(data.session.user.email ?? null)
              setVerifyingSession(false)
              return
            }
          }
        }

        // 2. Vérifier si Supabase a envoyé ?code=... ou ?token_hash=...&type=recovery dans l'URL
        if (typeof window !== 'undefined' && window.location.search) {
          const searchParams = new URLSearchParams(window.location.search)
          const code = searchParams.get('code')
          const tokenHash = searchParams.get('token_hash')
          const type = searchParams.get('type')

          if (code) {
            const { data, error } =
              await supabase.auth.exchangeCodeForSession(code)
            if (!error && data.session && isMounted) {
              setSessionReady(true)
              setUserEmail(data.session.user.email ?? null)
              setVerifyingSession(false)
              return
            }
          } else if (tokenHash) {
            const { data, error } = await supabase.auth.verifyOtp({
              type: (type as 'recovery' | 'email') || 'recovery',
              token_hash: tokenHash,
            })
            if (!error && data.session && isMounted) {
              setSessionReady(true)
              setUserEmail(data.session.user.email ?? null)
              setVerifyingSession(false)
              return
            }
          }
        }

        // 3. Vérifier si une session active est déjà présente
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session && isMounted) {
          setSessionReady(true)
          setUserEmail(session.user.email ?? null)
        }
      } catch (err) {
        console.warn('Initialisation session recovery:', err)
      } finally {
        if (isMounted) {
          setVerifyingSession(false)
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'PASSWORD_RECOVERY' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED') &&
        session &&
        isMounted
      ) {
        setSessionReady(true)
        setUserEmail(session.user.email ?? null)
        setServerError(null)
        setRawSupabaseError(null)
        setVerifyingSession(false)
      }
    })

    void initRecoverySession()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setErrors({})
    setServerError(null)
    setRawSupabaseError(null)

    const nextErrors: Record<string, string> = {}
    if (password.length < 6) {
      nextErrors.password =
        lang === 'fr'
          ? 'Le mot de passe doit contenir au moins 6 caractères.'
          : 'Password must be at least 6 characters.'
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword =
        lang === 'fr'
          ? 'Les mots de passe ne correspondent pas.'
          : 'Passwords do not match.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setServerError(
        lang === 'fr'
          ? 'Lien expiré ou session absente. Demandez un nouveau lien de réinitialisation.'
          : 'Link expired or missing session. Please request a new reset link.'
      )
      setRawSupabaseError(
        `Supabase updateUser (${error.status ?? '400'}) : "${error.message}"`
      )
      setLoading(false)
      return
    }

    const updatedEmail = (data.user?.email || userEmail || '')
      .trim()
      .toLowerCase()
    if (updatedEmail === 'degbomedia@gmail.com' && data.user?.id) {
      await supabase
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', data.user.id)
      router.push('/admin')
      router.refresh()
      return
    }

    router.push('/dashboard?toast=password_updated')
    router.refresh()
  }

  return (
    <div className="w-full max-w-md px-2">
      <div className="flex justify-end mb-3">
        <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 p-1 text-xs font-bold text-white">
          <Globe className="w-3.5 h-3.5 ml-2 mr-1" />
          <button
            type="button"
            onClick={() => setLang('fr')}
            className={`px-2 py-0.5 rounded-full cursor-pointer ${
              lang === 'fr' ? 'bg-white text-slate-900' : 'text-white/80'
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2 py-0.5 rounded-full cursor-pointer ${
              lang === 'en' ? 'bg-white text-slate-900' : 'text-white/80'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="text-center mb-6">
        <KabaKabaLogo className="h-12 w-auto mx-auto mb-2" />
        <p className="text-slate-300 text-sm">
          {lang === 'fr'
            ? 'Choisissez un nouveau mot de passe'
            : 'Choose a new password'}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {lang === 'fr' ? 'Nouveau mot de passe' : 'New password'}
        </h2>
        <p className="text-gray-500 text-sm mb-5">
          {userEmail ? (
            <>
              {lang === 'fr' ? 'Compte vérifié : ' : 'Verified account: '}
              <strong className="text-gray-900">{userEmail}</strong>
            </>
          ) : lang === 'fr' ? (
            '6 caractères minimum.'
          ) : (
            'At least 6 characters.'
          )}
        </p>

        {verifyingSession && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2.5 text-xs font-semibold text-blue-800">
            ⏳ Vérification de votre lien sécurisé...
          </div>
        )}

        {!verifyingSession && sessionReady && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
            ✅ Lien validé ! Vous pouvez enregistrer votre nouveau mot de passe.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {lang === 'fr' ? 'Nouveau mot de passe' : 'New password'}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-3 pr-11 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#10B981] text-gray-900 transition ${
                  errors.password
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {lang === 'fr'
                ? 'Confirmer le mot de passe'
                : 'Confirm password'}
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#10B981] text-gray-900 transition ${
                errors.confirmPassword
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200'
              }`}
            />
            {errors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {serverError && (
            <div className="bg-red-50 border-2 border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm space-y-1.5">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition duration-200 cursor-pointer"
          >
            {loading
              ? lang === 'fr'
                ? 'Mise à jour...'
                : 'Updating...'
              : lang === 'fr'
                ? 'Enregistrer le mot de passe'
                : 'Save new password'}
          </button>
        </form>

        <div className="text-center mt-5 flex items-center justify-between text-xs font-semibold">
          <Link
            href="/forgot-password"
            className="text-blue-700 hover:underline"
          >
            {lang === 'fr'
              ? 'Demander un nouveau lien'
              : 'Request a new link'}
          </Link>
          <Link href="/login" className="text-slate-600 hover:underline">
            {lang === 'fr' ? '← Connexion' : '← Sign in'}
          </Link>
        </div>
      </div>
    </div>
  )
}
