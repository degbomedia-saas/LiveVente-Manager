'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bike,
  Check,
  Copy,
  MapPin,
  MessageCircle,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react'
import {
  autoAssignOrdersByZone,
  createDriverInvitation,
} from '@/app/actions/step4'
import { toWhatsAppUrl } from '@/lib/validations/orders'

export interface DriverRowItem {
  id: string
  full_name: string
  phone: string
  email: string | null
  zone_name: string | null
  invite_token: string
  is_active: boolean
  rating_avg: number
  deliveries_count: number
}

export function DriversManagerView({
  initialDrivers,
  storeName,
}: {
  initialDrivers: DriverRowItem[]
  storeName: string
}) {
  const router = useRouter()
  const [drivers, setDrivers] = useState<DriverRowItem[]>(initialDrivers)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('+228 ')
  const [email, setEmail] = useState('')
  const [zoneName, setZoneName] = useState('Tokoin')
  const [latestToken, setLatestToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function getInviteUrl(token: string) {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://kaba-kaba.vercel.app'
    return `${origin}/invite/${token}`
  }

  function handleCopy(token: string) {
    const url = getInviteUrl(token)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url)
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    }
  }

  function handleCreateDriver(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      const res = await createDriverInvitation({
        fullName,
        phone,
        email,
        zoneName,
      })

      if (res.token) {
        setLatestToken(res.token)
      }

      if ('driver' in res && res.driver) {
        setDrivers((prev) => [res.driver as DriverRowItem, ...prev])
      } else {
        setDrivers((prev) => [
          {
            id: `local-${Date.now()}`,
            full_name: fullName,
            phone,
            email: email || null,
            zone_name: zoneName,
            invite_token: res.token || 'demo-token',
            is_active: true,
            rating_avg: 5.0,
            deliveries_count: 0,
          },
          ...prev,
        ])
      }

      setFullName('')
      setPhone('+228 ')
      setEmail('')
      setFeedback('Lien d’invitation livreur généré avec succès.')
      router.refresh()
    })
  }

  function handleAutoAssign() {
    setFeedback(null)
    startTransition(async () => {
      const res = await autoAssignOrdersByZone()
      if ('error' in res && res.error) {
        setFeedback(res.error)
        return
      }
      setFeedback(
        `Assignation automatique effectuée : ${
          'assignedCount' in res ? res.assignedCount : 0
        } commande(s) assignée(s) par zone.`
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">
            Livreurs Moto &amp; Invitations
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Invitez vos coursiers via un lien unique `/invite/[token]` et
            assignez les courses par zone Lomé.
          </p>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleAutoAssign}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Assignation auto par zone</span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-xs sm:text-sm font-semibold text-[#065F46]">
          {feedback}
        </div>
      )}

      {/* Formulaire d'ajout de livreur */}
      <form
        onSubmit={handleCreateDriver}
        className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <span>Ajouter un livreur &amp; générer son lien d&apos;invitation</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nom complet (ex: Koffi Mensah)"
            className="px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
          />
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+228 90 00 00 00"
            className="px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optionnel)"
            className="px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
          />
          <select
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
          >
            {['Tokoin', 'Déckon', 'Agoè', 'Adidogomé', 'Baguida'].map((z) => (
              <option key={z} value={z}>
                Zone : {z}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#0F172A] hover:bg-[#1E293B] text-white transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Générer le lien /invite/[token]</span>
          </button>
        </div>

        {latestToken && (
          <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0F172A]">
                Lien d&apos;invitation prêt :
              </p>
              <p className="text-xs font-mono text-primary truncate mt-0.5">
                {getInviteUrl(latestToken)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(latestToken)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] cursor-pointer"
              >
                {copiedToken === latestToken ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier le lien</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Liste des livreurs en cartes empilées mobile-first */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((d) => {
          const inviteUrl = getInviteUrl(d.invite_token)
          const waShareUrl = toWhatsAppUrl(
            d.phone,
            `Bonjour ${d.full_name}, voici votre lien d'accès Livreur pour la boutique "${storeName}" sur Kaba Kaba : ${inviteUrl}`
          )

          return (
            <div
              key={d.id}
              className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-[#0F172A]">
                        {d.full_name}
                      </h3>
                      <p className="text-xs text-[#64748B]">{d.phone}</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{Number(d.rating_avg ?? 5).toFixed(1)}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                    Zone : <strong className="text-[#0F172A]">{d.zone_name || 'Tokoin'}</strong>
                  </span>
                  <span>
                    <strong className="text-[#0F172A]">{d.deliveries_count ?? 0}</strong> courses
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(d.invite_token)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-[#F8FAFC] hover:bg-[#E2E8F0]/50 border border-[#E2E8F0] text-[#0F172A] transition cursor-pointer"
                >
                  {copiedToken === d.invite_token ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier le lien</span>
                    </>
                  )}
                </button>

                {waShareUrl && (
                  <a
                    href={waShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Partager WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
