import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('platform_settings')
      .select('id, saas_name, is_maintenance_mode')
      .limit(1)
      .maybeSingle()

    if (error) {
      // Repli si la colonne is_maintenance_mode n'est pas encore migrée
      const fallback = await supabase
        .from('platform_settings')
        .select('id, saas_name')
        .limit(1)
        .maybeSingle()

      if (fallback.error) {
        const companiesPing = await supabase
          .from('companies')
          .select('id')
          .limit(1)

        if (companiesPing.error) {
          const latencyMs = Date.now() - startedAt
          return NextResponse.json(
            {
              status: 'degraded',
              supabase: 'disconnected',
              latencyMs,
              maintenanceMode: false,
              error: companiesPing.error.message,
              timestamp: new Date().toISOString(),
            },
            { status: 503 }
          )
        }
      }

      const latencyMs = Date.now() - startedAt
      return NextResponse.json({
        status: 'ok',
        supabase: 'connected',
        latencyMs,
        maintenanceMode: false,
        saasName: fallback.data?.saas_name ?? 'Kaba Kaba',
        timestamp: new Date().toISOString(),
      })
    }

    const latencyMs = Date.now() - startedAt
    return NextResponse.json({
      status: 'ok',
      supabase: 'connected',
      latencyMs,
      maintenanceMode: Boolean(data?.is_maintenance_mode),
      saasName: data?.saas_name ?? 'Kaba Kaba',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const latencyMs = Date.now() - startedAt
    return NextResponse.json(
      {
        status: 'degraded',
        supabase: 'disconnected',
        latencyMs,
        maintenanceMode: false,
        error: err instanceof Error ? err.message : 'Healthcheck failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
