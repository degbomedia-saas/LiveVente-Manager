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
  const { pathname } = request.nextUrl

  // Si on est sur la page d'accueil ou les pages publiques, ne JAMAIS rediriger vers /login
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/first-login') ||
    pathname.startsWith('/track') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/live') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })
  const isDev = process.env.NODE_ENV !== 'production'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: !isDev,
        sameSite: 'lax',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            const adjustedOptions = isDev
              ? { ...options, secure: false }
              : options
            supabaseResponse.cookies.set(name, value, adjustedOptions)
          })
        },
      },
    }
  )

  // ⚠️ Ne JAMAIS utiliser getSession() ici — utiliser getUser() pour sécurité
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/signup' ||
    pathname === '/forgot-password'
  const isPublicPage =
    isAuthPage ||
    pathname === '/' ||
    pathname === '/first-login' ||
    pathname === '/reset-password' ||
    pathname === '/update-password' ||
    pathname.startsWith('/auth/')

  // Non connecté et tente d'accéder à une page protégée
  if (!user && !isPublicPage) {
    // Mode dev / test mobile : permettre l'accès à /mes-livraisons pour le sélecteur de test
    if (pathname === '/mes-livraisons' && isDev) {
      return supabaseResponse
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .maybeSingle()

    const isCourier = profile?.role === 'courier' || profile?.role === 'driver'
    const isEmployee = profile?.role === 'employee'
    const isSuperAdmin =
      profile?.role === 'super_admin' || profile?.role === 'admin'

    if (
      (pathname.startsWith('/super-admin') || pathname.startsWith('/admin')) &&
      !isSuperAdmin
    ) {
      return NextResponse.redirect(
        new URL('/dashboard?error=unauthorized', request.url)
      )
    }

    // Rôle employee : aucun accès aux finances, rapprochements ni réglages sensibles
    if (
      isEmployee &&
      (pathname.startsWith('/dashboard/finances') ||
        pathname.startsWith('/dashboard/payments') ||
        pathname.startsWith('/paiements') ||
        pathname.startsWith('/dashboard/settings') ||
        pathname.startsWith('/dashboard/analytics'))
    ) {
      return NextResponse.redirect(new URL('/dashboard/orders', request.url))
    }

    if (isAuthPage) {
      return NextResponse.redirect(
        new URL(isCourier ? '/mes-livraisons' : '/dashboard', request.url)
      )
    }

    if (
      isCourier &&
      (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/commandes') ||
        pathname.startsWith('/clients') ||
        pathname.startsWith('/produits') ||
        pathname.startsWith('/livreurs') ||
        pathname.startsWith('/paiements'))
    ) {
      return NextResponse.redirect(new URL('/mes-livraisons', request.url))
    }

    // Vérification du statut d'abonnement de la boutique (sauf super_admin et pages publiques)
    if (
      !isSuperAdmin &&
      profile?.company_id &&
      pathname !== '/abonnement-expire' &&
      !isPublicPage
    ) {
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at')
        .eq('company_id', profile.company_id)
        .maybeSingle()

      if (!subError && sub) {
        const isTrialExpired =
          sub.status === 'trialing' && new Date(sub.trial_ends_at) < new Date()
        const isBlockedStatus =
          sub.status === 'expired' ||
          sub.status === 'canceled' ||
          sub.status === 'past_due'

        if (isTrialExpired || isBlockedStatus) {
          return NextResponse.redirect(new URL('/abonnement-expire', request.url))
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Exclure les fichiers statiques Next.js et les assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
