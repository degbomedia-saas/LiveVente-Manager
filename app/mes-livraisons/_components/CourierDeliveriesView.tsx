'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, MessageCircle, Check, X } from 'lucide-react'
import { completeCourierDelivery } from '@/app/actions/deliveries'
import { createClient } from '@/lib/supabase/client'
import {
  compressImageForUpload,
  validateImageFile,
} from '@/lib/utils/compress-image'
import { isTodayInLome } from '@/lib/utils/lome-time'
import {
  completeDeliverySchema,
  FAILURE_REASONS,
  PAYMENT_MODES,
} from '@/lib/validations/deliveries'
import { toWhatsAppUrl } from '@/lib/validations/orders'

export interface CourierOrderItemRow {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface CourierDeliveryRow {
  id: string
  status: 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'packed' | 'confirmed'
  delivery_address: string
  scheduled_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  created_at?: string | null
  updated_at?: string | null
  failed_reason: string | null
  orders: {
    id: string
    parcel_number?: string | null
    total_amount: number
    delivery_fee: number
    notes: string | null
    customers: {
      full_name: string
      phone: string
      city: string | null
      address: string | null
    } | null
    order_items?: CourierOrderItemRow[]
    payments?: {
      id: string
      amount: number
      status: string
      reference?: string | null
    }[]
  } | null
  delivery_proofs: {
    id: string
    recipient_name?: string | null
    photo_url?: string | null
    notes: string | null
    created_at: string
  }[]
}

const DELIVERY_STATUS_META = {
  assigned: { label: 'Attribuée', className: 'bg-primary-soft text-primary-soft-text border-primary-border' },
  in_transit: { label: 'En cours', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  delivered: { label: 'Livrée', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Échec', className: 'bg-red-50 text-red-700 border-red-200' },
  packed: { label: 'Emballée', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmée', className: 'bg-primary-soft text-primary-soft-text border-primary-border' },
}

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function isToday(dateStr?: string | null): boolean {
  return isTodayInLome(dateStr)
}

function cleanPhone(raw?: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('228')) {
    return digits.slice(3)
  }
  return digits.length >= 8 ? digits.slice(-8) : digits
}

function parseProductName(raw: string) {
  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (!match) {
    return { description: raw, size: null as string | null, color: null as string | null }
  }
  const description = match[1].trim()
  let size: string | null = null
  let color: string | null = null
  for (const part of match[2].split(',')) {
    const trimmed = part.trim()
    if (trimmed.toLowerCase().startsWith('taille:')) {
      size = trimmed.slice(7).trim()
    } else if (trimmed.toLowerCase().startsWith('couleur:')) {
      color = trimmed.slice(8).trim()
    }
  }
  return { description, size, color }
}

function CompleteDeliveryModal({
  delivery,
  initialOutcome = 'delivered',
  groupSummary,
  onClose,
  onCompleted,
}: {
  delivery: CourierDeliveryRow
  initialOutcome?: 'delivered' | 'failed'
  groupSummary?: {
    groupCount: number
    totalGroupAmount: number
    parcelLabels: string[]
    parcelAmount: number
  }
  onClose: () => void
  onCompleted: (
    deliveryId: string,
    nextStatus: 'delivered' | 'failed',
    failedReason?: string
  ) => void
}) {
  const orderTotal = Math.max(0, Math.round(delivery.orders?.total_amount ?? 0))
  const alreadyPaid = (delivery.orders?.payments ?? [])
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const remainingDue = Math.max(0, Math.round(orderTotal - alreadyPaid))
  const effectiveParcelDue = Math.max(
    0,
    Math.round(groupSummary?.parcelAmount ?? remainingDue)
  )

  const defaultRecipient = delivery.orders?.customers?.full_name ?? ''
  const [recipientName, setRecipientName] = useState(defaultRecipient)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [outcome, setOutcome] = useState<'delivered' | 'failed'>(initialOutcome)
  const [collectedAmount, setCollectedAmount] = useState(String(effectiveParcelDue))
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]>('Espèces')
  const [failureReason, setFailureReason] = useState<(typeof FAILURE_REASONS)[number]>(
    FAILURE_REASONS[0]
  )
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isNetworkError, setIsNetworkError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const check = validateImageFile(file)
      if (!check.valid) {
        setError(check.error)
        e.target.value = ''
        return
      }
      setError(null)
      setPhotoFile(file)
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    }
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting || isPending || uploadingPhoto) return

    setError(null)
    setIsNetworkError(false)

    // Vérification réseau immédiate avant tentative
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsNetworkError(true)
      setError('Connexion interrompue ou signal trop faible. Les données sont conservées. Veuillez réessayer.')
      return
    }

    setIsSubmitting(true)
    let uploadedUrl: string | undefined = undefined

    if (outcome === 'delivered' && photoFile) {
      setUploadingPhoto(true)
      try {
        // Compression côté client (Canvas HTML5, max 1000px, qualité JPEG 0.75) avant envoi Supabase Storage
        const compressedPhoto = await compressImageForUpload(
          photoFile,
          1000,
          0.75
        )
        const supabase = createClient()
        const fileName = `${delivery.id}_${Date.now()}.jpg`

        // Timeout de sécurité pour l'upload photo (15 secondes max)
        const uploadPromise = supabase.storage
          .from('delivery-proofs')
          .upload(fileName, compressedPhoto, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
          })

        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT_UPLOAD')), 15000)
        )

        const { data: uploadRes, error: uploadErr } = (await Promise.race([
          uploadPromise,
          timeoutPromise,
        ])) as { data: { path: string } | null; error: Error | null }

        if (uploadErr) {
          console.warn('Erreur téléversement image:', uploadErr.message)
        } else if (uploadRes) {
          const { data: pubData } = supabase.storage
            .from('delivery-proofs')
            .getPublicUrl(fileName)
          uploadedUrl = pubData.publicUrl
        }
      } catch (err) {
        console.warn('Exception upload photo ou timeout:', err)
      } finally {
        setUploadingPhoto(false)
      }
    }

    const payload =
      outcome === 'delivered'
        ? {
            deliveryId: delivery.id,
            outcome: 'delivered' as const,
            recipientName: recipientName.trim(),
            photoUrl: uploadedUrl,
            collectedAmount,
            paymentMode: Number(collectedAmount) > 0 ? paymentMode : undefined,
          }
        : {
            deliveryId: delivery.id,
            outcome: 'failed' as const,
            failureReason,
            comment,
          }

    const parsed = completeDeliverySchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Données invalides.')
      setIsSubmitting(false)
      return
    }

    startTransition(async () => {
      try {
        // Enveloppe d'exécution avec timeout réseau de 12 secondes
        const actionPromise = completeCourierDelivery(parsed.data)
        const timeoutPromise = new Promise<{ error?: string }>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT_ACTION')), 12000)
        )

        const res = await Promise.race([actionPromise, timeoutPromise])

        if (res.error) {
          setError(res.error)
          setIsSubmitting(false)
          return
        }

        const nextReason =
          outcome === 'failed'
            ? comment.trim()
              ? `${failureReason} — ${comment.trim()}`
              : failureReason
            : undefined

        onCompleted(delivery.id, outcome, nextReason)
        onClose()
      } catch (err) {
        console.warn('Erreur transmission livraison / réseau:', err)
        setIsNetworkError(true)
        setError('Connexion interrompue ou signal trop faible. Les données sont conservées. Veuillez réessayer.')
      } finally {
        setIsSubmitting(false)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md max-h-[88dvh] flex flex-col bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-100 z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Terminer la course</h2>
              {delivery.orders?.parcel_number && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  Colis {delivery.orders.parcel_number}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {delivery.orders?.customers?.full_name ?? 'Client'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0" noValidate>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setOutcome('delivered')
                setError(null)
              }}
              className={`py-3 rounded-lg text-sm font-semibold transition ${
                outcome === 'delivered'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              ✓ Réussi
            </button>
            <button
              type="button"
              onClick={() => {
                setOutcome('failed')
                setError(null)
              }}
              className={`py-3 rounded-lg text-sm font-semibold transition ${
                outcome === 'failed'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              ✕ Échec
            </button>
          </div>

          {outcome === 'delivered' ? (
            <>
              {groupSummary && groupSummary.groupCount > 1 && (
                <div className="bg-violet-50/60 border border-violet-200 rounded-xl p-3 text-xs text-violet-950 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>🔗</span>
                      <span>Livraison groupée ({groupSummary.groupCount} colis cliente)</span>
                    </span>
                    <span className="text-emerald-800 text-sm font-black">
                      Total : {formatMoney(groupSummary.totalGroupAmount)}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-800">
                    Colis à remettre : <strong>{groupSummary.parcelLabels.join(' + ')}</strong> (1 seule livraison facturée).
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-purple-200 text-[11px] text-gray-700">
                    <span>Part attribuée à ce colis :</span>
                    <span className="font-bold text-gray-900">{formatMoney(effectiveParcelDue)}</span>
                  </div>
                </div>
              )}

              {alreadyPaid > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 space-y-1">
                  <div className="flex justify-between">
                    <span>Total commande :</span>
                    <span className="font-semibold">{formatMoney(orderTotal)}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Déjà réglé (boutique) :</span>
                    <span className="font-semibold">- {formatMoney(alreadyPaid)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-blue-200">
                    <span>Reste à percevoir :</span>
                    <span>{formatMoney(remainingDue)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant encaissé sur le terrain (FCFA) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={collectedAmount}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setCollectedAmount(e.target.value)}
                  placeholder="Ex: 5000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {remainingDue === 0
                    ? 'Cette commande est déjà intégralement payée en boutique (indiquez 0 FCFA).'
                    : `Montant prévu restant : ${formatMoney(remainingDue)}`}
                </p>
              </div>

              {Number(collectedAmount) > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mode d&apos;encaissement <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PAYMENT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`py-2.5 rounded-xl border text-xs font-semibold transition ${
                          paymentMode === mode
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preuve de livraison : Réceptionnaire et Photo facultative */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Preuve de livraison
                </p>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Réceptionné par <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Ex: Nom de la cliente, gardien, sœur..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Photo du colis remis (optionnelle)
                  </label>

                  {photoPreview ? (
                    <div className="relative inline-block mt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview}
                        alt="Aperçu preuve"
                        className="w-28 h-28 object-cover rounded-xl border-2 border-blue-800 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow hover:bg-red-700 transition"
                        title="Retirer la photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition bg-white text-center">
                      <span className="text-2xl mb-1">📷</span>
                      <span className="text-xs font-semibold text-blue-900">
                        Prendre une photo ou choisir une image
                      </span>
                      <span className="text-[11px] text-gray-400 mt-0.5">
                        Caméra smartphone ou galerie
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  Motif rapide du report / échec <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Client injoignable', icon: '📵' },
                    { label: 'Client absent', icon: '🚪' },
                    { label: 'Commande refusée', icon: '❌' },
                    { label: 'Report demandé', icon: '⏳' },
                    { label: 'Adresse introuvable', icon: '📍' },
                    { label: 'Problème de paiement', icon: '💳' },
                  ].map((r) => {
                    const isSelected = failureReason === r.label
                    return (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => setFailureReason(r.label as any)}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 text-left ${
                          isSelected
                            ? 'bg-red-700 text-white border-red-800 ring-2 ring-red-300'
                            : 'bg-white text-gray-800 border-gray-200 hover:bg-red-50'
                        }`}
                      >
                        <span className="text-base">{r.icon}</span>
                        <span>{r.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Commentaire ou précision (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ex: Rappeler après 18h"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
                />
              </div>
            </>
          )}

          {error && (
            <div
              className={`rounded-xl px-4 py-2.5 text-sm border ${
                isNetworkError
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {isNetworkError && <span className="font-bold mr-1">⚠️ Réseau :</span>}
              {error}
            </div>
          )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/90 backdrop-blur-sm px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isPending || uploadingPhoto}
              className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isPending || uploadingPhoto}
              className={`flex-1 h-11 rounded-xl text-white text-sm font-semibold shadow-sm transition ${
                outcome === 'delivered'
                  ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                  : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
              }`}
            >
              {uploadingPhoto
                ? 'Envoi de la photo...'
                : isSubmitting || isPending
                ? 'Validation...'
                : isNetworkError
                ? 'Réessayer'
                : outcome === 'delivered'
                ? 'Valider la remise'
                : "Confirmer l'échec"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CourierDeliveriesView({
  courierName,
  companyName = 'Élégance Wax Lomé',
  initialDeliveries,
}: {
  courierName: string
  companyName?: string
  initialDeliveries: CourierDeliveryRow[]
}) {
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<CourierDeliveryRow[]>(initialDeliveries)
  const [isNetworkOffline, setIsNetworkOffline] = useState(false)
  const [isUsingCache, setIsUsingCache] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [completingDelivery, setCompletingDelivery] = useState<{
    delivery: CourierDeliveryRow
    outcome: 'delivered' | 'failed'
    groupSummary?: {
      groupCount: number
      totalGroupAmount: number
      parcelLabels: string[]
      parcelAmount: number
    }
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  // 1. Détection de connectivité réseau réelle (online / offline)
  useEffect(() => {
    function handleOnline() {
      setIsNetworkOffline(false)
    }
    function handleOffline() {
      setIsNetworkOffline(true)
    }

    if (typeof window !== 'undefined') {
      setIsNetworkOffline(!navigator.onLine)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  // Rafraîchissement automatique au focus ou retour sur l'onglet
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

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleVisibility)
      }
    }
  }, [router])

  // 2. Gestion du cache local (localStorage)
  useEffect(() => {
    const CACHE_KEY = 'lv_courier_deliveries_cache'

    if (initialDeliveries && initialDeliveries.length > 0) {
      setDeliveries(initialDeliveries)
      setIsUsingCache(false)
      try {
        // Enregistrer la version minimale utile en local
        localStorage.setItem(CACHE_KEY, JSON.stringify(initialDeliveries))
      } catch (err) {
        console.warn('Erreur mise en cache locale:', err)
      }
    } else if (typeof window !== 'undefined' && (!initialDeliveries || initialDeliveries.length === 0)) {
      if (navigator.onLine === false) {
        try {
          const cachedStr = localStorage.getItem(CACHE_KEY)
          if (cachedStr) {
            const cachedData = JSON.parse(cachedStr) as CourierDeliveryRow[]
            if (Array.isArray(cachedData) && cachedData.length > 0) {
              setDeliveries(cachedData)
              setIsUsingCache(true)
            }
          }
        } catch (err) {
          console.warn('Erreur lecture cache local:', err)
        }
      } else {
        setDeliveries([])
        setIsUsingCache(false)
      }
    }
  }, [initialDeliveries])

  const { activeDeliveries, todayHistory, todayEarnings, completedTodayCount, inTransitCount } =
    useMemo(() => {
      const todo = deliveries
        .filter(
          (d) =>
            d.status === 'in_transit' ||
            d.status === 'assigned' ||
            (d.status as string) === 'packed' ||
            (d.status as string) === 'confirmed'
        )
        .sort((a, b) => (a.status === 'in_transit' ? -1 : b.status === 'in_transit' ? 1 : 0))

      const finishedToday = deliveries.filter(
        (d) =>
          (d.status === 'delivered' || d.status === 'failed') &&
          isToday(d.delivered_at ?? d.updated_at ?? d.created_at)
      )

      const succeededToday = finishedToday.filter((d) => d.status === 'delivered')
      const earnings = succeededToday.reduce(
        (sum, d) => sum + Number(d.orders?.delivery_fee ?? 0),
        0
      )
      const inTransit = deliveries.filter((d) => d.status === 'in_transit').length

      return {
        activeDeliveries: todo,
        todayHistory: finishedToday,
        todayEarnings: earnings,
        completedTodayCount: succeededToday.length,
        inTransitCount: inTransit,
      }
    }, [deliveries])

  // Regroupement des livraisons actives par numéro de téléphone cliente (groupage)
  const groupedActiveDeliveries = useMemo(() => {
    const map = new Map<
      string,
      {
        deliveries: CourierDeliveryRow[]
        totalArticlesAmount: number
        uniqueDeliveryFee: number
        totalAlreadyPaid: number
        totalGroupNetToCollect: number
        parcelLabels: string[]
      }
    >()

    for (const del of activeDeliveries) {
      const phone = cleanPhone(del.orders?.customers?.phone)
      if (!phone) continue

      const existing = map.get(phone)
      if (!existing) {
        map.set(phone, {
          deliveries: [del],
          totalArticlesAmount: 0,
          uniqueDeliveryFee: 0,
          totalAlreadyPaid: 0,
          totalGroupNetToCollect: 0,
          parcelLabels: [],
        })
      } else {
        existing.deliveries.push(del)
      }
    }

    for (const [, group] of map.entries()) {
      let sumItems = 0
      let maxFee = 0
      let sumPaid = 0

      for (const d of group.deliveries) {
        const itemsSum = (d.orders?.order_items ?? []).reduce(
          (sum, item) =>
            sum +
            (Number(item.subtotal) ||
              Number(item.quantity) * Number(item.unit_price) ||
              0),
          0
        )
        const orderItemsTotal =
          itemsSum > 0
            ? itemsSum
            : Math.max(
                0,
                (d.orders?.total_amount ?? 0) - (d.orders?.delivery_fee ?? 0)
              )
        sumItems += orderItemsTotal

        const fee = Number(d.orders?.delivery_fee ?? 0)
        if (fee > maxFee) maxFee = fee

        const paid = (d.orders?.payments ?? [])
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + Number(p.amount), 0)
        sumPaid += paid

        const pNum = d.orders?.parcel_number
          ? `Colis ${d.orders.parcel_number}`
          : `#${d.orders?.id.slice(0, 6).toUpperCase()}`
        group.parcelLabels.push(pNum)
      }

      group.totalArticlesAmount = sumItems
      group.uniqueDeliveryFee = maxFee
      group.totalAlreadyPaid = sumPaid
      // Somme exacte des articles + frais de livraison uniques - acomptes éventuels
      group.totalGroupNetToCollect = Math.max(0, sumItems + maxFee - sumPaid)
    }

    return map
  }, [activeDeliveries])

  // Tous les colis assignés non clôturés sont directement en tournée active

  return (
    <div className="space-y-5">
      {/* Bandeau alerte dégradation réseau / mode hors-ligne */}
      {(isNetworkOffline || isUsingCache) && (
        <div className="bg-amber-500 text-amber-950 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 shadow-md border border-amber-400">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <span className="text-lg leading-none">🟡</span>
            <span>
              {isNetworkOffline
                ? 'Connexion réseau coupée — Données locales affichées pour vos livraisons'
                : 'Mode hors-ligne / Réseau instable — Données locales affichées'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="text-xs font-bold underline hover:opacity-80 flex-shrink-0"
          >
            Actualiser
          </button>
        </div>
      )}

      {/* 1. Header mobile épuré : prénom + statut En ligne */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Espace livreur</p>
            <h1 className="text-xl font-semibold text-slate-900 mt-0.5 truncate">
              Bonjour {courierName.trim().split(/\s+/)[0]}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsOnline((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
              isOnline
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
          </button>
        </div>

        {/* 2. Statistiques condensées : Gains · Livrées · Restantes */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 border border-slate-100 py-3">
          <div className="px-3 text-center">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Gains</p>
            <p className="text-base font-semibold text-slate-900 mt-0.5 leading-tight">
              {formatMoney(todayEarnings)}
            </p>
          </div>
          <div className="px-3 text-center">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Livrées</p>
            <p className="text-base font-semibold text-emerald-600 mt-0.5 leading-tight">
              {completedTodayCount}
            </p>
          </div>
          <div className="px-3 text-center">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Restantes</p>
            <p className="text-base font-semibold text-primary mt-0.5 leading-tight">
              {activeDeliveries.length}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Section Tournée active (Toute course assignée est directement active) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Ma tournée active ({activeDeliveries.length})
          </h2>
        </div>

        {activeDeliveries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <div className="text-4xl mb-3">🛵</div>
            <p className="font-bold text-gray-900">Aucune course en attente</p>
            <p className="text-sm text-gray-500 mt-1">
              Vos nouvelles livraisons attribuées apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDeliveries.map((delivery) => {
              const meta = DELIVERY_STATUS_META[delivery.status]
              const orderCode = delivery.orders?.id
                ? `#${delivery.orders.id.slice(0, 6).toUpperCase()}`
                : 'Course'
              const customer = delivery.orders?.customers
              const phoneKey = cleanPhone(customer?.phone)
              const groupInfo = phoneKey ? groupedActiveDeliveries.get(phoneKey) : undefined
              const isGrouped = Boolean(groupInfo && groupInfo.deliveries.length > 1)
              const groupCount = groupInfo?.deliveries.length ?? 1

              const totalOrder = delivery.orders?.total_amount ?? 0
              const alreadyPaidShop = (delivery.orders?.payments ?? [])
                .filter((p) => p.status === 'completed')
                .reduce((sum, p) => sum + Number(p.amount), 0)

              // Calcul de la part individuelle pour ce colis avec frais uniques si groupé
              const orderItemsSum = (delivery.orders?.order_items ?? []).reduce(
                (sum, item) =>
                  sum +
                  (Number(item.subtotal) ||
                    Number(item.quantity) * Number(item.unit_price) ||
                    0),
                0
              )
              const itemsTotal =
                orderItemsSum > 0
                  ? orderItemsSum
                  : Math.max(
                      0,
                      totalOrder - (delivery.orders?.delivery_fee ?? 0)
                    )

              const isFirstInGroup = isGrouped && groupInfo?.deliveries[0]?.id === delivery.id
              const parcelDeliveryFee = isGrouped
                ? isFirstInGroup
                  ? groupInfo.uniqueDeliveryFee
                  : 0
                : Number(delivery.orders?.delivery_fee ?? 0)

              const parcelNetToCollect = Math.max(0, itemsTotal + parcelDeliveryFee - alreadyPaidShop)
              const amount = isGrouped ? parcelNetToCollect : Math.max(0, totalOrder - alreadyPaidShop)
              const isCurrent = delivery.status === 'in_transit'

              return (
                <div
                  key={delivery.id}
                  className={`bg-white rounded-2xl shadow-sm p-4 md:p-5 space-y-4 border transition ${
                    isCurrent ? 'border-primary-border ring-2 ring-primary-soft' : 'border-slate-200'
                  }`}
                >
                  {/* EN-TÊTE : MACARON COLIS GÉANT + MONTANT GÉANT */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {delivery.orders?.parcel_number ? (
                          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200 font-bold px-3 py-1 rounded-lg text-sm">
                            <span className="text-2xl">📦</span>
                            <span>Colis {delivery.orders.parcel_number}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 font-bold px-3 py-1 rounded-lg text-sm">
                            <span>📦</span>
                            <span>{orderCode}</span>
                          </div>
                        )}

                        {isGrouped && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 text-purple-900 border-2 border-purple-300 text-xs font-black shadow-xs">
                            <span className="text-sm">🔗</span>
                            <span>Livraison groupée ({groupCount} colis)</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <span
                          className={`inline-block text-xs font-extrabold px-3 py-1 rounded-full border ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                        {isGrouped ? '🔗 Total groupé cliente' : (amount > 0 ? 'Net à encaisser' : 'Paiement')}
                      </p>
                      <p className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight">
                        {isGrouped
                          ? formatMoney(groupInfo!.totalGroupNetToCollect)
                          : (amount > 0 ? formatMoney(amount) : '0 FCFA')}
                      </p>
                      {isGrouped ? (
                        <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                          Dont {formatMoney(parcelNetToCollect)} pour ce colis ({delivery.orders?.parcel_number ? `Colis ${delivery.orders.parcel_number}` : orderCode})
                        </p>
                      ) : amount === 0 ? (
                        <span className="inline-block text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 mt-0.5">
                          ✓ Déjà réglé en boutique
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* COORDONNÉES CLIENTE & QUARTIER */}
                  <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-2">
                    <div>
                      <p className="font-extrabold text-gray-900 text-base sm:text-lg">
                        👤 {customer?.full_name ?? 'Client'}
                      </p>
                      <p className="text-sm font-bold text-blue-900 mt-0.5">
                        📍 {customer?.city ? `${customer.city} — ` : ''}{delivery.delivery_address}
                      </p>
                    </div>

                    {/* BOUTONS TACTILES D'APPEL ET WHATSAPP */}
                    {customer?.phone && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={`tel:${customer.phone}`}
                          className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm flex items-center justify-center gap-2 transition active:scale-95"
                        >
                          <Phone className="w-4 h-4" strokeWidth={1.75} />
                          <span>Appeler</span>
                        </a>
                        <a
                          href={toWhatsAppUrl(customer.phone, `Bonjour ${customer.full_name}, je suis votre livreur pour votre colis ${delivery.orders?.parcel_number || ''}. Je suis en route !`)}
                          target="_blank"
                          rel="noreferrer"
                          className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition active:scale-95"
                        >
                          <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* BANDEAU RECAPITULATIF SI LIVRAISON GROUPÉE */}
                  {isGrouped && groupInfo && (
                    <div className="bg-violet-50/60 border border-violet-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-purple-950 flex items-center gap-1.5">
                          <span className="text-base">🔗</span>
                          <span>LIVRAISON GROUPÉE ({groupCount} COLIS CHEZ CETTE CLIENTE)</span>
                        </span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900 border border-purple-300">
                          1 seule livraison facturée ({formatMoney(groupInfo.uniqueDeliveryFee)})
                        </span>
                      </div>
                      <p className="text-xs text-purple-900 font-medium">
                        Remettre ensemble les colis : <strong>{groupInfo.parcelLabels.join(' + ')}</strong>
                      </p>
                      <div className="pt-2 border-t border-purple-200/80 flex items-center justify-between text-xs">
                        <span className="text-gray-700">Somme articles ({formatMoney(groupInfo.totalArticlesAmount)}) + 1 livraison ({formatMoney(groupInfo.uniqueDeliveryFee)}) :</span>
                        <span className="text-base font-black text-emerald-800">{formatMoney(groupInfo.totalGroupNetToCollect)}</span>
                      </div>
                    </div>
                  )}

                  {/* ARTICLES ESSENTIELS */}
                  {delivery.orders?.order_items && delivery.orders.order_items.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                      <p className="text-[11px] font-bold text-blue-950 uppercase tracking-wider">
                        Contenu du colis ({delivery.orders.order_items.length} article{delivery.orders.order_items.length > 1 ? 's' : ''})
                      </p>
                      <div className="space-y-1 text-xs text-gray-800">
                        {delivery.orders.order_items.map((item) => {
                          const info = parseProductName(item.product_name)
                          return (
                            <div key={item.id} className="flex flex-wrap items-center gap-1.5">
                              <span className="font-extrabold text-gray-950">{item.quantity}×</span>
                              <span className="font-semibold text-gray-900">{info.description}</span>
                              {info.size && (
                                <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-[11px] font-bold">
                                  Taille {info.size}
                                </span>
                              )}
                              {info.color && (
                                <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-[11px] font-medium text-gray-600">
                                  {info.color}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* BOUTONS D'ACTION TACTILES FORMAT MOTO / PLEIN SOLEIL */}
                  <div className="grid grid-cols-1 gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        setCompletingDelivery({
                          delivery,
                          outcome: 'delivered',
                          groupSummary:
                            isGrouped && groupInfo
                              ? {
                                  groupCount,
                                  totalGroupAmount: groupInfo.totalGroupNetToCollect,
                                  parcelLabels: groupInfo.parcelLabels,
                                  parcelAmount: parcelNetToCollect,
                                }
                              : undefined,
                        })
                      }
                      className="h-13 px-4 rounded-2xl bg-primary hover:bg-primary-hover active:scale-98 disabled:opacity-50 text-white font-semibold text-base transition shadow-sm flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" strokeWidth={2} />
                      <span>Livré &amp; Encaissé</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        setCompletingDelivery({
                          delivery,
                          outcome: 'failed',
                          groupSummary:
                            isGrouped && groupInfo
                              ? {
                                  groupCount,
                                  totalGroupAmount: groupInfo.totalGroupNetToCollect,
                                  parcelLabels: groupInfo.parcelLabels,
                                  parcelAmount: parcelNetToCollect,
                                }
                              : undefined,
                        })
                      }
                      className="h-11 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-98 disabled:opacity-50 text-slate-600 font-medium text-sm transition flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" strokeWidth={1.75} />
                      <span>Reporté / Échec</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 4. Section Historique du jour (Repliable) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
        >
          <span className="font-bold text-gray-900 text-base">
            Historique du jour ({todayHistory.length})
          </span>
          <span className="text-gray-500 text-sm">{historyOpen ? '▲' : '▼'}</span>
        </button>

        {historyOpen && (
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {todayHistory.length === 0 ? (
              <p className="p-5 text-sm text-gray-500 text-center">
                Aucune course terminée aujourd&apos;hui.
              </p>
            ) : (
              todayHistory.map((item) => {
                const meta = DELIVERY_STATUS_META[item.status]
                const customer = item.orders?.customers
                return (
                  <div key={item.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.orders?.parcel_number && (
                          <span className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            {item.orders.parcel_number}
                          </span>
                        )}
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {customer?.full_name ?? 'Client'}
                        </p>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {customer?.city ? `${customer.city} • ` : ''}
                        {item.delivery_address}
                      </p>
                      {item.status === 'failed' && item.failed_reason && (
                        <p className="text-xs text-red-600 mt-1">
                          Motif : {item.failed_reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1.5">
                      <p className="text-sm font-bold text-gray-900">
                        {formatMoney(item.orders?.total_amount ?? 0)}
                      </p>
                      {item.status === 'delivered' && customer?.phone && (() => {
                        const parcelDisplay = (
                          item.orders?.parcel_number ||
                          item.orders?.id.slice(0, 6).toUpperCase() ||
                          ''
                        ).replace(/^#/, '')
                        const receiptMsg = [
                          `Merci pour votre achat chez ${companyName} ! 🛍️`,
                          `Votre commande #${parcelDisplay} a bien été remise et soldée (${Math.round(item.orders?.total_amount ?? 0).toLocaleString('fr-FR')} FCFA).`,
                          'À très bientôt pour de nouvelles pépites !',
                        ].join('\n')
                        return (
                          <a
                            href={toWhatsAppUrl(customer.phone, receiptMsg)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition"
                          >
                            <MessageCircle className="w-3 h-3" strokeWidth={1.75} />
                            <span>Envoyer reçu client</span>
                          </a>
                        )
                      })()}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </section>

      {completingDelivery && (
        <CompleteDeliveryModal
          delivery={completingDelivery.delivery}
          initialOutcome={completingDelivery.outcome}
          groupSummary={completingDelivery.groupSummary}
          onClose={() => setCompletingDelivery(null)}
          onCompleted={(deliveryId, nextStatus, failedReason) => {
            setDeliveries((prev) =>
              prev.map((d) =>
                d.id === deliveryId
                  ? {
                      ...d,
                      status: nextStatus,
                      delivered_at:
                        nextStatus === 'delivered' ? new Date().toISOString() : d.delivered_at,
                      updated_at: new Date().toISOString(),
                      failed_reason: failedReason ?? d.failed_reason,
                    }
                  : d
              )
            )
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
