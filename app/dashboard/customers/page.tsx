import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import {
  CustomersCrmView,
  type CrmCustomerRow,
} from './_components/CustomersCrmView'

export const metadata = { title: 'Base Clients CRM — Kaba Kaba' }

export default async function CustomersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') {
    redirect('/mes-livraisons')
  }

  let customersList: CrmCustomerRow[] = []

  const { data: fullCustomers, error: fullErr } = await supabase
    .from('customers')
    .select(
      'id, full_name, phone, city, address, default_address, total_orders, total_spent_fcfa, loyalty_points, created_at'
    )
    .order('created_at', { ascending: false })

  if (!fullErr && fullCustomers) {
    customersList = fullCustomers as CrmCustomerRow[]
  } else {
    const { data: baseCustomers } = await supabase
      .from('customers')
      .select('id, full_name, phone, city, address, created_at')
      .order('created_at', { ascending: false })

    customersList = (baseCustomers ?? []) as CrmCustomerRow[]
  }

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'emerald'}
    >
      <CustomersCrmView customers={customersList} />
    </DashboardLayout>
  )
}
