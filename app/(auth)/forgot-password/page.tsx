'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/auth'
import { forgotPasswordSchema } from '@/lib/validations/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Adresse email invalide.')
      return
    }

    startTransition(async () => {
      const res = await requestPasswordReset(parsed.data)
      if (!res.success) {
        setFieldError(res.error)
        return
      }
      setSuccessMessage(res.message)
    })
  }

  if (successMessage) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez votre boîte mail</h2>
          <p className="text-gray-600 text-sm mb-6">{successMessage}</p>
          <Link
            href="/login"
            className="inline-block w-full bg-blue-800 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition text-sm"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
          <span className="text-3xl">🔑</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Élégance Wax Lomé</h1>
        <p className="text-blue-200 mt-1">Réinitialisation du mot de passe</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Mot de passe oublié</h2>
        <p className="text-gray-500 text-sm mb-6">
          Entrez votre adresse email pour recevoir un lien de réinitialisation.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition ${
                fieldError ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {fieldError && <p className="text-red-600 text-xs mt-1">{fieldError}</p>}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-xl transition duration-200"
          >
            {isPending ? 'Envoi en cours...' : 'Envoyer le lien'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link href="/login" className="text-sm text-blue-700 font-semibold hover:underline">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  )
}
