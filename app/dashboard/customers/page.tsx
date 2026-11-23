import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import {
  CustomersCrmView,
  type CrmCustomerRow,
} from './_components/CustomersCrmView'

export const metadata = { title: 'Base Clients CRM — Kaba Kaba' }

const PAGE_SIZE = 20

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

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
  let totalCount = 0

  const {
    data: fullCustomers,
    count: fullCount,
    error: fullErr,
  } = await supabase
    .from('customers')
    .select(
      'id, full_name, phone, city, address, default_address, total_orders, total_spent_fcfa, loyalty_points, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (!fullErr && fullCustomers) {
    customersList = fullCustomers as CrmCustomerRow[]
    totalCount = fullCount ?? fullCustomers.length
  } else {
    const { data: baseCustomers, count: baseCount } = await supabase
      .from('customers')
      .select('id, full_name, phone, city, address, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to)

    customersList = (baseCustomers ?? []) as CrmCustomerRow[]
    totalCount = baseCount ?? customersList.length
  }

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'emerald'}
    >
      <CustomersCrmView
        customers={customersList}
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
      />
    </DashboardLayout>
  )
}
