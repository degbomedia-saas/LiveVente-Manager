'use client'

import { useRef, useState, useTransition } from 'react'
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Mic,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Square,
  User,
} from 'lucide-react'
import { createPublicLiveCartOrder } from '@/app/actions/voice-order'
import type { ParsedVoiceOrderResult } from '@/app/api/orders/parse-voice/route'

export interface PublicLiveProduct {
  id: string
  name: string
  price_fcfa: number
  stock_qty: number
  category: string
}

export interface PublicLiveZone {
  zone_name: string
  fee_fcfa: number
}

export interface PublicLiveStoreData {
  companyId: string
  storeName: string
  logoUrl: string | null
  paletteHex: string
  products: PublicLiveProduct[]
  zones: PublicLiveZone[]
}

export function PublicLiveCartClient({
  store,
}: {
  store: PublicLiveStoreData
}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const [cart, setCart] = useState<Record<string, number>>({})
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('+228 ')
  const [selectedZone, setSelectedZone] = useState<PublicLiveZone>(
    store.zones[0] ?? { zone_name: 'Tokoin', fee_fcfa: 1000 }
  )
  const [addressNote, setAddressNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'tmoney' | 'flooz'
  >('cash')
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false)
  const [confirmedParcel, setConfirmedParcel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta)
      const copy = { ...prev }
      if (next === 0) delete copy[productId]
      else copy[productId] = next
      return copy
    })
  }

  const selectedItems = store.products
    .filter((p) => (cart[p.id] ?? 0) > 0)
    .map((p) => ({
      product_id: p.id,
      product_name: p.name,
      quantity: cart[p.id],
      unit_price_fcfa: p.price_fcfa,
    }))

  const subtotal = selectedItems.reduce(
    (s, it) => s + it.quantity * it.unit_price_fcfa,
    0
  )
  const totalCod = subtotal + (selectedZone?.fee_fcfa ?? 1000)

  async function startVoiceDictation() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsAnalyzingVoice(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'live-client.webm')
          fd.append('company_id', store.companyId)
          const res = await fetch('/api/orders/parse-voice', {
            method: 'POST',
            body: fd,
          })
          const data = await res.json()
          if (res.ok && !data.error) {
            const parsed = data as ParsedVoiceOrderResult
            if (parsed.customer_name) setCustomerName(parsed.customer_name)
            if (parsed.phone) setPhone(parsed.phone)
            if (parsed.address_note) setAddressNote(parsed.address_note)
            if (parsed.zone_name) {
              const z = store.zones.find(
                (zn) =>
                  zn.zone_name.toLowerCase() === parsed.zone_name.toLowerCase()
              )
              if (z) setSelectedZone(z)
            }
            if (parsed.items.length > 0) {
              const nextCart: Record<string, number> = { ...cart }
              for (const item of parsed.items) {
                if (item.product_id) {
                  nextCart[item.product_id] = item.quantity
                }
              }
              setCart(nextCart)
            }
          }
        } finally {
          setIsAnalyzingVoice(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      setError('Autorisez le micro pour dicter votre commande.')
    }
  }

  function stopVoiceDictation() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  function handleConfirmOrder(e: React.FormEvent) {
    e.preventDefault()
    if (selectedItems.length === 0) {
      setError('Veuillez choisir au moins un article du Live.')
      return
    }
    if (!phone.trim() || phone.trim() === '+228') {
      setError('Veuillez indiquer votre numéro WhatsApp.')
      return
    }
    setError(null)

    startTransition(async () => {
      const res = await createPublicLiveCartOrder({
        companyId: store.companyId,
        customerName: customerName.trim() || 'Cliente Live',
        phone: phone.trim(),
        zoneName: selectedZone.zone_name,
        deliveryFeeFcfa: selectedZone.fee_fcfa,
        addressNote: addressNote.trim(),
        paymentMethod,
        items: selectedItems,
      })

      setConfirmedParcel(res.parcelNumber)
    })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-6 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Bandeau Boutique Live */}
        <div
          className="rounded-3xl p-5 text-white shadow-sm flex items-center justify-between"
          style={{ backgroundColor: store.paletteHex }}
        >
          <div className="flex items-center gap-3">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logoUrl}
                alt={store.storeName}
                className="h-11 w-11 rounded-2xl object-cover bg-white p-0.5"
              />
            ) : (
              <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center font-extrabold text-lg">
                {(store.storeName[0] || 'K').toUpperCase()}
              </div>
            )}
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                PANIER DU LIVE EN DIRECT
              </span>
              <h1 className="text-lg font-extrabold mt-0.5">
                {store.storeName}
              </h1>
            </div>
          </div>

          <ShoppingBag className="w-6 h-6 opacity-90" />
        </div>

        {confirmedParcel ? (
          <div className="rounded-3xl bg-[#FFFFFF] border border-[#E2E8F0] p-8 text-center space-y-3 shadow-xs">
            <CheckCircle2
              className="w-12 h-12 mx-auto"
              style={{ color: store.paletteHex }}
            />
            <h2 className="text-xl font-extrabold text-[#0F172A]">
              Commande {confirmedParcel} enregistrée !
            </h2>
            <p className="text-sm text-[#64748B]">
              Merci <strong>{customerName || 'Cliente'}</strong> ! Votre colis
              pour <strong>{selectedZone.zone_name}</strong> ({totalCod.toLocaleString('fr-FR')} FCFA) a été transmis à la boutique.
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirmedParcel(null)
                setCart({})
              }}
              style={{ backgroundColor: store.paletteHex }}
              className="mt-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer"
            >
              Passer une autre commande
            </button>
          </div>
        ) : (
          <form onSubmit={handleConfirmOrder} className="space-y-4">
            {/* Option Dictée Vocale Cliente */}
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-4 flex items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-extrabold text-[#0F172A]">
                  🎙️ Commander à la voix (Express)
                </p>
                <p className="text-[#64748B]">
                  Dictez votre nom, numéro, quartier et article choisi.
                </p>
              </div>
              {isAnalyzingVoice ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#10B981]" />
              ) : isRecording ? (
                <button
                  type="button"
                  onClick={stopVoiceDictation}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-white" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVoiceDictation}
                  style={{ backgroundColor: store.paletteHex }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Dicter</span>
                </button>
              )}
            </div>

            {/* Catalogue des articles du Live du jour */}
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-4 space-y-3">
              <h2 className="text-sm font-extrabold text-[#0F172A]">
                1. Choisissez vos articles du Live ({store.products.length})
              </h2>

              <div className="divide-y divide-[#E2E8F0]">
                {store.products.map((prod) => {
                  const qty = cart[prod.id] ?? 0
                  return (
                    <div
                      key={prod.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#0F172A]">
                          {prod.name}
                        </p>
                        <p
                          className="text-xs font-extrabold tabular-nums"
                          style={{ color: store.paletteHex }}
                        >
                          {prod.price_fcfa.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQty(prod.id, -1)}
                          className="h-8 w-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-extrabold tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(prod.id, 1)}
                          style={
                            qty > 0
                              ? { backgroundColor: store.paletteHex }
                              : undefined
                          }
                          className={`h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer ${
                            qty > 0
                              ? 'text-white'
                              : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A]'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Coordonnées & Quartier Lomé */}
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-4 space-y-3">
              <h2 className="text-sm font-extrabold text-[#0F172A]">
                2. Vos coordonnées &amp; Quartier de livraison
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Votre nom (ex: Afiwa)"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
                  />
                </div>

                <div className="relative">
                  <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+228 90 12 34 56"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1.5">
                  Choisissez votre quartier (frais de course auto) :
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {store.zones.map((z) => {
                    const active = selectedZone.zone_name === z.zone_name
                    return (
                      <button
                        key={z.zone_name}
                        type="button"
                        onClick={() => setSelectedZone(z)}
                        style={
                          active
                            ? { backgroundColor: store.paletteHex }
                            : undefined
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          active
                            ? 'text-white border-transparent'
                            : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
                        }`}
                      >
                        {z.zone_name} (+{z.fee_fcfa} F)
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="relative">
                <MapPin className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                  placeholder="Repère (ex: Face pharmacie Nation, portail bleu)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    { id: 'cash', label: 'Espèces' },
                    { id: 'tmoney', label: 'T-Money' },
                    { id: 'flooz', label: 'Flooz' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      paymentMethod === m.id
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              style={{ backgroundColor: store.paletteHex }}
              className="w-full py-4 px-5 rounded-2xl text-sm font-extrabold text-white shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isPending
                ? 'Confirmation en cours...'
                : `Confirmer ma commande • ${totalCod.toLocaleString('fr-FR')} FCFA`}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
