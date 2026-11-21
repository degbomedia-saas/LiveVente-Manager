import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import ProductsView, { type ProductRow } from './_components/ProductsView'

export const metadata = { title: 'Produits — Élégance Wax Lomé' }

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier') {
    redirect('/mes-livraisons')
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, base_price, available_sizes, available_colors, is_active, created_at')
    .order('created_at', { ascending: false })

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
    >
      <ProductsView
        initialProducts={(products ?? []) as ProductRow[]}
        userRole={profile.role}
      />
    </DashboardLayout>
  )
}
