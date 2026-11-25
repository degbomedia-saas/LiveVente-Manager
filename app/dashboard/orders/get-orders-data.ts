import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { getSellerPaywallInfo } from '@/lib/quotas'
import type {
  OrderCourierOption,
  OrderCustomerOption,
  OrderProductOption,
  OrderRow,
} from './_components/OrdersView'

export async function getOrdersViewData(page = 1, pageSize = 20) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1))
  const from = (safePage - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.role === 'courier') {
    redirect('/mes-livraisons')
  }

  let ordersList: any[] = []
  let totalOrdersCount = 0

  // 1. Essai avec sélection complète incluant parcel_number + pagination .range() + count: 'exact'
  const {
    data: fullOrders,
    count: fullCount,
    error: ordersErr,
  } = await supabase
    .from('orders')
    .select(
      `
      id,
      parcel_number,
      status,
      total_amount,
      delivery_fee,
      notes,
      ordered_at,
      customers(full_name, phone, city, address),
      order_items(id, product_name, quantity, unit_price, subtotal),
      deliveries(id, status, courier_id, delivery_address, profiles(full_name, phone)),
      payments(id, amount, method, status, reference, paid_at)
    `,
      { count: 'exact' }
    )
    .order('ordered_at', { ascending: false })
    .range(from, to)

  if (!ordersErr && fullOrders) {
    ordersList = fullOrders
    totalOrdersCount = fullCount ?? fullOrders.length
  } else {
    // 2. Repli si parcel_number n'existe pas encore en base
    const {
      data: ordersWithoutParcel,
      count: countWithoutParcel,
      error: errWithoutParcel,
    } = await supabase
      .from('orders')
      .select(
        `
        id,
        status,
        total_amount,
        delivery_fee,
        notes,
        ordered_at,
        customers(full_name, phone, city, address),
        order_items(id, product_name, quantity, unit_price, subtotal),
        deliveries(id, status, courier_id, delivery_address, profiles(full_name, phone)),
        payments(id, amount, method, status, reference, paid_at)
      `,
        { count: 'exact' }
      )
      .order('ordered_at', { ascending: false })
      .range(from, to)

    if (!errWithoutParcel && ordersWithoutParcel) {
      ordersList = ordersWithoutParcel
      totalOrdersCount = countWithoutParcel ?? ordersWithoutParcel.length
    } else {
      const { data: basicOrders, count: basicCount } = await supabase
        .from('orders')
        .select(
          `
          id,
          status,
          total_amount,
          delivery_fee,
          notes,
          ordered_at,
          customers(full_name, phone, city, address),
          order_items(id, product_name, quantity, unit_price, subtotal)
        `,
          { count: 'exact' }
        )
        .order('ordered_at', { ascending: false })
        .range(from, to)

      ordersList = basicOrders ?? []
      totalOrdersCount = basicCount ?? ordersList.length
    }
  }

  const [
    { data: customers },
    { data: couriers },
    { data: products },
    paywall,
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id, full_name, phone, city')
      .order('full_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'courier')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase
      .from('products')
      .select('id, name, base_price, available_sizes, available_colors')
      .neq('is_active', false)
      .order('name', { ascending: true }),
    getSellerPaywallInfo(
      supabase,
      user.id,
      profile.company_id,
      profile.companies?.name ?? 'Ma Boutique'
    ),
  ])

  // Normalisation de parcel_number : s'il est présent dans ord.parcel_number ou repli dans ord.notes
  const normalizedOrders = (ordersList ?? []).map((ord) => {
    let pNum = ord.parcel_number
    if (!pNum && ord.notes) {
      const match = ord.notes.match(/#(\d+)/)
      if (match) {
        pNum = `#${match[1]}`
      }
    }
    return {
      ...ord,
      parcel_number: pNum ?? null,
    }
  })

  return {
    profile,
    orders: normalizedOrders as unknown as OrderRow[],
    totalOrdersCount,
    currentPage: safePage,
    pageSize,
    customers: (customers ?? []) as OrderCustomerOption[],
    couriers: (couriers ?? []) as OrderCourierOption[],
    products: (products ?? []) as OrderProductOption[],
    paywall,
  }
}
