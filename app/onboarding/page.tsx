import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { OnboardingForm } from './_components/OnboardingForm'

export const metadata = {
  title: 'Configuration Boutique — Kaba Kaba',
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') {
    redirect('/mes-livraisons')
  }

  // Si le vendeur a déjà configuré sa boutique dans public.stores, permettre quand même
  // d'afficher les valeurs existantes ou rediriger si déjà complété
  const { data: existingStore } = await supabase
    .from('stores')
    .select('id, store_name, whatsapp_phone, city')
    .eq('owner_id', user.id)
    .maybeSingle()

  return (
    <OnboardingForm
      userId={user.id}
      initialStoreName={
        existingStore?.store_name ||
        profile.companies?.name ||
        (user.user_metadata?.company_name as string) ||
        ''
      }
      initialPhone={
        existingStore?.whatsapp_phone ||
        (user.user_metadata?.phone as string) ||
        '+228 '
      }
      initialCity={
        existingStore?.city ||
        (user.user_metadata?.zone as string) ||
        'Lomé — Déckon'
      }
    />
  )
}
