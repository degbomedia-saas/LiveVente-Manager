import DashboardLayout from '../_components/DashboardLayout'
import OrdersView from '../orders/_components/OrdersView'
import { getOrdersViewData } from '../orders/get-orders-data'

export const metadata = { title: 'Colisage & Emballage — Élégance Wax Lomé' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PackingPage() {
  const { profile, orders, customers, couriers, products } = await getOrdersViewData()

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
        mode="packing"
      />
    </DashboardLayout>
  )
}
