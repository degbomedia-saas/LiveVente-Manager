import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Client Supabase pour le serveur (Server Components, Server Actions, Route Handlers).
 * Gère automatiquement les cookies de session.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const isDev = process.env.NODE_ENV !== 'production'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: !isDev,
        sameSite: 'lax',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const adjustedOptions = isDev
                ? { ...options, secure: false }
                : options
              cookieStore.set(name, value, adjustedOptions)
            })
          } catch {
            // Ignoré dans les Server Components (lecture seule)
          }
        },
      },
    }
  )
}
