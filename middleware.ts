import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware Next.js — Protection des routes
 *
 * Règles :
 * - Utilisateur NON connecté → redirigé vers /login (sauf pages auth)
 * - Utilisateur connecté sur /login ou /register → redirigé vers /dashboard
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ⚠️ Ne JAMAIS utiliser getSession() ici — utiliser getUser() pour sécurité
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isPublicPage = isAuthPage || pathname === '/'

  // Non connecté et tente d'accéder à une page protégée
  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Connecté mais sur une page d'auth → aller au dashboard
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Exclure les fichiers statiques Next.js et les assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
