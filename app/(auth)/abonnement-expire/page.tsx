'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

export default function AbonnementExpirePage() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <KabaKabaLogo />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          Abonnement expiré ou suspendu
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          La période d&apos;essai ou l&apos;abonnement de votre boutique est arrivé à terme.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl space-y-6">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            <p className="font-semibold">Vos données sont en sécurité</p>
            <p className="mt-1 text-amber-800">
              Vos commandes, clients et produits sont conservés. Renouvelez votre abonnement
              via TMoney, Flooz (Moov) ou virement pour réactiver l&apos;accès immédiatement.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="https://wa.me/22890000000?text=Bonjour%20Kaba%20Kaba%2C%20je%20souhaite%20renouveler%20l%27abonnement%20de%20ma%20boutique."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Contacter le support pour renouveler
            </a>

            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Vérifier à nouveau l&apos;accès
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {signingOut ? 'Déconnexion...' : 'Se déconnecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
