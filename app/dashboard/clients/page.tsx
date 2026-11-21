import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import ClientsView from './_components/ClientsView'

export const metadata = { title: 'Clients — Élégance Wax Lomé' }

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // 1. Vérification auth côté serveur (AGENTS.md)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Récupération du profil (rôle + company_id) — côté serveur
  const profile = await getOrCreateProfile(supabase, user)

  // 3. Récupération des clients — RLS filtre automatiquement par company_id
  const { data: clients } = await supabase
    .from('customers')
    .select('id, full_name, phone, city, address, created_at')
    .order('created_at', { ascending: false })

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
    >
      <ClientsView
        initialClients={clients ?? []}
        userRole={profile.role}
        initialOpenModal={params.new === '1'}
      />
    </DashboardLayout>
  )
}
