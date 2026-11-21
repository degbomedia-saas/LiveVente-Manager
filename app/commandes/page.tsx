import { redirect } from 'next/navigation'

export default function CommandesRedirectPage() {
  redirect('/dashboard/orders')
}
