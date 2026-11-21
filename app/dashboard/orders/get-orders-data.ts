import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import type {
  OrderCourierOption,
  OrderCustomerOption,
  OrderProductOption,
  OrderRow,
} from './_components/OrdersView'

export async function getOrdersViewData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.role === 'courier') {
    redirect('/mes-livraisons')
  }

  let ordersList: any[] = []

  // 1. Essai avec sélection complète incluant parcel_number
  const { data: fullOrders, error: ordersErr } = await supabase
    .from('orders')
    .select(`
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
    `)
    .order('ordered_at', { ascending: false })

  if (!ordersErr && fullOrders) {
    ordersList = fullOrders
  } else {
    // 2. Repli si parcel_number n'existe pas encore en base
    const { data: ordersWithoutParcel, error: errWithoutParcel } = await supabase
      .from('orders')
      .select(`
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
      `)
      .order('ordered_at', { ascending: false })

    if (!errWithoutParcel && ordersWithoutParcel) {
      ordersList = ordersWithoutParcel
    } else {
      const { data: basicOrders } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          delivery_fee,
          notes,
          ordered_at,
          customers(full_name, phone, city, address),
          order_items(id, product_name, quantity, unit_price, subtotal)
        `)
        .order('ordered_at', { ascending: false })

      ordersList = basicOrders ?? []
    }
  }

  const [{ data: customers }, { data: couriers }, { data: products }] = await Promise.all([
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
    customers: (customers ?? []) as OrderCustomerOption[],
    couriers: (couriers ?? []) as OrderCourierOption[],
    products: (products ?? []) as OrderProductOption[],
  }
}
