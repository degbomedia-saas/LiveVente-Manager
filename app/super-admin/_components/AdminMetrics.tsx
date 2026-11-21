import { Building2, PackageCheck, Wallet } from 'lucide-react'

interface AdminMetricsProps {
  totalStores: number
  activeStores: number
  trialStores: number
  expiredStores: number
  mrrFcfa: number
  totalOrders: number
}

export function AdminMetrics({
  totalStores,
  activeStores,
  trialStores,
  expiredStores,
  mrrFcfa,
  totalOrders,
}: AdminMetricsProps) {
  const formatNumber = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n))

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">Total Boutiques</p>
          <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-slate-900 tabular-nums">
          {formatNumber(totalStores)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {activeStores} actives
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {trialStores} en essai
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {expiredStores} expirées
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">
            Revenu Récurrent Estimé (MRR)
          </p>
          <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-slate-900 tabular-nums">
          {formatNumber(mrrFcfa)}{' '}
          <span className="text-base font-semibold text-slate-500">FCFA</span>
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Basé sur {activeStores} boutique{activeStores > 1 ? 's' : ''} active
          {activeStores > 1 ? 's' : ''} (forfait mensuel)
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">
            Total Colis Traités
          </p>
          <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <PackageCheck className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-slate-900 tabular-nums">
          {formatNumber(totalOrders)}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Volume cumulé sur la plateforme depuis le lancement
        </p>
      </div>
    </section>
  )
}
