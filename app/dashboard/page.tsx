import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from './_components/DashboardLayout'
import OwnerDashboardView, {
  type DashboardDeliveryItem,
  type DashboardOrderItem,
  type DashboardPaymentItem,
  type DashboardSettlementItem,
} from './_components/OwnerDashboardView'

export const metadata = { title: 'Tableau de bord — Élégance Wax Lomé' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ toast?: string }>
}) {
  const params = await searchParams
  const showPasswordUpdatedToast = params.toast === 'password_updated'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') redirect('/mes-livraisons')

  // Si le vendeur n'a pas encore configuré sa boutique dans public.stores, rediriger vers /onboarding
  if (profile.role === 'seller' || profile.role === 'owner') {
    const { data: storeRow, error: storeErr } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!storeErr && !storeRow) {
      redirect('/onboarding')
    }
  }

  const companyName = profile.companies?.name ?? 'Votre entreprise'
  const userName = profile.full_name

  const [
    { data: orders },
    { data: deliveries },
    { data: payments },
    { data: settlements },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total_amount, delivery_fee, ordered_at'),
    supabase
      .from('deliveries')
      .select('id, order_id, status, created_at, delivered_at'),
    supabase
      .from('payments')
      .select('id, order_id, amount, status, reference, paid_at, created_at'),
    supabase
      .from('courier_settlements')
      .select('id, amount, status, paid_at, created_at'),
  ])

  return (
    <DashboardLayout
      userName={userName}
      companyName={companyName}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'indigo'}
    >
      {showPasswordUpdatedToast && (
        <div
          role="status"
          className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 shadow-sm"
        >
          <span>✅</span>
          <span>Mot de passe mis à jour avec succès.</span>
        </div>
      )}

      <OwnerDashboardView
        userName={userName}
        companyName={companyName}
        orders={(orders ?? []) as DashboardOrderItem[]}
        deliveries={(deliveries ?? []) as DashboardDeliveryItem[]}
        payments={(payments ?? []) as DashboardPaymentItem[]}
        settlements={(settlements ?? []) as DashboardSettlementItem[]}
      />
    </DashboardLayout>
  )
}
