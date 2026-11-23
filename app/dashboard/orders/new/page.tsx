import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../../_components/DashboardLayout'
import { VoiceDictationFab } from '@/components/dashboard/VoiceDictationFab'

export const metadata = {
  title: 'Nouvelle Commande Express (Dictée & WhatsApp) — Kaba Kaba',
}

export default async function NewExpressOrderPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') {
    redirect('/driver')
  }

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? 'Ma Boutique'}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'emerald'}
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux commandes</span>
        </Link>

        <VoiceDictationFab inlineMode />
      </div>
    </DashboardLayout>
  )
}
