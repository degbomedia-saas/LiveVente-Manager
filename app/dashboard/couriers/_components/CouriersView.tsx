'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, MessageCircle, MapPin, Mail, Phone, Bike } from 'lucide-react'
import { toggleCourierStatus } from '@/app/actions/deliveries'
import { inviteCourier } from '@/app/actions/couriers'
import { toWhatsAppUrl } from '@/lib/validations/orders'

export interface CourierRow {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
  email?: string | null
  zone?: string | null
  invitation_status?: string | null
}

interface CouriersViewProps {
  initialCouriers: CourierRow[]
  userRole: string
}

function buildActivationUrl(courier: {
  id: string
  full_name: string
  email?: string | null
  zone?: string | null
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({
    cid: courier.id,
    name: courier.full_name,
  })
  if (courier.email) params.set('email', courier.email)
  if (courier.zone) params.set('zone', courier.zone)
  return `${origin}/first-login?${params.toString()}`
}

function AddCourierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (courier?: CourierRow | null) => void
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [zone, setZone] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [invitedResult, setInvitedResult] = useState<{
    courier: CourierRow
    activationUrl: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    startTransition(async () => {
      const res = await inviteCourier({
        fullName,
        phone,
        email,
        zone,
      })

      if (res.error) {
        if (res.field) setErrors({ [res.field]: res.error })
        else setServerError(res.error)
        return
      }

      const courier = res.courier as CourierRow
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const activationUrl = `${origin}${res.activationPath}`

      onCreated(courier)
      setInvitedResult({ courier, activationUrl })
    })
  }

  function handleCopyLink() {
    if (!invitedResult) return
    navigator.clipboard.writeText(invitedResult.activationUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {invitedResult ? 'Accès livreur prêt' : 'Inviter un livreur'}
            </h2>
            <p className="text-xs text-slate-500">
              {invitedResult
                ? 'Le livreur définira son mot de passe lors de sa première connexion'
                : 'Aucun mot de passe à inventer — activation autonome par le livreur'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition"
          >
            ✕
          </button>
        </div>

        {invitedResult ? (
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1">
              <p className="text-xs font-semibold text-amber-800">
                Statut : Invité / En attente de première connexion
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {invitedResult.courier.full_name}
              </p>
              {invitedResult.courier.email && (
                <p className="text-xs text-slate-600">{invitedResult.courier.email}</p>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Lien d&apos;activation personnel
              </p>
              <p className="text-xs text-slate-700 break-all font-mono">
                {invitedResult.activationUrl}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm flex items-center justify-center gap-2 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Lien copié !' : "Copier le lien d'activation"}</span>
              </button>
              {invitedResult.courier.phone && (
                <a
                  href={toWhatsAppUrl(
                    invitedResult.courier.phone,
                    `Bonjour ${invitedResult.courier.full_name}, voici votre lien pour activer votre accès Espace Livreur Élégance Wax Lomé et définir votre mot de passe : ${invitedResult.activationUrl}`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Envoyer l&apos;accès</span>
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition"
            >
              Terminer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Prénom &amp; Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Kodjo"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
              {errors.fullName && <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Numéro de téléphone WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 90 12 34 56"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
              {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Adresse email (Gmail) <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: kodjo.livreur@gmail.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Zone habituelle / Quartier de référence
              </label>
              <input
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Ex: Tokoin, Bè"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
            </div>

            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {serverError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-semibold text-sm transition"
              >
                {isPending ? 'Création...' : "Créer & Envoyer l'accès"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function CouriersView({ initialCouriers, userRole }: CouriersViewProps) {
  const router = useRouter()
  const [couriers, setCouriers] = useState<CourierRow[]>(initialCouriers)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setCouriers(initialCouriers)
  }, [initialCouriers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return couriers
    return couriers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
    )
  }, [couriers, search])

  function handleToggle(courier: CourierRow) {
    const nextStatus = !courier.is_active
    startTransition(async () => {
      const res = await toggleCourierStatus({
        courierId: courier.id,
        isActive: nextStatus,
      })
      if (res.error) {
        alert(res.error)
        return
      }
      setCouriers((prev) =>
        prev.map((c) => (c.id === courier.id ? { ...c, is_active: nextStatus } : c))
      )
      router.refresh()
    })
  }

  const canManage = userRole === 'owner' || userRole === 'employee'

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Livreurs</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {couriers.length} livreur{couriers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-blue-800 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
          >
            <span className="text-lg leading-none">+</span> Ajouter un livreur
          </button>
        )}
      </div>

      {couriers.length > 0 && (
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un livreur par nom ou téléphone..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
          />
        </div>
      )}

      {couriers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-white rounded-2xl border border-gray-100">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">🚴</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Aucun livreur enregistré
          </h3>
          <p className="text-gray-500 text-sm max-w-xs mb-6">
            Ajoutez vos livreurs pour pouvoir leur affecter des commandes.
          </p>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-blue-800 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
            >
              + Ajouter un livreur
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((courier) => {
            const activationUrl = buildActivationUrl(courier)
            const isPendingInvite = courier.invitation_status === 'pending'

            return (
              <div
                key={courier.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center shrink-0">
                      <Bike className="w-4 h-4" strokeWidth={1.75} />
                    </span>
                    <p className="font-semibold text-slate-900 truncate">{courier.full_name}</p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        courier.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {courier.is_active ? 'Actif' : 'Inactif'}
                    </span>
                    {isPendingInvite && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        Invité / En attente de première connexion
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pl-10">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                      {courier.phone || 'Non renseigné'}
                    </span>
                    {courier.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {courier.email}
                      </span>
                    )}
                    {courier.zone && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {courier.zone}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activationUrl)
                        setCopiedId(courier.id)
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition"
                    >
                      {copiedId === courier.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === courier.id ? 'Copié !' : "Lien d'accès"}</span>
                    </button>
                    {courier.phone && (
                      <a
                        href={toWhatsAppUrl(
                          courier.phone,
                          `Bonjour ${courier.full_name}, voici votre lien pour activer votre accès Espace Livreur Élégance Wax Lomé : ${activationUrl}`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Envoyer</span>
                      </a>
                    )}
                    <button
                      disabled={isPending}
                      onClick={() => handleToggle(courier)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                        courier.is_active
                          ? 'text-slate-400 hover:text-rose-600'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {courier.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canManage && (
        <button
          onClick={() => setShowModal(true)}
          className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition z-20"
          title="Ajouter un livreur"
        >
          +
        </button>
      )}

      {showModal && (
        <AddCourierModal
          onClose={() => setShowModal(false)}
          onCreated={(newCourier) => {
            if (newCourier) {
              setCouriers((prev) => [newCourier, ...prev.filter((c) => c.id !== newCourier.id)])
            }
            router.refresh()
          }}
        />
      )}
    </>
  )
}
