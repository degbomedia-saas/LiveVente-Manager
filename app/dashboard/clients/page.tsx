import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '../_components/DashboardLayout'
import ClientsView from './_components/ClientsView'

export const metadata = { title: 'Clients — LiveVente Manager' }

export default async function ClientsPage() {
  const supabase = await createClient()

  // 1. Vérification auth côté serveur (AGENTS.md)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Récupération du profil (rôle + company_id) — côté serveur
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, company_id, companies(name)')
    .eq('id', user.id)
    .single<{
      full_name: string
      role: string
      company_id: string
      companies: { name: string }
    }>()

  if (!profile) redirect('/login')

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
      />
    </DashboardLayout>
  )
}
