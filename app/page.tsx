import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LandingClient } from './_components/LandingClient'

export const metadata: Metadata = {
  title: 'Kaba Kaba — Divisez par 3 votre temps de gestion des commandes à Lomé',
  description:
    'Arrêtez de jongler entre cahiers papier, WhatsApp et appels de livreurs. Utilisez la Dictée vocale, imprimez vos Étiquettes QR et suivez T-Money, Flooz et Cash sur un seul écran.',
}

export default async function HomePage() {
  let saasName = 'Kaba Kaba'
  let saasLogoUrl: string | null = null

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('platform_settings')
      .select('saas_name, saas_logo_url')
      .limit(1)
      .maybeSingle()

    if (data?.saas_name?.trim()) {
      saasName = data.saas_name.trim()
    }
    if (data?.saas_logo_url?.trim()) {
      saasLogoUrl = data.saas_logo_url.trim()
    }
  } catch {
    // Fallback par défaut si platform_settings n'est pas encore initialisé
  }

  return <LandingClient saasName={saasName} saasLogoUrl={saasLogoUrl} />
}
