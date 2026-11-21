import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../dashboard/_components/DashboardLayout'
import CourierDeliveriesView, {
  type CourierDeliveryRow,
} from './_components/CourierDeliveriesView'

export const metadata = { title: 'Mes livraisons — Élégance Wax Lomé' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface MesLivraisonsPageProps {
  searchParams?: Promise<{ test_courier?: string }>
}

export default async function MesLivraisonsPage(props: MesLivraisonsPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const testCourierId = searchParams?.test_courier

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let testCouriers: Array<{ id: string; full_name: string; phone: string | null }> = []

  // Option d'accès direct "Mode Test Livreur" sans session active en environnement local / dev
  if (!user && process.env.NODE_ENV !== 'production') {
    const { data: couriers } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'courier')

    testCouriers = couriers ?? []

    if (testCouriers.length === 0) {
      testCouriers = [
        { id: 'kodjo-test', full_name: 'Kodjo', phone: '+228 90 12 34 56' },
        { id: 'moussa-test', full_name: 'Moussa', phone: '+228 91 23 45 67' },
      ]
    }

    // Sélecteur rapide de test sur smartphone
    if (!testCourierId) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-5 flex flex-col justify-center items-center text-center">
          <div className="w-full max-w-sm">
            <div className="w-16 h-16 rounded-3xl bg-amber-400 text-gray-950 flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl">
              🛵
            </div>
            <span className="inline-block text-[11px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full mb-2">
              Mode Test Livreur Mobile
            </span>
            <h1 className="text-2xl font-black text-white">Espace Livreur</h1>
            <p className="text-xs text-slate-400 mt-1 mb-6 leading-relaxed">
              Aucune session active détectée sur votre smartphone. Choisissez un profil livreur pour tester immédiatement l&apos;interface sans mot de passe :
            </p>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-300 text-left px-1">
                Tester en tant que :
              </p>
              {testCouriers.map((c) => (
                <Link
                  key={c.id}
                  href={`/mes-livraisons?test_courier=${c.id}`}
                  className="w-full min-h-[56px] px-5 py-3.5 bg-blue-700 hover:bg-blue-600 active:scale-98 rounded-2xl font-black text-sm flex items-center justify-between shadow-lg transition border border-blue-500/30"
                >
                  <div className="text-left">
                    <p className="text-white font-black flex items-center gap-2">
                      <span>🛵</span>
                      <span>{c.full_name}</span>
                    </p>
                    {c.phone && <p className="text-xs text-blue-200 font-normal">{c.phone}</p>}
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-xl text-white">
                    Tester &rarr;
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <Link
                href="/login"
                className="text-xs text-slate-400 hover:text-white underline transition"
              >
                Se connecter avec email et mot de passe
              </Link>
            </div>
          </div>
        </div>
      )
    }
  }

  if (!user && !testCourierId) {
    redirect('/login')
  }

  const effectiveCourierId = user ? user.id : testCourierId!
  let courierDisplayName = 'Livreur'
  let courierCompanyName = 'Boutique'
  let courierRole = 'courier'

  if (user) {
    const profile = await getOrCreateProfile(supabase, user)
    if (profile.role !== 'courier') {
      return (
        <DashboardLayout
          userName={profile.full_name}
          companyName={profile.companies?.name ?? ''}
          userRole={profile.role}
        >
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-md mx-auto mt-8">
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Accès réservé aux livreurs</h1>
            <p className="text-sm text-gray-500 mb-6">
              Cette page est uniquement accessible aux comptes ayant le rôle livreur.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-5 py-2.5 bg-blue-800 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
            >
              Retour au tableau de bord
            </Link>
          </div>
        </DashboardLayout>
      )
    }
    courierDisplayName = profile.full_name
    courierCompanyName = profile.companies?.name ?? ''
    courierRole = profile.role
  } else {
    const matchingTest = testCouriers.find((c) => c.id === testCourierId)
    courierDisplayName = matchingTest?.full_name || 'Livreur Test'
    courierCompanyName = 'Boutique (Mode Test)'
  }

  const courierFirstName = courierDisplayName.trim().split(/\s+/)[0] || 'Livreur'

  // Ensemble des identifiants possibles pour ce livreur (session auth + profil boutique correspondant)
  const candidateCourierIds = new Set<string>()
  if (effectiveCourierId && !effectiveCourierId.includes('-test')) {
    candidateCourierIds.add(effectiveCourierId)
  }

  // Recherche dans les profils de l'entreprise d'un livreur correspondant au nom
  const { data: matchedProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', `%${courierFirstName}%`)

  if (matchedProfiles && matchedProfiles.length > 0) {
    for (const mp of matchedProfiles) {
      candidateCourierIds.add(mp.id)
    }
  }

  let deliveriesList: any[] = []
  const courierIdList = Array.from(candidateCourierIds)

  // 1. Sélection des livraisons attribuées au livreur (par ID profil ou ID session)
  let deliveriesQuery = supabase
    .from('deliveries')
    .select(`
      id,
      status,
      delivery_address,
      scheduled_at,
      picked_up_at,
      delivered_at,
      created_at,
      updated_at,
      failed_reason,
      courier_id,
      order_id,
      orders(
        id,
        parcel_number,
        total_amount,
        delivery_fee,
        notes,
        status,
        customers(full_name, phone, city, address),
        order_items(id, product_name, quantity, unit_price, subtotal),
        payments(id, amount, status, reference)
      )
    `)
    .order('created_at', { ascending: false })

  if (courierIdList.length > 0) {
    deliveriesQuery = deliveriesQuery.in('courier_id', courierIdList)
  } else {
    deliveriesQuery = deliveriesQuery.eq('courier_id', effectiveCourierId)
  }

  const { data: fullDeliveries, error: fullError } = await deliveriesQuery

  if (!fullError && fullDeliveries) {
    deliveriesList = fullDeliveries
  } else {
    // Repli si champ parcel_number absent
    let fallbackQuery = supabase
      .from('deliveries')
      .select(`
        id,
        status,
        delivery_address,
        scheduled_at,
        picked_up_at,
        delivered_at,
        created_at,
        updated_at,
        failed_reason,
        courier_id,
        order_id,
        orders(
          id,
          total_amount,
          delivery_fee,
          notes,
          status,
          customers(full_name, phone, city, address),
          order_items(id, product_name, quantity, unit_price, subtotal),
          payments(id, amount, status, reference)
        )
      `)
      .order('created_at', { ascending: false })

    if (courierIdList.length > 0) {
      fallbackQuery = fallbackQuery.in('courier_id', courierIdList)
    } else {
      fallbackQuery = fallbackQuery.eq('courier_id', effectiveCourierId)
    }

    const { data: deliveriesWithoutParcel } = await fallbackQuery
    if (deliveriesWithoutParcel) {
      deliveriesList = deliveriesWithoutParcel
    }
  }

  // 2. Synchronisation complémentaire : Récupérer les commandes assignées par mention dans notes ou créées pour ce livreur
  const existingOrderIds = new Set(
    deliveriesList.map((d) => d.orders?.id || d.order_id).filter(Boolean)
  )

  const { data: nameMatchedOrders } = await supabase
    .from('orders')
    .select(`
      id,
      parcel_number,
      total_amount,
      delivery_fee,
      notes,
      status,
      customers(full_name, phone, city, address),
      order_items(id, product_name, quantity, unit_price, subtotal),
      payments(id, amount, status, reference),
      deliveries(
        id,
        status,
        delivery_address,
        scheduled_at,
        picked_up_at,
        delivered_at,
        created_at,
        updated_at,
        failed_reason
      )
    `)
    .in('status', ['assigned', 'in_transit', 'packed', 'confirmed', 'shipped', 'preparing'])
    .ilike('notes', `%${courierFirstName}%`)

  if (nameMatchedOrders && nameMatchedOrders.length > 0) {
    for (const ord of nameMatchedOrders) {
      if (!existingOrderIds.has(ord.id)) {
        const cust = Array.isArray(ord.customers) ? ord.customers[0] : ord.customers
        const normalizedOrd = {
          ...ord,
          customers: cust ?? null,
        }
        const d = ord.deliveries && ord.deliveries.length > 0 ? ord.deliveries[0] : null
        if (d) {
          deliveriesList.push({
            ...d,
            orders: normalizedOrd,
          })
          existingOrderIds.add(ord.id)
        } else {
          deliveriesList.push({
            id: `virtual-${ord.id}`,
            status: ord.status === 'in_transit' ? 'in_transit' : 'assigned',
            delivery_address: cust?.address || cust?.city || 'Adresse cliente',
            scheduled_at: new Date().toISOString(),
            picked_up_at: null,
            delivered_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            failed_reason: null,
            order_id: ord.id,
            orders: normalizedOrd,
          })
          existingOrderIds.add(ord.id)
        }
      }
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-3 sm:p-6 pb-20">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-amber-400 text-gray-950 px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-between shadow-md border-2 border-amber-500">
            <span className="flex items-center gap-1.5">
              <span>⚡</span>
              <span>Mode Test : <strong>{courierDisplayName}</strong></span>
            </span>
            <Link
              href="/mes-livraisons"
              className="text-[11px] font-black underline hover:opacity-80"
            >
              Changer de livreur
            </Link>
          </div>

          <CourierDeliveriesView
            courierName={courierDisplayName}
            initialDeliveries={(deliveriesList ?? []) as unknown as CourierDeliveryRow[]}
          />
        </div>
      </main>
    )
  }

  return (
    <DashboardLayout
      userName={courierDisplayName}
      companyName={courierCompanyName}
      userRole={courierRole}
    >
      <CourierDeliveriesView
        courierName={courierDisplayName}
        companyName={courierCompanyName || 'Élégance Wax Lomé'}
        initialDeliveries={(deliveriesList ?? []) as unknown as CourierDeliveryRow[]}
      />
    </DashboardLayout>
  )
}
