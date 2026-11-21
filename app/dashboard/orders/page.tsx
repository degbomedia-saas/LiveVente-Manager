import DashboardLayout from '../_components/DashboardLayout'
import OrdersView from './_components/OrdersView'
import { getOrdersViewData } from './get-orders-data'

export const metadata = { title: 'Ventes & Commandes — Élégance Wax Lomé' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; tab?: string }>
}) {
  const params = await searchParams
  const { profile, orders, customers, couriers, products } = await getOrdersViewData()

  // Si l'utilisateur arrive avec tab=packing, on passe en mode packing
  const isPacking = params.tab === 'packing'
  const initialOrdersTab = params.tab === 'history' ? 'history' : 'active'

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'indigo'}
    >
      <OrdersView
        initialOrders={orders}
        initialCustomers={customers}
        initialCouriers={couriers}
        initialProducts={products}
        userRole={profile.role}
        companyName={profile.companies?.name ?? 'Élégance Wax Lomé'}
        initialOpenModal={params.new === '1'}
        mode={isPacking ? 'packing' : 'orders'}
        initialOrdersTab={initialOrdersTab}
      />
    </DashboardLayout>
  )
}
