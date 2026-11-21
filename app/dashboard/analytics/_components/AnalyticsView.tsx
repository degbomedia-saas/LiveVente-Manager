'use client'

import { useState, useTransition } from 'react'
import {
  TrendingUp,
  Bike,
  Wallet,
  ShoppingBag,
  MapPin,
  Download,
  Printer,
  Check,
  AlertTriangle,
} from 'lucide-react'
import {
  getAnalyticsReport,
  type AnalyticsPeriod,
  type AnalyticsReportData,
} from '@/app/actions/reports'

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

const PERIOD_OPTIONS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Cette semaine' },
  { id: 'month', label: 'Ce mois' },
]

function escapeCsvField(val: string | number): string {
  const s = String(val ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export default function AnalyticsView({
  initialData,
}: {
  initialData: AnalyticsReportData
}) {
  const [report, setReport] = useState<AnalyticsReportData>(initialData)
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialData.period)
  const [isPending, startTransition] = useTransition()

  function handlePeriodChange(next: AnalyticsPeriod) {
    setPeriod(next)
    startTransition(async () => {
      const res = await getAnalyticsReport(next)
      if (res.data) {
        setReport(res.data)
      }
    })
  }

  function handleExportCsv() {
    const headers = [
      'Date',
      'N° Commande',
      'Client',
      'Téléphone',
      'Quartier',
      'Montant Vente',
      'Frais Livraison',
      'Livreur',
      'Statut',
      'Mode Encaissement',
    ]

    const lines = [
      headers.join(';'),
      ...report.journalRows.map((row) =>
        [
          escapeCsvField(row.date),
          escapeCsvField(row.orderRef),
          escapeCsvField(row.clientName),
          escapeCsvField(row.clientPhone),
          escapeCsvField(row.neighborhood),
          escapeCsvField(Math.round(row.saleAmount)),
          escapeCsvField(Math.round(row.deliveryFee)),
          escapeCsvField(row.courierName),
          escapeCsvField(row.statusLabel),
          escapeCsvField(row.paymentMethod),
        ].join(';')
      ),
    ]

    const csvContent = lines.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `journal-caisse-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const periodLabel = PERIOD_OPTIONS.find((p) => p.id === period)?.label ?? "Aujourd'hui"

  return (
    <div className="space-y-6">
      {/* En-tête imprimable A4 (visible uniquement à l'impression) */}
      <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{report.storeName}</h1>
            <p className="text-sm text-slate-600">
              Récapitulatif financier &amp; Journal de caisse — {periodLabel}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Édité le {new Date(report.generatedAt).toLocaleString('fr-FR')}
          </p>
        </div>
      </div>

      {/* En-tête écran */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Analytics &amp; Export Comptable
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Performances commerciales, zones actives et journal de caisse
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sélecteur de période */}
          <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 shadow-2xs">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={isPending}
                onClick={() => handlePeriodChange(opt.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === opt.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Bouton Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-medium shadow-sm transition inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
            <span>Télécharger le journal (CSV / Excel)</span>
          </button>

          {/* Bouton Imprimer */}
          <button
            type="button"
            onClick={handlePrint}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition inline-flex items-center gap-2"
          >
            <Printer className="w-4 h-4" strokeWidth={1.75} />
            <span>Imprimer le récapitulatif du jour</span>
          </button>
        </div>
      </div>

      {/* 1. 4 Cartes de Synthèse Financière */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${isPending ? 'opacity-60 transition-opacity' : ''}`}>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wider">CA Ventes Produits</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatMoney(report.kpis.productSalesRevenue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Hors frais de livraison ({periodLabel})</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Bike className="w-4 h-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wider">Commissions Livreurs</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatMoney(report.kpis.courierCommissionsPaid)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Frais de course sur livraisons réussies</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Wallet className="w-4 h-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wider">Net Encaissé Boutique</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            {formatMoney(report.kpis.netShopCollected)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Comptoir + versements rapprochés</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wider">Volume &amp; Taux de succès</p>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-slate-900">{report.kpis.totalOrders}</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary-soft-text">
              {report.kpis.deliverySuccessRate}% livrées
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {report.kpis.deliveredOrders} livrée{report.kpis.deliveredOrders > 1 ? 's' : ''} •{' '}
            {report.kpis.failedOrCancelledOrders} échec / report
          </p>
        </div>
      </div>

      {/* 2. Ventilation par quartier (Top 5) & Journal de Caisse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Quartiers */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-primary-soft text-primary-soft-text flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Top 5 Quartiers actifs</h2>
              <p className="text-xs text-slate-500">Zones les plus commandées</p>
            </div>
          </div>

          {report.topNeighborhoods.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Aucune commande enregistrée sur cette période.
            </p>
          ) : (
            <div className="space-y-3.5">
              {report.topNeighborhoods.map((z, idx) => (
                <div key={z.zone} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800 truncate">
                      {idx + 1}. {z.zone}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 shrink-0">
                      {z.ordersCount} cmd ({z.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(8, z.percentage)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 text-right">
                    CA zone : {formatMoney(z.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tableau du Journal de Caisse & Rapprochement */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Journal de Caisse &amp; Rapprochement
              </h2>
              <p className="text-xs text-slate-500">
                Historique chronologique des clôtures et versements livreurs
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
              {report.settlementLogs.length} versement{report.settlementLogs.length > 1 ? 's' : ''}
            </span>
          </div>

          {report.settlementLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">
              Aucun versement livreur enregistré sur cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="py-2.5 pr-3">Date &amp; Heure</th>
                    <th className="py-2.5 px-3">Livreur</th>
                    <th className="py-2.5 px-3 text-center">Colis livrés</th>
                    <th className="py-2.5 px-3 text-right">Montant remis</th>
                    <th className="py-2.5 pl-3 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.settlementLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-3 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(log.paidAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{log.courierName}</td>
                      <td className="py-3 px-3 text-center text-slate-700">
                        {log.deliveredCount}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatMoney(log.amount)}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        {log.differenceAmount > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200"
                            title={log.differenceReason || 'Écart enregistré'}
                          >
                            <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                            Reliquat : -{formatMoney(log.differenceAmount)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" strokeWidth={2} />
                            Compte exact
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
