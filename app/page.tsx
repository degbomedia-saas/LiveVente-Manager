import { redirect } from 'next/navigation'

/**
 * Page racine — redirige vers /dashboard.
 * Le middleware redirigera vers /login si non connecté.
 */
export default function Home() {
  redirect('/dashboard')
}
