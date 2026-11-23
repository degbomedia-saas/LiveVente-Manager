import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import {
  DriverMobileView,
  type DriverCourseItem,
} from './_components/DriverMobileView'

export const metadata = { title: 'Espace Livreur Mobile — Kaba Kaba' }

export default async function DriverPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  const { data: orders } = await supabase
    .from('orders')
    .select(
      `
      id,
      parcel_number,
      status,
      total_amount,
      customers(full_name, phone, city, address),
      deliveries(id, status)
    `
    )
    .in('status', ['confirmed', 'packed', 'shipped', 'delivered'])
    .order('ordered_at', { ascending: false })
    .limit(30)

  const courses: DriverCourseItem[] = (orders ?? []).map((o) => {
    const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers
    const del = Array.isArray(o.deliveries) ? o.deliveries[0] : o.deliveries

    return {
      deliveryId: del?.id,
      orderId: o.id,
      orderNumber:
        (o as { parcel_number?: string | null }).parcel_number ||
        `#KK-${o.id.slice(0, 6).toUpperCase()}`,
      status: o.status,
      customerName: cust?.full_name || 'Client(e)',
      customerPhone: cust?.phone || '+228',
      customerAddress:
        [cust?.city, cust?.address].filter(Boolean).join(' — ') || 'Lomé',
      totalCodFcfa: Math.round(Number(o.total_amount ?? 0)),
    }
  })

  return (
    <DriverMobileView
      driverName={profile.full_name || 'Livreur'}
      initialCourses={courses}
    />
  )
}
