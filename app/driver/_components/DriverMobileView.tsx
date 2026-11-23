'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Bike,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  compressImageForUpload,
  compressImageToDataUrl,
  validateImageFile,
} from '@/lib/utils/compress-image'
import {
  submitDriverDeliveryPod,
  type DeliveryFailureReason,
} from '@/app/actions/step4'
import { toWhatsAppUrl } from '@/lib/validations/orders'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'

export interface DriverCourseItem {
  deliveryId?: string
  orderId: string
  orderNumber: string
  status: string
  customerName: string
  customerPhone: string
  customerAddress: string
  totalCodFcfa: number
  proofPhotoUrl?: string | null
  codStatus?: string
  attemptsCount?: number
  lastAttemptNote?: string | null
}

const FAILURE_REASONS: Array<{ id: DeliveryFailureReason; label: string }> = [
  { id: 'injoignable', label: 'Téléphone injoignable' },
  { id: 'absente', label: 'Cliente absente au rendez-vous' },
  { id: 'refuse', label: 'Colis refusé par la cliente' },
  { id: 'adresse_introuvable', label: 'Adresse / repère introuvable' },
  { id: 'autre_moment', label: 'Reporté à un autre moment' },
]

export function DriverMobileView({
  driverName,
  initialCourses,
}: {
  driverName: string
  initialCourses: DriverCourseItem[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'courses' | 'history' | 'profile'>('courses')
  const [courses, setCourses] = useState<DriverCourseItem[]>(initialCourses)
  const [activeCourse, setActiveCourse] = useState<DriverCourseItem | null>(
    null
  )
  const [outcome, setOutcome] = useState<'delivered' | 'failed'>('delivered')
  const [recipientName, setRecipientName] = useState('')
  const [failureReason, setFailureReason] =
    useState<DeliveryFailureReason>('injoignable')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [codCollected, setCodCollected] = useState<string>('0')
  const [codStatus, setCodStatus] = useState<'collected' | 'disputed'>(
    'collected'
  )
  const [modalError, setModalError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPending, startTransition] = useTransition()

  const todoCourses = courses.filter((c) => c.status !== 'delivered')
  const doneCourses = courses.filter((c) => c.status === 'delivered')
  const totalCodCollected = doneCourses.reduce(
    (sum, c) => sum + c.totalCodFcfa,
    0
  )

  async function handlePhotoUpload(file: File | undefined) {
    if (!file) return
    const check = validateImageFile(file)
    if (!check.valid) {
      setModalError(check.error)
      return
    }
    setModalError(null)
    setUploading(true)
    try {
      // Compression côté client (Canvas HTML5, max 1000px, qualité JPEG 0.75) avant envoi Supabase Storage
      const compressedFile = await compressImageForUpload(file, 1000, 0.75)
      const supabase = createClient()
      const path = `pod/pod-${Date.now()}.jpg`
      const { error } = await supabase.storage
        .from('delivery-proofs')
        .upload(path, compressedFile, {
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (!error) {
        const { data: pub } = supabase.storage
          .from('delivery-proofs')
          .getPublicUrl(path)
        if (pub?.publicUrl) {
          setPhotoUrl(pub.publicUrl)
          setUploading(false)
          return
        }
      }

      const compressedDataUrl = await compressImageToDataUrl(file, 1000, 0.75)
      setPhotoUrl(compressedDataUrl)
      setUploading(false)
    } catch {
      setUploading(false)
    }
  }

  function handleValidateAttempt() {
    if (!activeCourse || isSubmitting || isPending || uploading) return
    setModalError(null)

    if (outcome === 'delivered' && !recipientName.trim()) {
      setModalError(
        'Le nom du réceptionnaire est obligatoire pour valider une livraison réussie.'
      )
      return
    }

    const amount =
      outcome === 'delivered'
        ? Number(codCollected) || activeCourse.totalCodFcfa
        : 0

    setIsSubmitting(true)
    startTransition(async () => {
      try {
        const res = await submitDriverDeliveryPod({
          deliveryId: activeCourse.deliveryId,
          orderId: activeCourse.orderId,
          outcome,
          recipientName: outcome === 'delivered' ? recipientName.trim() : undefined,
          failureReason: outcome === 'failed' ? failureReason : undefined,
          proofPhotoUrl: photoUrl,
          codAmountCollected: amount,
          codStatus: outcome === 'delivered' ? codStatus : 'not_applicable',
        })

        if ('error' in res && res.error) {
          setModalError(res.error)
          return
        }

        setCourses((prev) =>
          prev.map((c) =>
            c.orderId === activeCourse.orderId
              ? {
                  ...c,
                  status: outcome === 'delivered' ? 'delivered' : c.status,
                  proofPhotoUrl: photoUrl,
                  codStatus,
                  attemptsCount: (c.attemptsCount ?? 0) + 1,
                  lastAttemptNote:
                    outcome === 'delivered'
                      ? `Livré à ${recipientName.trim()}`
                      : `Tentative échouée : ${failureReason}`,
                }
              : c
          )
        )
        setActiveCourse(null)
        setPhotoUrl(null)
        setRecipientName('')
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    })
  }

  const displayed = tab === 'courses' ? todoCourses : doneCourses

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-24">
      <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <KabaKabaLogo light className="h-7 w-auto" />
          <span className="text-xs font-bold text-[#64748B]">
            • {driverName}
          </span>
        </div>
        <span className="badge-status badge-delivered">
          ● {todoCourses.length} à livrer
        </span>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {tab === 'profile' ? (
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center font-extrabold text-lg">
                {(driverName[0] || 'L').toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#0F172A]">
                  {driverName}
                </h2>
                <p className="text-xs text-[#64748B]">
                  Livreur Moto Kaba Kaba • Lomé (+228)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E2E8F0]">
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                <p className="text-[11px] font-bold text-[#64748B]">
                  Courses livrées
                </p>
                <p className="text-xl font-extrabold text-[#0F172A] mt-0.5 tabular-nums">
                  {doneCourses.length}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                <p className="text-[11px] font-bold text-[#64748B]">
                  Solde COD encaissé
                </p>
                <p className="text-xl font-extrabold text-[#10B981] mt-0.5 tabular-nums">
                  {totalCodCollected.toLocaleString('fr-FR')} F
                </p>
              </div>
            </div>
          </div>
        ) : displayed.length === 0 ? (
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-10 text-center space-y-2">
            <Bike className="w-8 h-8 text-[#64748B] mx-auto" />
            <p className="text-sm font-bold text-[#0F172A]">
              {tab === 'courses'
                ? 'Aucune course en attente'
                : 'Aucune course dans l’historique'}
            </p>
          </div>
        ) : (
          displayed.map((course) => {
            const waUrl = toWhatsAppUrl(
              course.customerPhone,
              `Bonjour ${course.customerName}, c'est votre livreur Kaba Kaba pour le colis ${course.orderNumber}. Je suis en route !`
            )

            return (
              <div
                key={course.orderId}
                className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold font-mono text-[#0F172A]">
                    {course.orderNumber}
                  </span>
                  <span className="badge-status badge-cash">
                    Solde COD : {course.totalCodFcfa.toLocaleString('fr-FR')} F
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-base font-bold text-[#0F172A]">
                    {course.customerName}
                  </p>
                  <p className="text-xs text-[#64748B] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                    <span>{course.customerAddress}</span>
                  </p>
                  {course.lastAttemptNote && (
                    <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 mt-1">
                      Historique ({course.attemptsCount ?? 1} tentative(s)) :{' '}
                      {course.lastAttemptNote}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`tel:${course.customerPhone}`}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A]"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>Appeler</span>
                  </a>

                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>

                {course.status !== 'delivered' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCourse(course)
                      setOutcome('delivered')
                      setRecipientName(course.customerName)
                      setCodCollected(String(course.totalCodFcfa))
                      setCodStatus('collected')
                      setModalError(null)
                    }}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-white inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Valider Livraison ou Tentative</span>
                  </button>
                )}
              </div>
            )
          })
        )}
      </main>

      {/* Modale Livraison (Nom réceptionnaire obligatoire) ou Échec (Motif obligatoire) */}
      {activeCourse && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[#E2E8F0] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-extrabold text-[#0F172A]">
              Pointage course ({activeCourse.orderNumber})
            </h3>

            {/* Bascule Succès / Échec */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => {
                  setOutcome('delivered')
                  setModalError(null)
                }}
                className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  outcome === 'delivered'
                    ? 'bg-[#10B981] text-white'
                    : 'text-[#64748B]'
                }`}
              >
                ✓ Livraison réussie
              </button>
              <button
                type="button"
                onClick={() => {
                  setOutcome('failed')
                  setModalError(null)
                }}
                className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  outcome === 'failed'
                    ? 'bg-rose-600 text-white'
                    : 'text-[#64748B]'
                }`}
              >
                ✕ Échec / Report
              </button>
            </div>

            {outcome === 'delivered' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Nom du réceptionnaire (obligatoire) *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Ex : Afiwa K. (elle-même ou gardien)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
                  />
                </div>

                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-3 px-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#10B981]" />
                    <span>
                      {uploading
                        ? 'Chargement photo...'
                        : photoUrl
                        ? 'Photo POD enregistrée ✓'
                        : 'Prendre la photo de remise (POD)'}
                    </span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Solde COD encaissé auprès du client (FCFA)
                  </label>
                  <input
                    type="number"
                    value={codCollected}
                    onChange={(e) => setCodCollected(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCodStatus('collected')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      codStatus === 'collected'
                        ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    ✓ Encaissé net
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodStatus('disputed')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      codStatus === 'disputed'
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    ⚠️ Écart / Litige
                  </button>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-2">
                  Motif obligatoire de l&apos;échec (conservé dans l&apos;historique) *
                </label>
                <div className="space-y-2">
                  {FAILURE_REASONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFailureReason(r.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-between cursor-pointer ${
                        failureReason === r.id
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
                      }`}
                    >
                      <span>{r.label}</span>
                      <span className="font-mono text-[10px] opacity-75">
                        {r.id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modalError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveCourse(null)}
                className="flex-1 py-3 rounded-xl text-xs font-bold bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending || isSubmitting || uploading}
                onClick={handleValidateAttempt}
                className={`flex-1 py-3 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  outcome === 'delivered' ? 'bg-[#10B981]' : 'bg-rose-600'
                }`}
              >
                {isPending || isSubmitting
                  ? 'Enregistrement...'
                  : outcome === 'delivered'
                  ? 'Confirmer livraison'
                  : 'Enregistrer la tentative'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre de navigation fixe en bas Livreur : Mes courses | Historique | Profil */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF] border-t border-[#E2E8F0] px-4 py-2">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTab('courses')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              tab === 'courses'
                ? 'text-[#10B981] bg-[#ECFDF5]'
                : 'text-[#64748B]'
            }`}
          >
            <Bike className="w-4 h-4 mb-0.5" />
            <span>Mes courses ({todoCourses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              tab === 'history'
                ? 'text-[#10B981] bg-[#ECFDF5]'
                : 'text-[#64748B]'
            }`}
          >
            <Clock className="w-4 h-4 mb-0.5" />
            <span>Historique ({doneCourses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              tab === 'profile'
                ? 'text-[#10B981] bg-[#ECFDF5]'
                : 'text-[#64748B]'
            }`}
          >
            <User className="w-4 h-4 mb-0.5" />
            <span>Profil</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
