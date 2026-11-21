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
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#64748B]">Total Boutiques</p>
          <div className="h-9 w-9 rounded-xl bg-[#0B132B]/5 text-[#0B132B] flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-[#0F172A] tabular-nums">
          {formatNumber(totalStores)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="badge-status badge-delivered">
            {activeStores} actives
          </span>
          <span className="badge-status badge-pending">
            {trialStores} en essai
          </span>
          <span className="badge-status badge-discrepancy">
            {expiredStores} expirées
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#64748B]">
            Revenu Récurrent Estimé (MRR)
          </p>
          <div className="h-9 w-9 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-[#0F172A] tabular-nums">
          {formatNumber(mrrFcfa)}{' '}
          <span className="text-base font-semibold text-[#64748B]">FCFA</span>
        </p>
        <p className="mt-3 text-xs text-[#64748B]">
          Basé sur {activeStores} boutique{activeStores > 1 ? 's' : ''} active
          {activeStores > 1 ? 's' : ''} (forfait mensuel)
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#64748B]">
            Total Colis Traités
          </p>
          <div className="h-9 w-9 rounded-xl bg-[#F0F9FF] text-[#0284C7] flex items-center justify-center">
            <PackageCheck className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-[#0F172A] tabular-nums">
          {formatNumber(totalOrders)}
        </p>
        <p className="mt-3 text-xs text-[#64748B]">
          Volume cumulé sur la plateforme depuis le lancement
        </p>
      </div>
    </section>
  )
}
