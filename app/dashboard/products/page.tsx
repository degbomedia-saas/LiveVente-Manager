import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import ProductsView, {
  type ProductRow,
  type ProductTemplateItem,
} from './_components/ProductsView'

export const metadata = { title: 'Catalogue & Stocks — Kaba Kaba' }

export default async function ProductsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') {
    redirect('/mes-livraisons')
  }

  let productsList: ProductRow[] = []

  const { data: fullProducts, error: fullErr } = await supabase
    .from('products')
    .select(
      'id, name, base_price, price_fcfa, sku, category, stock_qty, low_stock_threshold, image_url, show_in_live, available_sizes, available_colors, is_active, created_at'
    )
    .order('created_at', { ascending: false })

  if (!fullErr && fullProducts) {
    productsList = fullProducts as ProductRow[]
  } else {
    const { data: baseProducts } = await supabase
      .from('products')
      .select(
        'id, name, base_price, available_sizes, available_colors, is_active, created_at'
      )
      .order('created_at', { ascending: false })

    productsList = ((baseProducts ?? []) as ProductRow[]).map((p) => ({
      ...p,
      price_fcfa: Math.round(p.base_price ?? 0),
      sku: null,
      category: 'Mode',
      stock_qty: 10,
      low_stock_threshold: 3,
      image_url: null,
    }))
  }

  const [{ data: templates }, { data: compRow }] = await Promise.all([
    supabase
      .from('product_templates')
      .select('id, name, default_category, default_variants')
      .order('created_at', { ascending: true }),
    supabase
      .from('companies')
      .select('slug')
      .eq('id', profile.company_id)
      .maybeSingle(),
  ])

  const storeSlug = compRow?.slug || profile.company_id

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'emerald'}
    >
      <ProductsView
        initialProducts={productsList}
        initialTemplates={(templates ?? []) as ProductTemplateItem[]}
        userRole={profile.role}
        storeSlug={storeSlug}
      />
    </DashboardLayout>
  )
}
