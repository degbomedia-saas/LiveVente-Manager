'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateUserPassword } from '@/app/actions/auth'
import { resetPasswordSchema } from '@/lib/validations/auth'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword })
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) nextErrors[err.path[0] as string] = err.message
      })
      setErrors(nextErrors)
      return
    }

    startTransition(async () => {
      const res = await updateUserPassword(parsed.data)
      if (!res.success) {
        if (res.field) {
          setErrors({ [res.field]: res.error })
        } else {
          setServerError(res.error)
        }
        return
      }

      setToastMessage('Mot de passe mis à jour avec succès.')
      router.push('/dashboard?toast=password_updated')
      router.refresh()
    })
  }

  return (
    <div className="w-full max-w-md">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <span>✅</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Élégance Wax Lomé</h1>
        <p className="text-blue-200 mt-1">Définir un nouveau mot de passe</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Nouveau mot de passe</h2>
        <p className="text-gray-500 text-sm mb-6">
          8 caractères minimum, dont 1 majuscule et 1 chiffre.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 transition ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 transition ${
                errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>
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
            disabled={isPending}
            className="w-full bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-xl transition duration-200"
          >
            {isPending ? 'Enregistrement...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link href="/forgot-password" className="text-sm text-blue-700 font-semibold hover:underline">
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    </div>
  )
}
