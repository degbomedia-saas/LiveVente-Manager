import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import {
  DriversManagerView,
  type DriverRowItem,
} from './_components/DriversManagerView'

export const metadata = { title: 'Livreurs & Invitations — Kaba Kaba' }

export default async function DriversPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') {
    redirect('/driver')
  }

  let driversList: DriverRowItem[] = []

  const { data: driversData, error: driversErr } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false })

  if (!driversErr && driversData && driversData.length > 0) {
    driversList = driversData as DriverRowItem[]
  } else {
    const { data: courierProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, zone, is_active')
      .eq('role', 'courier')
      .order('created_at', { ascending: false })

    driversList = (courierProfiles ?? []).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      phone: c.phone || '+228',
      email: c.email ?? null,
      zone_name: c.zone || 'Tokoin',
      invite_token: c.id.replace(/-/g, '').slice(0, 16),
      is_active: c.is_active ?? true,
      rating_avg: 5.0,
      deliveries_count: 0,
    }))
  }

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? 'Ma Boutique'}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'emerald'}
    >
      <DriversManagerView
        initialDrivers={driversList}
        storeName={profile.companies?.name ?? 'Ma Boutique'}
      />
    </DashboardLayout>
  )
}
