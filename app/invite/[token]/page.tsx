'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bike, CheckCircle2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

export default function DriverInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: 'courier',
            driver_invite_token: token,
          },
        },
      })

      if (signUpErr) {
        setError(signUpErr.message)
        setLoading(false)
        return
      }

      setDone(true)
      setTimeout(() => {
        router.push('/driver')
      }, 1200)
    } catch {
      setError('Impossible d’activer votre accès livreur.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col justify-center py-10 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <KabaKabaLogo light className="h-9 w-auto" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
            <Bike className="w-3.5 h-3.5" />
            Invitation Livreur • #{token.slice(0, 8)}
          </span>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">
            Créez votre mot de passe Livreur
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Activez votre compte mobile pour recevoir vos courses et valider vos
            livraisons.
          </p>
        </div>

        <div className="rounded-3xl bg-[#FFFFFF] border border-[#E2E8F0] p-6 sm:p-8 shadow-xs">
          {done ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-10 h-10 text-[#10B981] mx-auto" />
              <h2 className="text-lg font-extrabold text-[#0F172A]">
                Compte Livreur activé !
              </h2>
              <p className="text-xs text-[#64748B]">
                Redirection vers votre espace courses `/driver`...
              </p>
              <Link
                href="/driver"
                className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl text-sm font-bold bg-[#10B981] text-white"
              >
                Ouvrir mon espace Livreur
              </Link>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Votre email de connexion *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="koffi.livreur@gmail.com"
                  className="w-full px-3.5 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Choisissez un mot de passe *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-5 rounded-xl text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-white transition cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? 'Activation en cours...'
                  : 'Activer mon compte Livreur'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
