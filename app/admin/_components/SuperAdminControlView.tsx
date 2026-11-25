'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  Check,
  Globe,
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
  recordAdminSystemLog,
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

type Lang = 'fr' | 'en'

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
  const [lang, setLang] = useState<Lang>('fr')

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
          : lang === 'fr'
            ? 'Configuration globale, Mode Maintenance & Quotas SaaS enregistrés.'
            : 'Global settings, Maintenance Mode & SaaS Quotas saved.'
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
          ? `Demande Mobile Money de "${req.storeName}" approuvée (${req.requested_plan.toUpperCase()}).`
          : `Demande de "${req.storeName}" rejetée.`
      )
      router.refresh()
    })
  }

  function handleTestErrorLog() {
    startTransition(async () => {
      const res = await recordAdminSystemLog({
        level: 'error',
        source: '/admin (test)',
        message:
          lang === 'fr'
            ? 'Test de journalisation erreur serveur (system_logs)'
            : 'Server error log test entry (system_logs)',
      })
      if ('error' in res && res.error) {
        setFeedback(
          `Exécutez supabase/migrations/023_maintenance_and_system_logs.sql (${res.error})`
        )
      } else {
        setFeedback(
          lang === 'fr'
            ? 'Entrée de test enregistrée dans system_logs.'
            : 'Test entry recorded in system_logs.'
        )
        router.refresh()
      }
    })
  }

  function handleClearLogs() {
    startTransition(async () => {
      const res = await clearAdminSystemLogs()
      if (!('error' in res && res.error)) {
        setLogs([])
        setFeedback(
          lang === 'fr'
            ? 'Journaux system_logs purgés.'
            : 'System logs cleared.'
        )
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Sélecteur de langue FR / EN */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {lang === 'fr'
            ? 'Pilotage Production & Fiabilité Kaba Kaba'
            : 'Production Reliability & Kaba Kaba Control'}
        </p>
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-bold">
          <Globe className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
          <button
            type="button"
            onClick={() => setLang('fr')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer ${
              lang === 'fr'
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer ${
              lang === 'en'
                ? 'bg-[#0F172A] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-xs sm:text-sm font-semibold text-[#065F46]">
          {feedback}
        </div>
      )}

      {/* 0. Mode Maintenance ON/OFF + Santé Supabase (/api/health) */}
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
                  {lang === 'fr'
                    ? 'Mode Maintenance (/maintenance)'
                    : 'Maintenance Mode (/maintenance)'}
                </h2>
                <p className="text-xs text-[#64748B]">
                  {lang === 'fr'
                    ? 'Redirige le trafic vers /maintenance (sauf /admin, /login, /api/health).'
                    : 'Redirects users to /maintenance (except /admin, /login, /api/health).'}
                </p>
              </div>
            </div>

            {/* Interrupteur ON / OFF */}
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
                  isMaintenanceMode ? 'bg-white animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{isMaintenanceMode ? 'ON (ACTIF)' : 'OFF'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              {lang === 'fr'
                ? 'Message affiché sur /maintenance'
                : 'Message displayed on /maintenance'}
            </label>
            <textarea
              rows={2}
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-[#0F172A]"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-semibold text-slate-500">
              platform_settings.is_maintenance_mode
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSavePlatform()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-slate-800 text-white transition cursor-pointer"
            >
              {lang === 'fr' ? 'Mettre à jour le message' : 'Update message'}
            </button>
          </div>
        </div>

        {/* Carte Santé Supabase GET /api/health */}
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
                  {lang === 'fr'
                    ? 'Santé Système (GET /api/health)'
                    : 'System Health (GET /api/health)'}
                </h2>
                <p className="text-xs text-[#64748B]">
                  {lang === 'fr'
                    ? 'Vérification en direct de la connexion PostgreSQL / Supabase'
                    : 'Live PostgreSQL / Supabase connectivity probe'}
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
              <span>{lang === 'fr' ? 'Tester' : 'Probe'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] font-semibold text-slate-500">
                Supabase DB
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
                  ? lang === 'fr'
                    ? 'Connecté'
                    : 'Connected'
                  : lang === 'fr'
                    ? 'Déconnecté'
                    : 'Disconnected'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] font-semibold text-slate-500">
                {lang === 'fr' ? 'Latence SQL' : 'SQL Latency'}
              </p>
              <p className="text-sm font-extrabold text-[#0F172A] mt-0.5 tabular-nums">
                {health.latencyMs !== null ? `${health.latencyMs} ms` : '—'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-semibold text-slate-500">
                Endpoint
              </p>
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono font-bold text-[#0284C7] hover:underline mt-1 inline-block"
              >
                GET /api/health ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Journaux d'erreurs serveur (system_logs - RLS Admin uniquement) */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0F172A]">
                {lang === 'fr'
                  ? 'Journaux Système & Erreurs Serveur (system_logs)'
                  : 'System & Server Error Logs (system_logs)'}
              </h2>
              <p className="text-xs text-[#64748B]">
                {lang === 'fr'
                  ? 'Protégé par RLS (visible uniquement par Super Admin).'
                  : 'Protected by RLS (Admin read-only).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleTestErrorLog}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer"
            >
              {lang === 'fr' ? '+ Simuler un log' : '+ Log test entry'}
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleClearLogs}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Vider' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-4 text-xs text-slate-500">
            {lang === 'fr'
              ? 'Aucune erreur serveur récente dans system_logs.'
              : 'No recent server errors in system_logs.'}
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
                    <span className="font-mono font-bold text-slate-700">
                      [{log.source}]
                    </span>
                  </div>
                  <p className="text-slate-900 font-medium">{log.message}</p>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {new Date(log.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 1. Configuration globale du SaaS (platform_settings) */}
      <form
        onSubmit={(e) => handleSavePlatform(e)}
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

        {/* Numéros marchands T-Money & Flooz (affichés dans la modale Paywall In-App) */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
            Numéros Marchands Mobile Money (Modale Paywall In-App)
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
          <p className="text-[11px] text-[#64748B]">
            Ces numéros sont affichés avec copie en 1 clic dans la modale Paywall In-App dès 20 commandes gratuites.
          </p>
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

      {/* 3. Tableau paginé des vendeurs abonnés (.range() + count: 'exact', 20/page) */}
      <StoresManagementTable
        stores={stores}
        currentPage={currentPage}
        totalCount={totalStoresCount ?? stores.length}
        pageSize={pageSize}
        basePath="/admin"
        lang={lang}
      />
    </div>
  )
}
