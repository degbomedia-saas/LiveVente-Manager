'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Settings, ShieldCheck, Smartphone, X } from 'lucide-react'
import {
  handleSubscriptionRequest,
  updatePlatformSettings,
} from '@/app/actions/step4'
import { useBrandConfig } from '@/lib/config/brand'
import {
  StoresManagementTable,
  type SuperAdminStoreRow,
} from '@/app/super-admin/_components/StoresManagementTable'

export interface SubscriptionRequestItem {
  id: string
  seller_id: string
  storeName: string
  requested_plan: 'free_mvp' | 'pro' | 'business'
  mobile_money_ref: string
  phone: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export function SuperAdminControlView({
  initialSaasName,
  initialSaasLogoUrl,
  initialFreeOrders = 30,
  initialFreeDrivers = 1,
  initialFreeAiTrials = 3,
  initialProDrivers = 3,
  stores,
  requests,
}: {
  initialSaasName: string
  initialSaasLogoUrl: string | null
  initialFreeOrders?: number
  initialFreeDrivers?: number
  initialFreeAiTrials?: number
  initialProDrivers?: number
  stores: SuperAdminStoreRow[]
  requests: SubscriptionRequestItem[]
}) {
  const router = useRouter()
  const { setBrand } = useBrandConfig()

  const [saasName, setSaasName] = useState(initialSaasName)
  const [saasLogoUrl, setSaasLogoUrl] = useState(initialSaasLogoUrl ?? '')
  const [freeOrders, setFreeOrders] = useState(initialFreeOrders)
  const [freeDrivers, setFreeDrivers] = useState(initialFreeDrivers)
  const [freeAiTrials, setFreeAiTrials] = useState(initialFreeAiTrials)
  const [proDrivers, setProDrivers] = useState(initialProDrivers)
  const [reqList, setReqList] = useState<SubscriptionRequestItem[]>(requests)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSavePlatform(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      setBrand((prev) => ({
        ...prev,
        name: saasName.trim() || 'Kaba Kaba',
        logoUrl: saasLogoUrl.trim() || null,
      }))

      const res = await updatePlatformSettings({
        saasName,
        saasLogoUrl: saasLogoUrl.trim() || null,
        freeMvpMaxOrdersMonth: freeOrders,
        freeMvpMaxDrivers: freeDrivers,
        freeMvpMaxAiTrials: freeAiTrials,
        proMaxDrivers: proDrivers,
      })

      setFeedback(
        'error' in res && res.error
          ? res.error
          : 'Configuration globale & Quotas SaaS (platform_settings) enregistrés.'
      )
      router.refresh()
    })
  }

  function handleDecision(
    req: SubscriptionRequestItem,
    decision: 'approved' | 'rejected'
  ) {
    setFeedback(null)
    startTransition(async () => {
      await handleSubscriptionRequest({
        requestId: req.id,
        sellerId: req.seller_id,
        requestedPlan: req.requested_plan,
        decision,
      })
      setReqList((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: decision } : r))
      )
      setFeedback(
        decision === 'approved'
          ? `Demande Mobile Money de "${req.storeName}" approuvée (${req.requested_plan.toUpperCase()}).`
          : `Demande de "${req.storeName}" rejetée.`
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {feedback && (
        <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-xs sm:text-sm font-semibold text-[#065F46]">
          {feedback}
        </div>
      )}

      {/* 1. Configuration globale du SaaS (platform_settings) */}
      <form
        onSubmit={handleSavePlatform}
        className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-6 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#0F172A]">
              Marque &amp; Configuration SaaS (platform_settings)
            </h2>
            <p className="text-xs text-[#64748B]">
              Modifiez le nom et le logo global de la plateforme en temps réel.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Nom du SaaS *
            </label>
            <input
              type="text"
              required
              value={saasName}
              onChange={(e) => setSaasName(e.target.value)}
              placeholder="Kaba Kaba"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              URL du Logo SaaS (optionnel)
            </label>
            <input
              type="text"
              value={saasLogoUrl}
              onChange={(e) => setSaasLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
            />
          </div>
        </div>

        {/* Quotas par forfait modifiables dans /admin */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
            Quotas par forfait (free_mvp / pro / business)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#64748B] mb-1">
                Free MVP : Max cmd / mois
              </label>
              <input
                type="number"
                min={1}
                value={freeOrders}
                onChange={(e) => setFreeOrders(Number(e.target.value) || 30)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] mb-1">
                Free MVP : Max livreurs
              </label>
              <input
                type="number"
                min={1}
                value={freeDrivers}
                onChange={(e) => setFreeDrivers(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] mb-1">
                Free MVP : Essais IA (Audio/Texte)
              </label>
              <input
                type="number"
                min={1}
                value={freeAiTrials}
                onChange={(e) => setFreeAiTrials(Number(e.target.value) || 3)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] mb-1">
                Forfait Pro : Max livreurs
              </label>
              <input
                type="number"
                min={1}
                value={proDrivers}
                onChange={(e) => setProDrivers(Number(e.target.value) || 3)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Forfait Pro : commandes &amp; IA illimitées • Forfait Business :
            tout illimité + rôle employee + export CSV.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-white transition cursor-pointer"
          >
            Enregistrer platform_settings
          </button>
        </div>
      </form>

      {/* 2. Demandes d'upgrade Mobile Money (subscription_requests) */}
      <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#F0F9FF] text-[#0284C7] flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0F172A]">
                Demandes d&apos;Upgrade Mobile Money (subscription_requests)
              </h2>
              <p className="text-xs text-[#64748B]">
                Validez les références T-Money / Flooz envoyées par les
                vendeurs.
              </p>
            </div>
          </div>
          <span className="badge-status badge-pending">
            {reqList.filter((r) => r.status === 'pending').length} en attente
          </span>
        </div>

        {reqList.length === 0 ? (
          <p className="text-xs text-[#64748B] py-3">
            Aucune demande d&apos;upgrade Mobile Money en attente.
          </p>
        ) : (
          <div className="space-y-2.5">
            {reqList.map((req) => (
              <div
                key={req.id}
                className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-extrabold text-[#0F172A]">
                    {req.storeName} → Forfait{' '}
                    <span className="text-[#10B981] uppercase">
                      {req.requested_plan}
                    </span>
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Réf. T-Money/Flooz :{' '}
                    <strong className="font-mono text-[#0F172A]">
                      {req.mobile_money_ref}
                    </strong>{' '}
                    • Tél : {req.phone}
                  </p>
                </div>

                {req.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDecision(req, 'approved')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#10B981] text-white cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Valider</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDecision(req, 'rejected')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Rejeter</span>
                    </button>
                  </div>
                ) : (
                  <span
                    className={`badge-status ${
                      req.status === 'approved'
                        ? 'badge-delivered'
                        : 'badge-discrepancy'
                    }`}
                  >
                    ● {req.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Tableau de tous les vendeurs abonnés (Activer / Suspendre / +30 jours) */}
      <StoresManagementTable stores={stores} />
    </div>
  )
}
