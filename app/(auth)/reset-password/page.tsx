'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema } from '@/lib/validations/auth'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

type Lang = 'fr' | 'en'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setErrors({})
    setServerError(null)

    const result = resetPasswordSchema.safeParse({ password, confirmPassword })
    if (!result.success) {
      const nextErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        if (err.path[0]) nextErrors[err.path[0] as string] = err.message
      })
      setErrors(nextErrors)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: result.data.password,
    })

    if (error) {
      setServerError(
        lang === 'fr'
          ? 'Lien expiré ou invalide. Demandez un nouveau lien de réinitialisation.'
          : 'Link expired or invalid. Please request a new reset link.'
      )
      setLoading(false)
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
        <p className="text-gray-500 text-sm mb-6">
          {lang === 'fr'
            ? '8 caractères minimum, dont 1 majuscule et 1 chiffre.'
            : 'At least 8 characters, including 1 uppercase letter and 1 digit.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {lang === 'fr' ? 'Nouveau mot de passe' : 'New password'}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#10B981] text-gray-900 transition ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
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
              type="password"
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
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span>{serverError}</span>
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

        <div className="text-center mt-5">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-700 font-semibold hover:underline"
          >
            {lang === 'fr'
              ? 'Demander un nouveau lien'
              : 'Request a new link'}
          </Link>
        </div>
      </div>
    </div>
  )
}
