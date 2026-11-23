'use client'

import { Phone, MessageCircle, Package as PackageIcon, Bike as BikeIcon, Camera as CameraIcon, User as UserIcon, X, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createOrder,
  updateOrderStatus,
  cancelOrder,
  confirmOrder,
  markOrderPacked,
  checkExistingDailyOrderByPhone,
} from '@/app/actions/orders'
import { assignDelivery } from '@/app/actions/deliveries'
import {
  createOrderSchema,
  ORDER_STATUSES,
  SHOP_PAYMENT_METHODS,
  toWhatsAppUrl,
  formatPhoneNumber,
  type OrderStatus,
  type ShopPaymentMethod,
} from '@/lib/validations/orders'
import { assignDeliverySchema } from '@/lib/validations/deliveries'
import PackingView from './PackingView'

export interface OrderCustomerOption {
  id: string
  full_name: string
  phone: string
  city?: string | null
}

export interface OrderCourierOption {
  id: string
  full_name: string
  phone: string | null
}

export interface OrderDeliveryProof {
  id: string
  recipient_name: string | null
  photo_url: string | null
  notes: string | null
  created_at: string
}

export interface OrderDeliveryRow {
  id: string
  status: string
  courier_id: string
  delivery_address: string
  profiles: {
    full_name: string
    phone: string | null
  } | null
  delivery_proofs?: OrderDeliveryProof[]
}

export interface OrderItemRow {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface OrderPaymentRow {
  id: string
  amount: number
  method: string
  status: string
  reference: string | null
  paid_at: string | null
}

export interface OrderRow {
  id: string
  parcel_number?: string | null
  status: OrderStatus
  total_amount: number
  delivery_fee: number
  notes: string | null
  ordered_at: string
  customers: {
    full_name: string
    phone: string
    city?: string | null
    address?: string | null
  } | null
  order_items: OrderItemRow[]
  deliveries?: OrderDeliveryRow[]
  payments?: OrderPaymentRow[]
}

export interface OrderProductOption {
  id: string
  name: string
  base_price: number
  available_sizes: string[]
  available_colors: string[]
}

interface OrdersViewProps {
  initialOrders: OrderRow[]
  initialCustomers: OrderCustomerOption[]
  initialCouriers: OrderCourierOption[]
  initialProducts: OrderProductOption[]
  userRole: string
  companyName?: string
  initialOpenModal?: boolean
  initialTab?: 'all' | 'packing'
  initialOrdersTab?: 'active' | 'history'
  mode?: 'orders' | 'packing'
}

interface DraftItem {
  productId: string
  description: string
  size: string
  color: string
  customSize: boolean
  customColor: boolean
  quantity: string
  unitPrice: string
}

const DELIVERY_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  assigned: { label: 'Attribuée', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  in_transit: { label: 'En cours', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  delivered: { label: 'Livrée', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Échec', className: 'bg-red-50 text-red-700 border-red-200' },
}

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  pending_confirmation: { label: 'À confirmer', className: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  pending: { label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Confirmée', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  packed: { label: 'Emballée', className: 'bg-teal-50 text-teal-800 border-teal-200' },
  assigned: { label: 'Attribuée', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  preparing: { label: 'En préparation', className: 'bg-primary-soft text-primary-soft-text border-primary-border' },
  shipped: { label: 'Expédiée', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivered: { label: 'Livrée', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Annulée', className: 'bg-red-50 text-red-700 border-red-200' },
}

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function emptyItem(hasProducts = false): DraftItem {
  return {
    productId: hasProducts ? '' : '__custom__',
    description: '',
    size: '',
    color: '',
    customSize: !hasProducts,
    customColor: !hasProducts,
    quantity: '1',
    unitPrice: '0',
  }
}

function cleanPhone(raw?: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('228')) {
    return digits.slice(3)
  }
  return digits.length >= 8 ? digits.slice(-8) : digits
}

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return false
  const now = new Date()
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  )
}

function NewOrderModal({
  customers,
  products,
  onClose,
  onCreated,
  existingOrders = [],
}: {
  customers: OrderCustomerOption[]
  products: OrderProductOption[]
  onClose: () => void
  onCreated: (order?: OrderRow | null, createdCustomer?: OrderCustomerOption | null) => void
  existingOrders?: OrderRow[]
}) {
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new')
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '')
  const [newCustomer, setNewCustomer] = useState({
    fullName: '',
    phone: '',
    city: '',
  })
  const [items, setItems] = useState<DraftItem[]>([emptyItem(products.length > 0)])
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [paymentType, setPaymentType] = useState<'none' | 'full' | 'partial'>('none')
  const [paidAmount, setPaidAmount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<ShopPaymentMethod>('Espèces')
  const [paymentRef, setPaymentRef] = useState('')
  const [notes, setNotes] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Détection automatique du format Togo (+228) si 8 chiffres purs saisis
  const rawCustomerDigits = newCustomer.phone.replace(/\D/g, '')
  const isTogoFormatDetected = rawCustomerDigits.length === 8

  function handlePhoneBlur() {
    if (rawCustomerDigits.length === 8) {
      setNewCustomer((c) => ({
        ...c,
        phone: `+228 ${rawCustomerDigits.slice(0, 2)} ${rawCustomerDigits.slice(2, 4)} ${rawCustomerDigits.slice(4, 6)} ${rawCustomerDigits.slice(6, 8)}`,
      }))
    }
  }

  // Numéro de téléphone actif (selon mode client existant ou nouveau client)
  const activePhone = useMemo(() => {
    if (customerMode === 'existing') {
      return customers.find((c) => c.id === customerId)?.phone ?? ''
    }
    return newCustomer.phone
  }, [customerMode, customerId, newCustomer.phone, customers])

  // Détection locale immédiate d'une commande passée aujourd'hui pour ce même client
  const localExistingTodayOrder = useMemo(() => {
    const digits = cleanPhone(activePhone)
    if (digits.length < 8) return null

    return (existingOrders ?? []).find((o) => {
      const oDigits = cleanPhone(o.customers?.phone)
      if (!oDigits || oDigits !== digits) return false
      if (!isToday(o.ordered_at)) return false
      return ['pending_confirmation', 'confirmed', 'packed', 'pending'].includes(o.status)
    })
  }, [existingOrders, activePhone])

  // Détection serveur asynchrone (au cas où une commande a été saisie sur un autre écran)
  const [serverGroupage, setServerGroupage] = useState<{
    count: number
    parcelNumbers: string[]
  } | null>(null)

  useEffect(() => {
    const digits = cleanPhone(activePhone)
    if (digits.length >= 8) {
      let isMounted = true
      checkExistingDailyOrderByPhone(digits)
        .then((res) => {
          if (isMounted && res.hasExistingOrder) {
            setServerGroupage({
              count: res.existingOrdersCount ?? 1,
              parcelNumbers: res.existingParcelNumbers ?? [],
            })
          } else if (isMounted) {
            setServerGroupage(null)
          }
        })
        .catch(() => {})
      return () => {
        isMounted = false
      }
    } else {
      setServerGroupage(null)
    }
  }, [activePhone])

  const hasGroupageDetected = Boolean(localExistingTodayOrder || serverGroupage)
  const groupageParcelLabel =
    localExistingTodayOrder?.parcel_number ||
    serverGroupage?.parcelNumbers?.[0] ||
    null

  // Préremplissage automatique des frais de livraison à 0 FCFA lors de la détection de groupage
  const [autoZeroPhone, setAutoZeroPhone] = useState('')
  useEffect(() => {
    const digits = cleanPhone(activePhone)
    if (hasGroupageDetected && digits.length >= 8 && digits !== autoZeroPhone) {
      setDeliveryFee('0')
      setAutoZeroPhone(digits)
    }
  }, [hasGroupageDetected, activePhone, autoZeroPhone])

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      return sum + Math.max(0, qty) * Math.max(0, price)
    }, 0)
    const fee = Math.max(0, Number(deliveryFee) || 0)
    const disc = Math.max(0, Number(discount) || 0)
    const total = Math.max(0, subtotal + fee - disc)

    const paid =
      paymentType === 'full'
        ? total
        : paymentType === 'partial'
        ? Math.min(total, Math.max(0, Number(paidAmount) || 0))
        : 0
    const remaining = Math.max(0, total - paid)

    return { subtotal, fee, disc, total, paid, remaining }
  }, [items, deliveryFee, discount, paymentType, paidAmount])

  function updateItem(index: number, key: keyof DraftItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    )
    setErrors((prev) => ({ ...prev, [`items.${index}.${key}`]: '' }))
  }

  function removeItem(index: number) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement)
    ) {
      return
    }
    e.preventDefault()
    const focusables = Array.from(
      e.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled])'
      )
    )
    const idx = focusables.indexOf(target)
    const next = idx >= 0 ? focusables[idx + 1] : undefined
    if (next) {
      next.focus()
      if (next instanceof HTMLInputElement) {
        next.select()
      }
    }
  }

  function handleSubmitWithStatus(targetStatus: 'pending_confirmation' | 'confirmed') {
    setErrors({})
    setServerError(null)

    const missingFields: string[] = []
    if (customerMode === 'new') {
      if (!newCustomer.city.trim()) missingFields.push('Quartier non précisé')
    } else {
      const selectedCust = customers.find((c) => c.id === customerId)
      if (!selectedCust?.city?.trim()) missingFields.push('Quartier non précisé')
    }
    for (const item of items) {
      if (!item.size.trim() && !missingFields.includes('Taille manquante')) {
        missingFields.push('Taille manquante')
      }
      if (!item.color.trim() && !missingFields.includes('Couleur manquante')) {
        missingFields.push('Couleur manquante')
      }
    }

    const effectiveStatus = missingFields.length > 0 ? 'pending_confirmation' : targetStatus
    const missingTag =
      missingFields.length > 0 ? `[INFO MANQUANTE: ${missingFields.join(', ')}]` : ''
    const combinedNotes = [notes.trim(), missingTag].filter(Boolean).join(' | ')

    const payload = {
      customerMode,
      customerId: customerMode === 'existing' ? customerId : undefined,
      newCustomer: customerMode === 'new' ? newCustomer : undefined,
      items: items.map((item) => ({
        description: item.description,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPrice: item.unitPrice === '' ? -1 : item.unitPrice,
      })),
      deliveryFee: hasGroupageDetected ? 0 : deliveryFee === '' ? 0 : deliveryFee,
      discount: discount === '' ? 0 : discount,
      status: effectiveStatus,
      payment:
        paymentType === 'none'
          ? { type: 'none' as const, amount: 0, method: 'Espèces' as const }
          : {
              type: paymentType,
              amount: paymentType === 'full' ? totals.total : Number(paidAmount) || 0,
              method: paymentMethod,
              reference: paymentRef,
            },
      notes: combinedNotes,
    }

    const parsed = createOrderSchema.safeParse(payload)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      parsed.error.issues.forEach((err) => {
        const key = err.path.join('.')
        if (key && !nextErrors[key]) {
          nextErrors[key] = err.message
        }
      })
      setErrors(nextErrors)
      if (parsed.error.issues[0]) {
        setServerError(parsed.error.issues[0].message)
      }
      return
    }

    startTransition(async () => {
      const res = await createOrder(parsed.data)
      if (res.error) {
        setServerError(res.error)
        return
      }
      onCreated(
        (res.order as unknown as OrderRow | null) ?? null,
        res.createdCustomer ?? null
      )
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nouvelle commande express</h2>
            <p className="text-xs text-slate-500">Saisie fluide en 4 étapes clés</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmitWithStatus('pending_confirmation')
          }}
          onKeyDown={handleFormKeyDown}
          className="flex-1 flex flex-col min-h-0"
          noValidate
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 1. CLIENT (Nom & Téléphone indispensables) */}
          <div className="bg-primary-soft border border-primary-border text-primary-soft-text rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                <span>👤</span>
                <span>1. Client & Contact</span>
              </span>
              <div className="inline-flex rounded-xl bg-white p-1 border border-gray-200">
                <button
                  type="button"
                  disabled={customers.length === 0}
                  onClick={() => setCustomerMode('existing')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    customerMode === 'existing'
                      ? 'bg-primary text-white'
                      : 'text-gray-600 disabled:opacity-40'
                  }`}
                >
                  Existant
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    customerMode === 'new'
                      ? 'bg-primary text-white'
                      : 'text-gray-600'
                  }`}
                >
                  + Nouveau
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <div>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                >
                  <option value="">Sélectionner un client...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} — {c.phone}
                    </option>
                  ))}
                </select>
                {errors.customerId && (
                  <p className="text-red-600 text-xs mt-1">{errors.customerId}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nom complet du client <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCustomer.fullName}
                      onChange={(e) =>
                        setNewCustomer((c) => ({ ...c, fullName: e.target.value }))
                      }
                      placeholder="Ex: Ama Koffi *"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                    />
                    {errors['newCustomer.fullName'] && (
                      <p className="text-red-600 text-xs mt-1">{errors['newCustomer.fullName']}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Téléphone WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => {
                        setNewCustomer((c) => ({ ...c, phone: e.target.value }))
                        setErrors((prev) => ({ ...prev, 'newCustomer.phone': '' }))
                      }}
                      onBlur={handlePhoneBlur}
                      placeholder="Ex: 90 12 34 56 ou +228 90..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                    />
                    {isTogoFormatDetected && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                        ✓ Format Togo 8 chiffres détecté (+228 sera ajouté pour WhatsApp)
                      </p>
                    )}
                    {errors['newCustomer.phone'] && (
                      <p className="text-red-600 text-xs mt-1">{errors['newCustomer.phone']}</p>
                    )}
                  </div>
                </div>

                {/* Champ 3 : Quartier ou repère de livraison directement visible */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Quartier ou repère de livraison
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                    <input
                      type="text"
                      value={newCustomer.city}
                      onChange={(e) =>
                        setNewCustomer((c) => ({ ...c, city: e.target.value }))
                      }
                      placeholder="Ex: Tokoin Douane, Kégué Stade, Agoè Assiyéyé"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Alerte discrète groupage si commande déjà existante aujourd'hui */}
            {hasGroupageDetected && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-800 text-xs mt-2">
                <PackageIcon className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" strokeWidth={1.75} />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-lg">
                      Groupage détecté
                    </span>
                    <p className="font-semibold text-amber-900">
                      Commande existante aujourd&apos;hui{groupageParcelLabel ? ` (${groupageParcelLabel})` : ''}.
                    </p>
                  </div>
                  <p className="text-amber-800 text-[11px] font-medium">
                    Frais de livraison mis à 0 FCFA (groupage).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2. ARTICLES (Sélection, tailles, couleurs, quantité, prix) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>🛍️</span>
                <span>2. Articles commandés ({items.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, emptyItem(products.length > 0)])}
                className="text-xs font-semibold text-blue-800 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition"
              >
                + Ajouter un article
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const selectedProduct = products.find((p) => p.id === item.productId)
                const sizeChoices = selectedProduct?.available_sizes ?? []
                const colorChoices = selectedProduct?.available_colors ?? []
                const showSizeDropdown =
                  selectedProduct && sizeChoices.length > 0 && !item.customSize
                const showColorDropdown =
                  selectedProduct && colorChoices.length > 0 && !item.customColor

                return (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-2xl p-3.5 space-y-2.5 bg-white shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    {products.length > 0 ? (
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === '__custom__') {
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      productId: '__custom__',
                                      description: '',
                                      size: '',
                                      color: '',
                                      customSize: true,
                                      customColor: true,
                                      unitPrice: '0',
                                    }
                                  : it
                              )
                            )
                          } else {
                            const prod = products.find((p) => p.id === val)
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      productId: val,
                                      description: prod?.name ?? '',
                                      unitPrice: prod ? String(Math.round(prod.base_price)) : '0',
                                      size: prod?.available_sizes[0] ?? '',
                                      color: prod?.available_colors[0] ?? '',
                                      customSize: !prod || prod.available_sizes.length === 0,
                                      customColor: !prod || prod.available_colors.length === 0,
                                    }
                                  : it
                              )
                            )
                          }
                          setErrors((prev) => ({
                            ...prev,
                            [`items.${idx}.description`]: '',
                            [`items.${idx}.unitPrice`]: '',
                          }))
                        }}
                        className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary-ring"
                      >
                        <option value="">-- Choisir un produit catalogue --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatMoney(p.base_price)}
                          </option>
                        ))}
                        <option value="__custom__">✍️ Saisie manuelle d&apos;article...</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder="Ex: Robe en satin *"
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                      />
                    )}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center text-sm"
                        title="Retirer"
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {products.length > 0 && item.productId === '__custom__' && (
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      placeholder="Description manuelle de l'article *"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                    />
                  )}
                  {errors[`items.${idx}.description`] && (
                    <p className="text-red-600 text-xs">{errors[`items.${idx}.description`]}</p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {showSizeDropdown ? (
                      <select
                        value={item.size}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, customSize: true, size: '' } : it
                              )
                            )
                          } else {
                            updateItem(idx, 'size', e.target.value)
                          }
                        }}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                      >
                        <option value="">Taille...</option>
                        {sizeChoices.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        <option value="__custom__">✍️ Autre taille...</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={item.size}
                          onChange={(e) => updateItem(idx, 'size', e.target.value)}
                          placeholder="Taille (M, L...)"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                        />
                        {selectedProduct && sizeChoices.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? { ...it, customSize: false, size: sizeChoices[0] ?? '' }
                                    : it
                                )
                              )
                            }
                            className="px-2 py-2 rounded-lg bg-gray-100 text-xs text-gray-600 hover:bg-gray-200"
                            title="Revenir à la liste"
                          >
                            ↩
                          </button>
                        )}
                      </div>
                    )}

                    {showColorDropdown ? (
                      <select
                        value={item.color}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, customColor: true, color: '' } : it
                              )
                            )
                          } else {
                            updateItem(idx, 'color', e.target.value)
                          }
                        }}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                      >
                        <option value="">Couleur...</option>
                        {colorChoices.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__custom__">✍️ Autre couleur...</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => updateItem(idx, 'color', e.target.value)}
                          placeholder="Couleur"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                        />
                        {selectedProduct && colorChoices.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? { ...it, customColor: false, color: colorChoices[0] ?? '' }
                                    : it
                                )
                              )
                            }
                            className="px-2 py-2 rounded-lg bg-gray-100 text-xs text-gray-600 hover:bg-gray-200"
                            title="Revenir à la liste"
                          >
                            ↩
                          </button>
                        )}
                      </div>
                    )}

                    <div>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantity}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        placeholder="Qté (1)"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring font-semibold"
                      />
                      {errors[`items.${idx}.quantity`] && (
                        <p className="text-red-600 text-xs mt-0.5">{errors[`items.${idx}.quantity`]}</p>
                      )}
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={item.unitPrice}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        placeholder="Prix unit. (FCFA)"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring font-semibold"
                      />
                      {errors[`items.${idx}.unitPrice`] && (
                        <p className="text-red-600 text-xs mt-0.5">{errors[`items.${idx}.unitPrice`]}</p>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </div>

          {/* 3. FRAIS DE LIVRAISON (Verrouillé si commande groupée) */}
          {hasGroupageDetected ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-900">
                <PackageIcon className="w-4 h-4 text-amber-700 shrink-0" strokeWidth={1.75} />
                <p className="text-xs sm:text-sm font-semibold">
                  Frais de livraison : <span className="font-bold">0 FCFA</span> (Inclus dans la livraison groupée du jour)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-bold text-amber-800 shrink-0">
                Verrouillé
              </span>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              {/* Canal d'acquisition rapide (TikTok / WhatsApp / Instagram) */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1.5">
                  Canal de commande :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'whatsapp', label: '💬 WhatsApp' },
                      { id: 'tiktok', label: '🎵 TikTok' },
                      { id: 'instagram', label: '📸 Instagram' },
                      { id: 'manual', label: '✍️ Manuel' },
                    ] as const
                  ).map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        const tag = `[CANAL: ${ch.label}]`
                        setNotes((prev) =>
                          prev.includes('[CANAL:')
                            ? prev.replace(/\[CANAL:[^\]]+\]/, tag)
                            : prev
                            ? `${tag} ${prev}`
                            : tag
                        )
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:border-primary text-slate-800 transition cursor-pointer"
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zones de livraison Lomé (calcul auto du COD total) */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1.5">
                  Zone de livraison Lomé (tarif auto) :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: 'Tokoin', fee: 1000 },
                    { name: 'Déckon', fee: 1000 },
                    { name: 'Agoè', fee: 1500 },
                    { name: 'Adidogomé', fee: 1500 },
                    { name: 'Baguida', fee: 2000 },
                  ].map((z) => (
                    <button
                      key={z.name}
                      type="button"
                      onClick={() => {
                        setDeliveryFee(String(z.fee))
                        if (customerMode === 'new' && !newCustomer.city.trim()) {
                          setNewCustomer((prev) => ({ ...prev, city: z.name }))
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        Number(deliveryFee) === z.fee &&
                        newCustomer.city.toLowerCase().includes(z.name.toLowerCase())
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white border-slate-200 hover:border-primary text-slate-800'
                      }`}
                    >
                      {z.name} • {z.fee} F
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <label className="block text-sm font-semibold text-slate-900">
                    3. Frais de livraison (FCFA)
                  </label>
                  <p className="text-xs text-slate-500">Rémunération du livreur</p>
                </div>
                <div className="w-36">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={deliveryFee}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="1000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-base font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-primary-ring"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. OPTIONS SECONDAIRES PLIABLES (Quartier, Acompte boutique, Réduction, Notes) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                <span>⚙️</span>
                <span>Options complémentaires (Réduction, Acompte, Notes)</span>
                {(Number(discount) > 0 || paymentType !== 'none' || notes) && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary-soft-text text-[10px] font-bold">
                    Renseignées
                  </span>
                )}
              </span>
              <span className="text-gray-500 font-semibold">{showAdvanced ? '▲ Masquer' : '▼ Déplier'}</span>
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 border-t border-gray-200 bg-gray-50/30">
                {/* Réduction & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Réduction commerciale (FCFA)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={discount}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Notes de commande
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Appeler avant de partir"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                    />
                  </div>
                </div>

                {/* Encaissement immédiat boutique */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Paiement comptoir / Acompte déjà reçu
                    </span>
                    <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setPaymentType('none')}
                        className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                          paymentType === 'none'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        À la livraison
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentType('partial')
                          if (Number(paidAmount) <= 0) {
                            setPaidAmount(String(Math.round(totals.total / 2)))
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                          paymentType === 'partial'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Acompte
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentType('full')
                          setPaidAmount(String(totals.total))
                        }}
                        className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                          paymentType === 'full'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Intégral
                      </button>
                    </div>
                  </div>

                  {paymentType !== 'none' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Montant encaissé en boutique (FCFA)
                        </label>
                        <input
                          type="number"
                          disabled={paymentType === 'full'}
                          min={1}
                          max={totals.total}
                          step={500}
                          value={paymentType === 'full' ? String(totals.total) : paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          placeholder="5000"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Mode d&apos;encaissement
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as ShopPaymentMethod)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                        >
                          {SHOP_PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RÉCAPITULATIF FINANCIER */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total articles</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Frais de livraison</span>
              <span>+ {formatMoney(totals.fee)}</span>
            </div>
            {totals.disc > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Réduction</span>
                <span>- {formatMoney(totals.disc)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total commande</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
            {paymentType !== 'none' && (
              <>
                <div className="flex justify-between text-xs text-emerald-700 font-semibold pt-1">
                  <span>Encaissé par la boutique :</span>
                  <span>- {formatMoney(totals.paid)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-900 font-semibold border-t border-slate-200 pt-1">
                  <span>Reste à percevoir par le livreur :</span>
                  <span>{formatMoney(totals.remaining)}</span>
                </div>
              </>
            )}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex gap-2">
              <span>⚠️</span>
              <span>{serverError}</span>
            </div>
          )}
          </div>

          {/* STICKY FOOTER TOUJOURS VISIBLE */}
          <div className="border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm px-6 py-4 flex flex-wrap justify-between items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium hover:bg-slate-50 transition text-sm"
            >
              Annuler
            </button>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSubmitWithStatus('pending_confirmation')}
                className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 transition text-sm"
              >
                À confirmer
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSubmitWithStatus('confirmed')}
                className="h-11 px-6 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-semibold shadow-sm transition text-sm flex items-center justify-center gap-1.5"
              >
                <span>{isPending ? 'Enregistrement...' : 'Enregistrer la commande'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssignCourierModal({
  order,
  couriers,
  onClose,
  onAssigned,
}: {
  order: OrderRow
  couriers: OrderCourierOption[]
  onClose: () => void
  onAssigned: (
    orderId: string,
    delivery: OrderDeliveryRow,
    nextStatus: OrderStatus
  ) => void
}) {
  const existing = order.deliveries?.[0]
  const defaultAddress =
    existing?.delivery_address ||
    [order.customers?.city, order.customers?.address].filter(Boolean).join(' - ') ||
    ''
  const [courierId, setCourierId] = useState(existing?.courier_id ?? couriers[0]?.id ?? '')
  const [deliveryAddress, setDeliveryAddress] = useState(defaultAddress)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = assignDeliverySchema.safeParse({
      orderId: order.id,
      courierId,
      deliveryAddress,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    startTransition(async () => {
      const res = await assignDelivery(parsed.data)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.delivery) {
        onAssigned(order.id, res.delivery, res.orderStatus as OrderStatus)
      }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Affecter un livreur</h2>
            <p className="text-xs text-gray-500">
              Commande #{order.id.slice(0, 6).toUpperCase()} — {order.customers?.full_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            ✕
          </button>
        </div>

        {couriers.length === 0 ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-sm text-gray-600">
              Aucun livreur actif trouvé. Créez d&apos;abord un livreur.
            </p>
            <Link
              href="/livreurs"
              className="inline-block px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition"
            >
              Gérer les livreurs
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Livreur
              </label>
              <select
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
              >
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse de livraison
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Ex: Tokoin, près du carrefour"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold"
              >
                {isPending ? 'Attribution...' : 'Confirmer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function isOrderActive(order: OrderRow): boolean {
  if (order.status === 'cancelled') return false
  const totalPaid = (order.payments ?? [])
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const remainingDue = Math.max(0, order.total_amount - totalPaid)

  if (order.status === 'delivered') {
    // Si livrée mais reste dû > 0 (non encore soldée/rapprochée) -> Active
    return remainingDue > 0
  }
  return true
}

function isOrderClosed(order: OrderRow): boolean {
  return !isOrderActive(order)
}

export default function OrdersView({
  initialOrders,
  initialCustomers,
  initialCouriers,
  initialProducts,
  userRole,
  companyName = 'Élégance Wax Lomé',
  initialOpenModal = false,
  initialTab = 'all',
  initialOrdersTab = 'active',
  mode = 'orders',
}: OrdersViewProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders)
  const [customers, setCustomers] = useState<OrderCustomerOption[]>(initialCustomers)
  const [activeTab, setActiveTab] = useState<'all' | 'packing'>(mode === 'packing' ? 'packing' : initialTab)
  const [ordersTab, setOrdersTab] = useState<'active' | 'history'>(initialOrdersTab)
  const [showModal, setShowModal] = useState(initialOpenModal)
  const [assigningOrder, setAssigningOrder] = useState<OrderRow | null>(null)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const isPackingMode = mode === 'packing' || activeTab === 'packing'

  useEffect(() => {
    if (mode === 'packing') {
      setActiveTab('packing')
    } else if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [mode, initialTab])

  useEffect(() => {
    if (initialOrdersTab) {
      setOrdersTab(initialOrdersTab)
    }
  }, [initialOrdersTab])

  useEffect(() => {
    if (initialOpenModal) setShowModal(true)
  }, [initialOpenModal])

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  useEffect(() => {
    setCustomers(initialCustomers)
  }, [initialCustomers])

  useEffect(() => {
    function handleVisibility() {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        router.refresh()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('focus', handleVisibility)
    }

    const intervalId = setInterval(() => {
      router.refresh()
    }, 15000)

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleVisibility)
      }
      clearInterval(intervalId)
    }
  }, [router])

  // Séparation Actives (en cours) vs Clôturées (historique)
  const activeOrders = useMemo(() => orders.filter(isOrderActive), [orders])
  const closedOrders = useMemo(() => orders.filter(isOrderClosed), [orders])

  // Recherche globale (sur l'ensemble de la base sans restreindre à l'onglet actif)
  const isSearching = search.trim().length > 0
  const searchResults = useMemo(() => {
    if (!isSearching) return []
    const q = search.toLowerCase().trim()
    return orders.filter((o) => {
      const code = o.id.slice(0, 6).toLowerCase()
      const parcel = (o.parcel_number || '').toLowerCase()
      const name = (o.customers?.full_name || '').toLowerCase()
      const phone = o.customers?.phone ?? ''
      const city = (o.customers?.city || '').toLowerCase()
      const address = (o.customers?.address || '').toLowerCase()
      return (
        code.includes(q) ||
        parcel.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        city.includes(q) ||
        address.includes(q)
      )
    })
  }, [orders, search, isSearching])

  // Liste des commandes affichées
  const displayedOrders = useMemo(() => {
    if (isSearching) return searchResults
    return ordersTab === 'active' ? activeOrders : closedOrders
  }, [isSearching, searchResults, ordersTab, activeOrders, closedOrders])

  function handleStatusChange(orderId: string, status: OrderStatus) {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, status)
      if (res.error) {
        alert(res.error)
        return
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      )
      router.refresh()
    })
  }

  function handleCancelOrder(orderId: string) {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) return
    startTransition(async () => {
      const res = await cancelOrder(orderId)
      if (res.error) {
        alert(res.error)
        return
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
      )
      router.refresh()
    })
  }

  const canManage = userRole !== 'courier'

  return (
    <>
      {isPackingMode ? (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Atelier de Colisage & Emballage</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Préparation des colis du jour, numérotation séquentielle et passation aux livreurs
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Ventes & Commandes</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {activeOrders.length} commande{activeOrders.length !== 1 ? 's' : ''} active{activeOrders.length !== 1 ? 's' : ''} • {closedOrders.length} clôturée{closedOrders.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition text-sm shadow-xs"
            >
              <span className="text-lg leading-none">+</span> Nouvelle commande
            </button>
          )}
        </div>
      )}

      {isPackingMode ? (
        <PackingView
          orders={orders}
          couriers={initialCouriers}
          companyName={companyName}
          onOrderUpdated={(updated) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
            )
          }}
          onAssignDelivery={(order) => setAssigningOrder(order)}
        />
      ) : (
        <>
          {/* 1. DEUX ONGLETS NETS : EN COURS / ACTIVES VS HISTORIQUE / CLÔTURÉES */}
          <div className="flex items-center gap-2 sm:gap-3 mb-5 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => {
                setOrdersTab('active')
                if (isSearching) setSearch('')
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition border ${
                ordersTab === 'active' && !isSearching
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🔥</span>
              <span>En cours / Actives</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  ordersTab === 'active' && !isSearching
                    ? 'bg-white/20 text-white'
                    : 'bg-primary-soft text-primary-soft-text'
                }`}
              >
                {activeOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrdersTab('history')
                if (isSearching) setSearch('')
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition border ${
                ordersTab === 'history' && !isSearching
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>📂</span>
              <span>Historique / Clôturées</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  ordersTab === 'history' && !isSearching
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {closedOrders.length}
              </span>
            </button>
          </div>

          {/* 2. RECHERCHE GLOBALE */}
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher partout (numéro, colis #01, client, téléphone ou quartier)..."
              className="w-full pl-11 pr-24 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-ring bg-white text-gray-900 text-sm placeholder-gray-400 shadow-2xs"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Effacer
              </button>
            )}
          </div>

          {isSearching && (
            <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-900">
              <span>
                🔍 Recherche globale dans toutes les commandes ({searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} trouvé{searchResults.length > 1 ? 's' : ''})
              </span>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-blue-700 hover:underline font-bold"
              >
                Fermer la recherche
              </button>
            </div>
          )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">📦</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Aucune commande pour l&apos;instant
          </h3>
          <p className="text-gray-500 text-sm max-w-xs mb-6">
            Enregistrez votre première commande avec ses articles et frais de livraison.
          </p>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition"
            >
              <span>+</span> Nouvelle commande
            </button>
          )}
        </div>
      ) : isSearching && searchResults.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
          <span className="text-4xl">🔍</span>
          <p className="text-gray-700 font-bold text-base">Aucune commande trouvée</p>
          <p className="text-gray-500 text-sm">
            Aucun résultat ne correspond à votre recherche globale &quot;{search}&quot;.
          </p>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-800 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"
          >
            Effacer la recherche
          </button>
        </div>
      ) : !isSearching && ordersTab === 'active' && activeOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-3">
          <span className="text-4xl">🎉</span>
          <p className="text-gray-900 font-bold text-lg">Toutes les commandes sont traitées !</p>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Aucune commande active en cours. Toutes les commandes sont soit livrées et entièrement encaissées, soit aucune commande n&apos;est en attente.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {canManage && (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition"
              >
                + Nouvelle commande
              </button>
            )}
            <button
              type="button"
              onClick={() => setOrdersTab('history')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
            >
              Consulter l&apos;historique ({closedOrders.length})
            </button>
          </div>
        </div>
      ) : !isSearching && ordersTab === 'history' && closedOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-3">
          <span className="text-4xl">📂</span>
          <p className="text-gray-900 font-bold text-lg">Aucune commande dans l&apos;historique</p>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Les commandes dont le cycle est clôturé (livrées et totalement payées ou annulées) apparaîtront automatiquement ici.
          </p>
        </div>
      ) : (
        <>
          {/* VUE TABLE DESKTOP */}
          <div className="hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-5 py-3.5">Numéro / Colis</th>
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Articles</th>
                  <th className="px-5 py-3.5">Montant & Paiement</th>
                  <th className="px-5 py-3.5">{ordersTab === 'history' && !isSearching ? 'Bilan / Issue' : 'Statut'}</th>
                  <th className="px-5 py-3.5">{ordersTab === 'history' && !isSearching ? 'Contact' : 'Livraison & Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedOrders.map((order) => {
                  const meta = STATUS_META[order.status] ?? STATUS_META.pending
                  const canAssign =
                    order.status === 'pending_confirmation' ||
                    order.status === 'pending' ||
                    order.status === 'confirmed' ||
                    order.status === 'packed'
                  const assignedDelivery = order.deliveries?.[0]
                  const totalPaid = (order.payments ?? [])
                    .filter((p) => p.status === 'completed')
                    .reduce((sum, p) => sum + Number(p.amount), 0)
                  const remainingDue = Math.max(0, order.total_amount - totalPaid)
                  const isFullyPaid = totalPaid >= order.total_amount && order.total_amount > 0
                  const isPartiallyPaid = totalPaid > 0 && totalPaid < order.total_amount
                  const phoneDigits = (order.customers?.phone || '').replace(/\D/g, '')
                  const isClosed = isOrderClosed(order)

                  // LIGNE HISTORIQUE / CLÔTURÉE (si onglet historique actif sans recherche)
                  if (ordersTab === 'history' && !isSearching) {
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/60 bg-gray-50/20">
                        <td className="px-5 py-4 font-mono font-semibold text-gray-700">
                          {order.parcel_number ? (
                            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-xs">
                              <PackageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Colis {order.parcel_number}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 font-medium text-xs">
                              #{order.id.slice(0, 6).toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900">
                            {order.customers?.full_name ?? 'Client'}
                          </p>
                          <p className="text-xs text-gray-500">{order.customers?.phone}</p>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{formatDate(order.ordered_at)}</td>
                        <td className="px-5 py-4 text-gray-600 max-w-xs">
                          {order.order_items.map((it) => `${it.quantity}× ${it.product_name}`).join(', ')}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-gray-900">{formatMoney(order.total_amount)}</p>
                          <div className="mt-1">
                            {isFullyPaid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                ✓ Soldé
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {order.status === 'cancelled' ? 'Annulé' : 'Non soldé'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {order.status === 'delivered' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                                ✓ Livrée & Soldée
                              </span>
                              {assignedDelivery?.profiles?.full_name && (
                                <p className="text-[11px] text-gray-500">
                                  Livreur : {assignedDelivery.profiles.full_name}
                                </p>
                              )}
                            </div>
                          ) : order.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200">
                              ✕ Annulée
                            </span>
                          ) : (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.className}`}>
                              {meta.label}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {phoneDigits && (
                              <a
                                href={toWhatsAppUrl(order.customers?.phone || phoneDigits)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold transition"
                                title="Ouvrir WhatsApp client"
                              >
                                <span>💬</span>
                                <span>WhatsApp</span>
                              </a>
                            )}
                            {assignedDelivery?.delivery_proofs?.[0]?.photo_url && (
                              <a
                                href={assignedDelivery.delivery_proofs[0].photo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 underline font-semibold text-xs hover:text-blue-800 flex items-center gap-0.5"
                                title="Voir preuve photo"
                              >
                                📷 Preuve
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  // LIGNE COMMANDE ACTIVE OU RECHERCHE GLOBALE
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-4 font-mono font-semibold text-blue-900">
                        <div className="space-y-1">
                          {order.parcel_number ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 font-bold px-3 py-1 rounded-lg text-sm">
                              <PackageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Colis {order.parcel_number}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 font-medium text-xs">
                              #{order.id.slice(0, 6).toUpperCase()}
                            </span>
                          )}
                          {isSearching && (
                            <div>
                              {isClosed ? (
                                <span className="inline-block text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                  📂 Clôturée
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  🔥 En cours
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-between gap-1">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {order.customers?.full_name ?? 'Client'}
                            </p>
                            <p className="text-xs text-gray-500">{order.customers?.phone}</p>
                          </div>
                          {phoneDigits && (
                            <a
                              href={toWhatsAppUrl(order.customers?.phone || phoneDigits)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-600 hover:text-green-700 p-1 hover:bg-green-50 rounded"
                              title="Contacter sur WhatsApp"
                            >
                              💬
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{formatDate(order.ordered_at)}</td>
                      <td className="px-5 py-4 text-gray-600 max-w-xs">
                        {order.order_items.map((it) => `${it.quantity}× ${it.product_name}`).join(', ')}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">{formatMoney(order.total_amount)}</p>
                        <div className="mt-1">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              ✓ Réglé
                            </span>
                          ) : isPartiallyPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Acompte: {formatMoney(totalPaid)} (Dû: {formatMoney(remainingDue)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                              À payer à la livraison
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {canManage ? (
                          <select
                            disabled={isPending}
                            value={order.status}
                            onChange={(e) =>
                              handleStatusChange(order.id, e.target.value as OrderStatus)
                            }
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none ${meta.className}`}
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {STATUS_META[st].label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.className}`}>
                            {meta.label}
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {assignedDelivery?.profiles?.full_name && (
                              <span className="text-xs text-gray-700 font-medium">
                                🚴 {assignedDelivery.profiles.full_name}
                              </span>
                            )}
                            {assignedDelivery && (
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                  (DELIVERY_STATUS_BADGE[assignedDelivery.status] ?? DELIVERY_STATUS_BADGE.assigned).className
                                }`}
                              >
                                {(DELIVERY_STATUS_BADGE[assignedDelivery.status] ?? DELIVERY_STATUS_BADGE.assigned).label}
                              </span>
                            )}
                            {assignedDelivery?.delivery_proofs?.[0] && (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <span className="inline-flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" strokeWidth={1.75} />{assignedDelivery.delivery_proofs[0].recipient_name || 'Réceptionné'}</span>
                                {assignedDelivery.delivery_proofs[0].photo_url && (
                                  <a
                                    href={assignedDelivery.delivery_proofs[0].photo_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 underline font-semibold hover:text-blue-800 flex items-center gap-0.5 ml-1"
                                    title="Voir la photo de preuve"
                                  >
                                    📷 Photo
                                  </a>
                                )}
                              </div>
                            )}
                            {canAssign && (
                              <button
                                type="button"
                                onClick={() => setAssigningOrder(order)}
                                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-semibold transition"
                              >
                                {assignedDelivery ? 'Réaffecter' : 'Affecter'}
                              </button>
                            )}
                            {order.status !== 'delivered' && order.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(order.id)}
                                className="px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-medium transition"
                                title="Annuler la commande"
                              >
                                Annuler
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* VUE CARTES MOBILES */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-4">
            {displayedOrders.map((order) => {
              const meta = STATUS_META[order.status] ?? STATUS_META.pending
              const canAssign =
                order.status === 'pending_confirmation' ||
                order.status === 'pending' ||
                order.status === 'confirmed' ||
                order.status === 'packed'
              const assignedDelivery = order.deliveries?.[0]
              const totalPaid = (order.payments ?? [])
                .filter((p) => p.status === 'completed')
                .reduce((sum, p) => sum + Number(p.amount), 0)
              const remainingDue = Math.max(0, order.total_amount - totalPaid)
              const isFullyPaid = totalPaid >= order.total_amount && order.total_amount > 0
              const isPartiallyPaid = totalPaid > 0 && totalPaid < order.total_amount
              const phoneDigits = (order.customers?.phone || '').replace(/\D/g, '')
              const isClosed = isOrderClosed(order)

              // CARTE MOBILE HISTORIQUE
              if (ordersTab === 'history' && !isSearching) {
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-slate-300 transition-all p-4 md:p-5 mb-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        {order.parcel_number ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <PackageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Colis {order.parcel_number}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">
                            #{order.id.slice(0, 6).toUpperCase()}
                          </span>
                        )}
                        <p className="text-base font-semibold text-slate-900 truncate">
                          {order.customers?.full_name ?? 'Client'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-sm text-slate-500">{order.customers?.phone}</span>
                          {phoneDigits && (
                            <>
                              <a
                                href={`tel:+${phoneDigits.length === 8 ? '228' + phoneDigits : phoneDigits}`}
                                className="text-slate-400 hover:text-slate-600 transition"
                                title="Appeler"
                                aria-label="Appeler"
                              >
                                <Phone className="w-4 h-4" strokeWidth={1.75} />
                              </a>
                              <a
                                href={toWhatsAppUrl(order.customers?.phone || phoneDigits)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 transition"
                                title="WhatsApp"
                                aria-label="WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                              </a>
                            </>
                          )}
                          <span className="text-xs text-slate-400">• {formatDate(order.ordered_at)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-slate-900">{formatMoney(order.total_amount)}</p>
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-md mt-1 ${
                            order.status === 'cancelled'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {order.status === 'delivered'
                            ? 'Livrée & soldée'
                            : order.status === 'cancelled'
                            ? 'Annulée'
                            : meta.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <ul className="space-y-1">
                        {order.order_items.map((it) => (
                          <li key={it.id} className="text-sm font-medium text-slate-700">
                            {it.quantity}× {it.product_name}
                          </li>
                        ))}
                      </ul>
                      {assignedDelivery?.profiles?.full_name && (
                        <p className="text-xs text-slate-500 inline-flex items-center gap-1"><BikeIcon className="w-3.5 h-3.5" strokeWidth={1.75} />{assignedDelivery.profiles.full_name}</p>
                      )}
                    </div>
                  </div>
                )
              }

              // CARTE MOBILE ACTIVE OU RECHERCHE GLOBALE
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-slate-300 transition-all p-4 md:p-5 mb-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {order.parcel_number ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <PackageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Colis {order.parcel_number}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">
                            #{order.id.slice(0, 6).toUpperCase()}
                          </span>
                        )}
                        {isSearching && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {isClosed ? 'Clôturée' : 'En cours'}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-semibold text-slate-900 truncate">
                        {order.customers?.full_name ?? 'Client'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">{order.customers?.phone}</span>
                        {phoneDigits && (
                          <>
                            <a
                              href={`tel:+${phoneDigits.length === 8 ? '228' + phoneDigits : phoneDigits}`}
                              className="text-slate-400 hover:text-slate-600 transition"
                              title="Appeler"
                              aria-label="Appeler"
                            >
                              <Phone className="w-4 h-4" strokeWidth={1.75} />
                            </a>
                            <a
                              href={toWhatsAppUrl(order.customers?.phone || phoneDigits)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 transition"
                              title="WhatsApp"
                              aria-label="WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                            </a>
                          </>
                        )}
                        <span className="text-xs text-slate-400">• {formatDate(order.ordered_at)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-slate-900">{formatMoney(order.total_amount)}</p>
                      <span className="inline-block text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 mt-1">
                        {isFullyPaid
                          ? 'Réglé'
                          : isPartiallyPaid
                          ? `Acompte ${formatMoney(totalPaid)} · Dû ${formatMoney(remainingDue)}`
                          : 'À payer à la livraison'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <ul className="space-y-1">
                      {order.order_items.map((it) => (
                        <li key={it.id} className="text-sm font-medium text-slate-700">
                          {it.quantity}× {it.product_name}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-slate-400">Livraison : {formatMoney(order.delivery_fee)}</p>
                    {(() => {
                      const match = (order.notes || '').match(/\[INFO MANQUANTE:\s*([^\]]+)\]/i)
                      const missingInfo = match
                        ? match[1].trim()
                        : order.status === 'pending_confirmation'
                        ? 'Quartier ou confirmation taille/numéro'
                        : null
                      if (!missingInfo) return null
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-900">
                            ⚠️ Infos manquantes : {missingInfo}
                          </span>
                          {phoneDigits && (
                            <a
                              href={toWhatsAppUrl(
                                order.customers?.phone || phoneDigits,
                                `Bonjour ${order.customers?.full_name || 'Client(e)'}, votre commande chez ${companyName} est en attente car il nous manque : ${missingInfo}. Merci de nous préciser votre quartier / numéro pour l'envoi.`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition"
                            >
                              <MessageCircle className="w-3 h-3" strokeWidth={1.75} />
                              <span>Relancer sur WhatsApp</span>
                            </a>
                          )}
                        </div>
                      )
                    })()}
                    {assignedDelivery?.profiles?.full_name && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span className="inline-flex items-center gap-1"><BikeIcon className="w-3.5 h-3.5" strokeWidth={1.75} />{assignedDelivery.profiles.full_name}</span>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                            (DELIVERY_STATUS_BADGE[assignedDelivery.status] ?? DELIVERY_STATUS_BADGE.assigned).className
                          }`}
                        >
                          {(DELIVERY_STATUS_BADGE[assignedDelivery.status] ?? DELIVERY_STATUS_BADGE.assigned).label}
                        </span>
                      </div>
                    )}
                    {assignedDelivery?.delivery_proofs?.[0] && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 w-fit">
                        <span className="inline-flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" strokeWidth={1.75} />{assignedDelivery.delivery_proofs[0].recipient_name || 'Réceptionné'}</span>
                        {assignedDelivery.delivery_proofs[0].photo_url && (
                          <a
                            href={assignedDelivery.delivery_proofs[0].photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline font-medium ml-1 inline-flex items-center gap-1"
                          >
                            <CameraIcon className="w-3.5 h-3.5" strokeWidth={1.75} /> Photo
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {canManage && order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(order.id)}
                          className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canManage && canAssign && (
                        <button
                          type="button"
                          onClick={() => setAssigningOrder(order)}
                          className="h-9 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium shadow-sm transition"
                        >
                          {assignedDelivery ? 'Réaffecter' : 'Affecter'}
                        </button>
                      )}
                      {canManage ? (
                        <select
                          disabled={isPending}
                          value={order.status}
                          onChange={(e) =>
                            handleStatusChange(order.id, e.target.value as OrderStatus)
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium px-2.5 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {STATUS_META[st].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      </>
      )}

      {canManage && !isPackingMode && (
        <button
          onClick={() => setShowModal(true)}
          className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-primary-hover transition z-20"
          title="Nouvelle commande"
        >
          +
        </button>
      )}

      {showModal && (
        <NewOrderModal
          customers={customers}
          products={initialProducts}
          existingOrders={orders}
          onClose={() => setShowModal(false)}
          onCreated={(newOrder, createdCustomer) => {
            if (newOrder) {
              setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)])
            }
            if (createdCustomer) {
              setCustomers((prev) => [...prev, createdCustomer])
            }
            router.refresh()
          }}
        />
      )}

      {assigningOrder && (
        <AssignCourierModal
          order={assigningOrder}
          couriers={initialCouriers}
          onClose={() => setAssigningOrder(null)}
          onAssigned={(orderId, delivery, nextStatus) => {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === orderId
                  ? { ...o, status: nextStatus, deliveries: [delivery] }
                  : o
              )
            )
            router.refresh()
          }}
        />
      )}
    </>
  )
}
