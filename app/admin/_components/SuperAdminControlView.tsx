'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  RefreshCw,
  Settings,
  Smartphone,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import {
  clearAdminSystemLogs,
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

export interface SystemLogItem {
  id: string
  level: 'info' | 'warning' | 'error' | 'critical'
  source: string
  message: string
  created_at: string
}

interface HealthCheckState {
  status: 'ok' | 'degraded' | 'loading'
  supabase: 'connected' | 'disconnected'
  latencyMs: number | null
  timestamp: string | null
}

type AdminTab = 'business' | 'system'

function parseApprovedPaymentDetails(req: SubscriptionRequestItem): {
  amountLabel: string
  operatorLabel: string
  cleanRef: string
} {
  const raw = req.mobile_money_ref || ''
  let amountLabel =
    req.requested_plan === 'business' ? '25 000 FCFA' : '5 000 FCFA'
  if (raw.includes('15 000') || raw.includes('15000')) {
    amountLabel = '15 000 FCFA'
  } else if (raw.includes('25 000') || raw.includes('25000')) {
    amountLabel = '25 000 FCFA'
  } else if (raw.includes('5 000') || raw.includes('5000')) {
    amountLabel = '5 000 FCFA'
  }

  const cleanRef = raw.replace(/^\[[^\]]+\]\s*/, '').trim() || raw
  const upperRef = cleanRef.toUpperCase()
  const phoneDigits = (req.phone || '').replace(/\D/g, '')
  const localPrefix =
    phoneDigits.startsWith('228') && phoneDigits.length >= 5
      ? phoneDigits.slice(3, 5)
      : phoneDigits.slice(0, 2)

  let operatorLabel = 'T-Money'
  if (
    upperRef.includes('FLOOZ') ||
    upperRef.includes('MOOV') ||
    upperRef.startsWith('FL-') ||
    ['96', '97', '98', '99', '79'].includes(localPrefix)
  ) {
    operatorLabel = 'Flooz (Moov)'
  } else {
    operatorLabel = 'T-Money (Togocom)'
  }

  return { amountLabel, operatorLabel, cleanRef }
}

export function SuperAdminControlView({
  initialSaasName,
  initialSaasLogoUrl,
  initialFreeOrders = 20,
  initialFreeDrivers = 1,
  initialFreeAiTrials = 3,
  initialProDrivers = 3,
  initialMaintenanceMode = false,
  initialMaintenanceMessage = '',
  initialTmoneyPhone = '+228 90 12 34 56',
  initialFloozPhone = '+228 96 12 34 56',
  initialSystemLogs = [],
  stores,
  totalStoresCount,
  currentPage = 1,
  pageSize = 20,
  requests,
}: {
  initialSaasName: string
  initialSaasLogoUrl: string | null
  initialFreeOrders?: number
  initialFreeDrivers?: number
  initialFreeAiTrials?: number
  initialProDrivers?: number
  initialMaintenanceMode?: boolean
  initialMaintenanceMessage?: string | null
  initialTmoneyPhone?: string
  initialFloozPhone?: string
  initialSystemLogs?: SystemLogItem[]
  stores: SuperAdminStoreRow[]
  totalStoresCount?: number
  currentPage?: number
  pageSize?: number
  requests: SubscriptionRequestItem[]
}) {
  const router = useRouter()
  const { setBrand } = useBrandConfig()
  const [activeTab, setActiveTab] = useState<AdminTab>('business')

  const [saasName, setSaasName] = useState(initialSaasName)
  const [saasLogoUrl, setSaasLogoUrl] = useState(initialSaasLogoUrl ?? '')
  const [freeOrders, setFreeOrders] = useState(initialFreeOrders)
  const [freeDrivers, setFreeDrivers] = useState(initialFreeDrivers)
  const [freeAiTrials, setFreeAiTrials] = useState(initialFreeAiTrials)
  const [proDrivers, setProDrivers] = useState(initialProDrivers)
  const [tmoneyPhone, setTmoneyPhone] = useState(initialTmoneyPhone)
  const [floozPhone, setFloozPhone] = useState(initialFloozPhone)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(
    initialMaintenanceMode
  )
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    initialMaintenanceMessage ??
      'Maintenance technique en cours sur Kaba Kaba. Nous revenons très vite !'
  )

  const [reqList, setReqList] = useState<SubscriptionRequestItem[]>(requests)
  const [logs, setLogs] = useState<SystemLogItem[]>(initialSystemLogs)
  const [health, setHealth] = useState<HealthCheckState>({
    status: 'loading',
    supabase: 'connected',
    latencyMs: null,
    timestamp: null,
  })
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const pendingRequests = useMemo(
    () => reqList.filter((r) => r.status === 'pending'),
    [reqList]
  )

  const validatedPayments = useMemo(
    () =>
      reqList
        .filter((r) => r.status === 'approved')
        .slice(0, 20),
    [reqList]
  )

  async function checkHealth() {
    setHealth((prev) => ({ ...prev, status: 'loading' }))
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      const json = await res.json()
      setHealth({
        status: json.status === 'ok' ? 'ok' : 'degraded',
        supabase:
          json.supabase === 'connected' ? 'connected' : 'disconnected',
        latencyMs:
          typeof json.latencyMs === 'number' ? json.latencyMs : null,
        timestamp: json.timestamp ?? new Date().toISOString(),
      })
    } catch {
      setHealth({
        status: 'degraded',
        supabase: 'disconnected',
        latencyMs: null,
        timestamp: new Date().toISOString(),
      })
    }
  }

  useEffect(() => {
    void checkHealth()
  }, [])

  useEffect(() => {
    setLogs(initialSystemLogs)
  }, [initialSystemLogs])

  function handleSavePlatform(
    e?: React.FormEvent,
    overrideMaintenance?: boolean
  ) {
    if (e) e.preventDefault()
    setFeedback(null)
    const nextMaint =
      typeof overrideMaintenance === 'boolean'
        ? overrideMaintenance
        : isMaintenanceMode

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
        isMaintenanceMode: nextMaint,
        maintenanceMessage: maintenanceMessage.trim() || null,
        merchantTmoneyPhone: tmoneyPhone.trim() || '+228 90 12 34 56',
        merchantFloozPhone: floozPhone.trim() || '+228 96 12 34 56',
      })

      setFeedback(
        'error' in res && res.error
          ? res.error
          : 'Vos paramètres de marque, numéros marchands et quotas ont été enregistrés.'
      )
      void checkHealth()
      router.refresh()
    })
  }

  function handleToggleMaintenance() {
    const nextValue = !isMaintenanceMode
    setIsMaintenanceMode(nextValue)
    handleSavePlatform(undefined, nextValue)
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
          ? `Paiement Mobile Money de "${req.storeName}" validé. Le forfait est maintenant actif.`
          : `Demande de "${req.storeName}" refusée.`
      )
      router.refresh()
    })
  }

  function handleClearLogs() {
    startTransition(async () => {
      const res = await clearAdminSystemLogs()
      if (!('error' in res && res.error)) {
        setLogs([])
        setFeedback("Journal d'activité vidé.")
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Navigation par 2 onglets : Pilotage Business (par défaut) & Système & Maintenance */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('business')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
            activeTab === 'business'
              ? 'bg-[#0F172A] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Pilotage Business</span>
          {pendingRequests.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-rose-600 text-white px-2 py-0.5 text-[11px] font-black">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
            activeTab === 'system'
              ? 'bg-[#0F172A] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Système &amp; Maintenance</span>
          {isMaintenanceMode && (
            <span className="inline-flex items-center rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-black">
              MAINTENANCE ON
            </span>
          )}
        </button>
      </div>

      {feedback && (
        <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-xs sm:text-sm font-semibold text-[#065F46]">
          {feedback}
        </div>
      )}

      {activeTab === 'business' ? (
        <div className="space-y-6">
          {/* 1. Demandes d'upgrade Mobile Money en attente (avec badge rouge) */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-[#F0F9FF] text-[#0284C7] flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0F172A]">
                    Demandes d&apos;activation Mobile Money
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Vérifiez les références T-Money et Flooz envoyées par les
                    boutiques pour activer leur forfait.
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
                  pendingRequests.length > 0
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {pendingRequests.length} en attente
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-[#64748B] py-2">
                Aucune demande d&apos;activation en attente actuellement.
              </p>
            ) : (
              <div className="space-y-2.5">
                {pendingRequests.map((req) => {
                  const details = parseApprovedPaymentDetails(req)
                  return (
                    <div
                      key={req.id}
                      className="rounded-xl bg-rose-50/40 border border-rose-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-extrabold text-[#0F172A]">
                            {req.storeName}
                          </p>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-extrabold">
                            {details.amountLabel}
                          </span>
                          <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[11px] font-bold">
                            {details.operatorLabel}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] mt-1">
                          Référence :{' '}
                          <strong className="font-mono text-[#0F172A]">
                            {details.cleanRef}
                          </strong>{' '}
                          • Tél : {req.phone} •{' '}
                          {new Date(req.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDecision(req, 'approved')}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#10B981] hover:bg-[#059669] text-white cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Valider le paiement</span>
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDecision(req, 'rejected')}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Refuser</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 2. Tableau paginé des boutiques clientes */}
          <StoresManagementTable
            stores={stores}
            currentPage={currentPage}
            totalCount={totalStoresCount ?? stores.length}
            pageSize={pageSize}
            basePath="/admin"
          />

          {/* 3. Tableau des 20 derniers paiements Mobile Money validés */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0F172A]">
                    20 derniers paiements Mobile Money validés
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Historique des encaissements d&apos;abonnements T-Money et
                    Flooz approuvés.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-800">
                {validatedPayments.length} validé
                {validatedPayments.length > 1 ? 's' : ''}
              </span>
            </div>

            {validatedPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucun paiement Mobile Money validé pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-4">Boutique</th>
                      <th className="py-3 px-4">Montant</th>
                      <th className="py-3 px-4">Opérateur</th>
                      <th className="py-3 px-5">Référence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {validatedPayments.map((pay) => {
                      const details = parseApprovedPaymentDetails(pay)
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-5 text-slate-600 tabular-nums">
                            {new Date(pay.created_at).toLocaleDateString(
                              'fr-FR',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-slate-900">
                            {pay.storeName}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-emerald-700 tabular-nums">
                            {details.amountLabel}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                details.operatorLabel.includes('Flooz')
                                  ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                  : 'bg-amber-50 text-amber-900 border border-amber-200'
                              }`}
                            >
                              {details.operatorLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-800">
                            {details.cleanRef}
                            {pay.phone ? (
                              <span className="ml-2 font-sans font-normal text-xs text-slate-500">
                                ({pay.phone})
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. Configuration Marque, Numéros Marchands T-Money/Flooz & Quotas */}
          <form
            onSubmit={(e) => handleSavePlatform(e)}
            className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#0F172A]">
                  Marque, Numéros Marchands &amp; Quotas d&apos;Offres
                </h2>
                <p className="text-xs text-[#64748B]">
                  Personnalisez les coordonnées d&apos;encaissement T-Money /
                  Flooz et les limites des forfaits.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Nom de la plateforme *
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
                  Logo de la plateforme (URL optionnelle)
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

            <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
                Numéros Marchands Mobile Money (Modale d&apos;abonnement)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-amber-700 mb-1">
                    Numéro Marchand T-Money (Togocom) *
                  </label>
                  <input
                    type="text"
                    required
                    value={tmoneyPhone}
                    onChange={(e) => setTmoneyPhone(e.target.value)}
                    placeholder="+228 90 12 34 56"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-sm font-bold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sky-700 mb-1">
                    Numéro Marchand Flooz (Moov Africa) *
                  </label>
                  <input
                    type="text"
                    required
                    value={floozPhone}
                    onChange={(e) => setFloozPhone(e.target.value)}
                    placeholder="+228 96 12 34 56"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/50 border border-sky-200 text-sm font-bold text-[#0F172A]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
                Limites par formule d&apos;abonnement
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">
                    Essai Gratuit : Max commandes
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={freeOrders}
                    onChange={(e) =>
                      setFreeOrders(Number(e.target.value) || 20)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">
                    Essai Gratuit : Max livreurs
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={freeDrivers}
                    onChange={(e) =>
                      setFreeDrivers(Number(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">
                    Essai Gratuit : Dictées vocales
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={freeAiTrials}
                    onChange={(e) =>
                      setFreeAiTrials(Number(e.target.value) || 3)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">
                    Plan Solo : Max livreurs
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
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-white transition cursor-pointer"
              >
                Enregistrer les paramètres
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Onglet 2 : Système & Maintenance */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Carte Mode Maintenance */}
            <div
              className={`rounded-2xl border p-6 shadow-2xs space-y-4 transition ${
                isMaintenanceMode
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      isMaintenanceMode
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#0F172A]">
                      Mode Maintenance
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Affiche un écran d&apos;attente aux visiteurs pendant vos
                      mises à jour.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleToggleMaintenance}
                  aria-pressed={isMaintenanceMode}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold transition cursor-pointer ${
                    isMaintenanceMode
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isMaintenanceMode
                        ? 'bg-white animate-pulse'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span>{isMaintenanceMode ? 'ACTIF' : 'DÉSACTIVÉ'}</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Message affiché aux visiteurs
                </label>
                <textarea
                  rows={2}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-[#0F172A]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSavePlatform()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-slate-800 text-white transition cursor-pointer"
                >
                  Enregistrer le message
                </button>
              </div>
            </div>

            {/* Carte État du Serveur */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      health.status === 'ok'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#0F172A]">
                      État du Serveur &amp; Base de données
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Disponibilité du service en temps réel
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void checkHealth()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      health.status === 'loading' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Actualiser</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Base de données
                  </p>
                  <p
                    className={`text-sm font-extrabold mt-0.5 ${
                      health.supabase === 'connected'
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    ●{' '}
                    {health.supabase === 'connected'
                      ? 'Opérationnelle'
                      : 'Hors ligne'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Temps de réponse
                  </p>
                  <p className="text-sm font-extrabold text-[#0F172A] mt-0.5 tabular-nums">
                    {health.latencyMs !== null ? `${health.latencyMs} ms` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Journal d'activité & Alertes */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#0F172A]">
                    Journal d&apos;activité &amp; Alertes
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Historique des événements techniques importants.
                  </p>
                </div>
              </div>

              {logs.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleClearLogs}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider le journal</span>
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-4 text-xs text-slate-500">
                 aucune alerte enregistrée récemment.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-white hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-extrabold uppercase text-[10px] ${
                            log.level === 'critical' || log.level === 'error'
                              ? 'bg-rose-100 text-rose-800'
                              : log.level === 'warning'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {log.level}
                        </span>
                      </div>
                      <p className="text-slate-900 font-medium">
                        {log.message}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
