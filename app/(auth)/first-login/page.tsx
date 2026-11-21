'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, CheckCircle2, Bike } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { activateCourierAccount } from '@/app/actions/couriers'

function FirstLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const cid = searchParams.get('cid') || ''
  const invitedEmail = searchParams.get('email') || ''
  const invitedName = searchParams.get('name') || 'Livreur'
  const invitedZone = searchParams.get('zone') || ''

  const firstName = invitedName.trim().split(/\s+/)[0] || 'Livreur'

  const [email, setEmail] = useState(invitedEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Votre adresse email est requise.')
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: invitedName,
            skip_auto_profile: true,
            courier_profile_id: cid || undefined,
            role: 'courier',
          },
        },
      })

      if (signUpErr) {
        const msg = signUpErr.message.toLowerCase()
        if (msg.includes('already registered') || msg.includes('already exists')) {
          // Si le compte existe déjà dans Supabase Auth, tenter la connexion directe
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })
          if (signInErr) {
            setError('Un compte existe déjà avec cet email. Mot de passe incorrect.')
            setLoading(false)
            return
          }
        } else {
          setError(signUpErr.message)
          setLoading(false)
          return
        }
      } else if (!signUpData.session) {
        // Tenter une connexion immédiate si aucune session n'a été retournée automatiquement
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
      }

      // Lier le compte auth au profil livreur invité et réassigner ses courses
      await activateCourierAccount({
        invitedProfileId: cid || null,
        email: cleanEmail,
      })

      router.push('/mes-livraisons')
      router.refresh()

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (window.location.pathname === '/first-login') {
            window.location.href = '/mes-livraisons'
          }
        }, 700)
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l\'activation du compte.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4 text-indigo-600">
          <Bike className="w-8 h-8" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Élégance Wax Lomé</h1>
        <p className="text-blue-200 mt-1 text-sm">Espace Livreur Mobile</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Bienvenue {firstName} sur l&apos;Espace Livreur
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Définissez votre mot de passe personnel pour accéder à vos tournées de livraison.
          </p>
          {invitedZone && (
            <p className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              Zone habituelle : {invitedZone}
            </p>
          )}
        </div>

        <form onSubmit={handleActivate} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={Boolean(invitedEmail)}
              placeholder="kodjo.livreur@gmail.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 read-only:text-slate-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Choisissez votre mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Confirmez le mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez votre mot de passe"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
            <span>{loading ? 'Activation en cours...' : 'Activer mon accès livreur'}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-center">
          <Link href="/login" className="text-xs font-medium text-slate-500 hover:text-indigo-600">
            Déjà activé ? Se connecter
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function FirstLoginPage() {
  return (
    <Suspense fallback={<div className="text-white text-sm">Chargement...</div>}>
      <FirstLoginContent />
    </Suspense>
  )
}
