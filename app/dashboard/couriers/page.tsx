import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import CouriersView, { type CourierRow } from './_components/CouriersView'

export const metadata = { title: 'Livreurs — Élégance Wax Lomé' }

export default async function CouriersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier') {
    redirect('/mes-livraisons')
  }

  let couriersList: CourierRow[] = []
  const { data: couriersFull, error: fullErr } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at, email, zone, invitation_status')
    .eq('role', 'courier')
    .order('created_at', { ascending: false })

  if (!fullErr && couriersFull) {
    couriersList = couriersFull as CourierRow[]
  } else {
    const { data: couriersBasic } = await supabase
      .from('profiles')
      .select('id, full_name, phone, is_active, created_at')
      .eq('role', 'courier')
      .order('created_at', { ascending: false })
    couriersList = (couriersBasic ?? []) as CourierRow[]
  }

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'indigo'}
    >
      <CouriersView
        initialCouriers={couriersList}
        userRole={profile.role}
      />
    </DashboardLayout>
  )
}
