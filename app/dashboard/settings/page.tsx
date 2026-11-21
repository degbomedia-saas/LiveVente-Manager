import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import SettingsView, { type CompanySettingsData } from './_components/SettingsView'

export const metadata = { title: 'Paramètres — Élégance Wax Lomé' }

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier') {
    redirect('/mes-livraisons')
  }

  if (profile.role !== 'owner') {
    redirect('/dashboard')
  }

  let companyData: CompanySettingsData | null = null

  // 1. Tenter la sélection avec les colonnes étendues (phone, city, address, logo_url, theme_palette)
  const { data: brandingCompany, error: brandingErr } = await supabase
    .from('companies')
    .select('id, name, slug, country, currency, phone, city, address, logo_url, theme_palette')
    .eq('id', profile.company_id)
    .maybeSingle()

  if (brandingCompany && !brandingErr) {
    companyData = brandingCompany as CompanySettingsData
  } else {
    const { data: fullCompany, error: fullError } = await supabase
      .from('companies')
      .select('id, name, slug, country, currency, phone, city, address')
      .eq('id', profile.company_id)
      .maybeSingle()

    if (fullCompany && !fullError) {
      companyData = {
        ...(fullCompany as CompanySettingsData),
        logo_url: null,
        theme_palette: 'indigo',
      }
    } else {
      console.warn('Repli lecture companies de base:', fullError?.message)
      const { data: baseCompany, error: baseError } = await supabase
        .from('companies')
        .select('id, name, slug, country, currency')
        .eq('id', profile.company_id)
        .maybeSingle()

      if (baseError || !baseCompany) {
        console.error('Erreur lecture company:', baseError)
        redirect('/dashboard')
      }

      companyData = {
        ...(baseCompany as { id: string; name: string; slug: string; country: string; currency: string }),
        phone: null,
        city: null,
        address: null,
        logo_url: null,
        theme_palette: 'indigo',
      }
    }
  }

  // Chargement des 3 piliers de gestion : Livreurs, Produits, Clients
  const [
    { data: couriersData },
    { data: productsData },
    { data: customersData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, is_active, created_at')
      .eq('role', 'courier')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, name, base_price, available_sizes, available_colors, is_active, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('customers')
      .select('id, full_name, phone, city, address, created_at')
      .order('created_at', { ascending: false }),
  ])

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={companyData.name}
      userRole={profile.role}
      logoUrl={companyData.logo_url ?? null}
      themePalette={companyData.theme_palette ?? 'indigo'}
    >
      <SettingsView
        company={companyData}
        userName={profile.full_name}
        userEmail={user.email ?? ''}
        couriers={couriersData ?? []}
        products={productsData ?? []}
        customers={customersData ?? []}
      />
    </DashboardLayout>
  )
}
