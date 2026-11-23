import { createClient } from '@/lib/supabase/server'
import { MaintenanceClient } from './MaintenanceClient'

export const dynamic = 'force-dynamic'

export default async function MaintenancePage() {
  let saasName = 'Kaba Kaba'
  let saasLogoUrl: string | null = null
  let maintenanceMessage: string | null = null

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('platform_settings')
      .select('saas_name, saas_logo_url, maintenance_message')
      .limit(1)
      .maybeSingle()

    if (data?.saas_name?.trim()) {
      saasName = data.saas_name.trim()
    }
    if (data?.saas_logo_url?.trim()) {
      saasLogoUrl = data.saas_logo_url.trim()
    }
    if (data?.maintenance_message?.trim()) {
      maintenanceMessage = data.maintenance_message.trim()
    }
  } catch {
    // Valeurs par défaut
  }

  return (
    <MaintenanceClient
      saasName={saasName}
      saasLogoUrl={saasLogoUrl}
      maintenanceMessage={maintenanceMessage}
    />
  )
}
