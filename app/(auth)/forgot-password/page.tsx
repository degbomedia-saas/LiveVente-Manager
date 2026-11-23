'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Globe } from 'lucide-react'
import { requestPasswordReset } from '@/app/actions/auth'
import { forgotPasswordSchema } from '@/lib/validations/auth'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

type Lang = 'fr' | 'en'

export default function ForgotPasswordPage() {
  const [lang, setLang] = useState<Lang>('fr')
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    setFieldError(null)

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setFieldError(
        parsed.error.issues[0]?.message ??
          (lang === 'fr' ? 'Adresse email invalide.' : 'Invalid email address.')
      )
      return
    }

    startTransition(async () => {
      const res = await requestPasswordReset(parsed.data)
      if (!res.success) {
        setFieldError(res.error)
        return
      }
      setSuccessMessage(
        lang === 'fr'
          ? res.message
          : 'If an account exists with this email, a reset link has been sent.'
      )
    })
  }

  if (successMessage) {
    return (
      <div className="w-full max-w-md px-2">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="text-5xl">📧</div>
          <h2 className="text-2xl font-bold text-gray-900">
            {lang === 'fr' ? 'Vérifiez votre boîte mail' : 'Check your inbox'}
          </h2>
          <p className="text-gray-600 text-sm">{successMessage}</p>
          <Link
            href="/login"
            className="inline-block w-full bg-[#10B981] hover:bg-[#059669] text-white font-semibold py-3 px-4 rounded-xl transition text-sm"
          >
            {lang === 'fr' ? 'Retour à la connexion' : 'Back to sign in'}
          </Link>
        </div>
      </div>
    )
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
            ? 'Réinitialisation du mot de passe'
            : 'Password reset'}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {lang === 'fr' ? 'Mot de passe oublié' : 'Forgot password'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {lang === 'fr'
            ? 'Entrez votre adresse email pour recevoir un lien de réinitialisation.'
            : 'Enter your email address to receive a password reset link.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {lang === 'fr' ? 'Adresse email' : 'Email address'}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#10B981] text-gray-900 placeholder-gray-400 transition ${
                fieldError ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {fieldError && (
              <p className="text-red-600 text-xs mt-1">{fieldError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full min-h-[48px] bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition duration-200 cursor-pointer"
          >
            {isPending
              ? lang === 'fr'
                ? 'Envoi en cours...'
                : 'Sending...'
              : lang === 'fr'
                ? 'Envoyer le lien'
                : 'Send reset link'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link
            href="/login"
            className="text-sm text-blue-700 font-semibold hover:underline"
          >
            ← {lang === 'fr' ? 'Retour à la connexion' : 'Back to sign in'}
          </Link>
        </div>
      </div>
    </div>
  )
}
