'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, PlusCircle, ShieldCheck, Wallet } from 'lucide-react'
import { recordPartialOrFullSettlement } from '@/app/actions/step4'

export interface FinanceOrderItem {
  id: string
  orderNumber: string
  customerName: string
  totalOrderFcfa: number
  depositShopFcfa: number
  driverCollectedForStoreFcfa: number
  deliveryFeeFcfa: number
  paymentMethod: string
  status: string
  orderedAt: string
}

export interface SettlementRowItem {
  id: string
  total_cod_fcfa: number
  delivery_fees_fcfa: number
  platform_fee_fcfa: number
  net_payout_fcfa: number
  expected_amount_fcfa?: number | null
  remitted_amount_fcfa?: number | null
  discrepancy_fcfa?: number | null
  is_partial?: boolean | null
  notes?: string | null
  status: string
  created_at: string
}

export function FinancesView({
  orders,
  settlements: initialSettlements,
}: {
  orders: FinanceOrderItem[]
  settlements: SettlementRowItem[]
}) {
  const router = useRouter()
  const [settlements, setSettlements] =
    useState<SettlementRowItem[]>(initialSettlements)

  const deliveredOrders = orders.filter((o) => o.status === 'delivered')

  // 1. Acomptes payés directement à la boutique (JAMAIS comptés dans la dette du livreur)
  const totalDirectShopDeposits = deliveredOrders.reduce(
    (s, o) => s + o.depositShopFcfa,
    0
  )

  // 2. Frais de course livreur séparés
  const totalDeliveryFees = deliveredOrders.reduce(
    (s, o) => s + o.deliveryFeeFcfa,
    0
  )

  // 3. Solde encaissé par le livreur pour la boutique (hors acomptes boutique et hors frais de course)
  const totalDriverCollectedForStore = deliveredOrders.reduce(
    (s, o) => s + o.driverCollectedForStoreFcfa,
    0
  )

  // Total déjà remis dans l'historique des settlements
  const totalAlreadyRemitted = settlements.reduce(
    (s, r) => s + Number(r.remitted_amount_fcfa ?? r.total_cod_fcfa ?? 0),
    0
  )

  // Dette nette restante du livreur envers la boutique
  const remainingDriverDebt = Math.max(
    0,
    totalDriverCollectedForStore - totalAlreadyRemitted
  )

  const [expectedInput, setExpectedInput] = useState(
    String(remainingDriverDebt)
  )
  const [remittedInput, setRemittedInput] = useState(
    String(remainingDriverDebt)
  )
  const [isPartial, setIsPartial] = useState(false)
  const [notes, setNotes] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const liveExpected = Math.max(0, Number(expectedInput) || 0)
  const liveRemitted = Math.max(0, Number(remittedInput) || 0)
  const liveDiscrepancy = liveRemitted - liveExpected

  function handleRecordSettlement(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      const res = await recordPartialOrFullSettlement({
        expectedAmountFcfa: liveExpected,
        remittedAmountFcfa: liveRemitted,
        deliveryFeesFcfa: totalDeliveryFees,
        isPartial,
        notes,
      })

      const newRow: SettlementRowItem = {
        id: `remise-${Date.now()}`,
        total_cod_fcfa: liveRemitted,
        delivery_fees_fcfa: totalDeliveryFees,
        platform_fee_fcfa: 0,
        net_payout_fcfa: liveRemitted,
        expected_amount_fcfa: liveExpected,
        remitted_amount_fcfa: liveRemitted,
        discrepancy_fcfa: liveDiscrepancy,
        is_partial: isPartial,
        notes: notes || null,
        status: liveDiscrepancy >= 0 && !isPartial ? 'paid_out' : 'pending',
        created_at: new Date().toISOString(),
      }

      setSettlements((prev) => [newRow, ...prev])
      setNotes('')
      setFeedback(
        'error' in res && res.error
          ? res.error
          : `Remise enregistrée dans l'historique (Écart : ${
              liveDiscrepancy > 0 ? `+${liveDiscrepancy}` : liveDiscrepancy
            } FCFA).`
      )
      router.refresh()
    })
  }

  function downloadCsv(filename: string, rows: string[][]) {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows
        .map((r) =>
          r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')
        )
        .join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handleExportOrdersCsv() {
    const header = [
      'N° Commande',
      'Client',
      'Total Commande (FCFA)',
      'Acompte Boutique Direct (FCFA)',
      'Solde Encaissé Livreur pour Boutique (FCFA)',
      'Frais Course Livreur Séparés (FCFA)',
      'Statut',
      'Date',
    ]
    const rows = orders.map((o) => [
      o.orderNumber,
      o.customerName,
      String(o.totalOrderFcfa),
      String(o.depositShopFcfa),
      String(o.driverCollectedForStoreFcfa),
      String(o.deliveryFeeFcfa),
      o.status,
      o.orderedAt,
    ])
    downloadCsv('commandes-kaba-kaba.csv', [header, ...rows])
  }

  function handleExportSettlementsCsv() {
    const header = [
      'ID Remise',
      'Attendu (FCFA)',
      'Remis (FCFA)',
      'Écart Remis - Attendu (FCFA)',
      'Type',
      'Statut',
      'Date',
    ]
    const rows = settlements.map((s) => [
      s.id,
      String(s.expected_amount_fcfa ?? s.total_cod_fcfa),
      String(s.remitted_amount_fcfa ?? s.net_payout_fcfa),
      String(s.discrepancy_fcfa ?? 0),
      s.is_partial ? 'Remise partielle' : 'Règlement complet',
      s.status,
      s.created_at,
    ])
    downloadCsv('reglements-kaba-kaba.csv', [header, ...rows])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">
            Finances, Acomptes &amp; Rapprochement Exact
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            La dette du livreur ne compte que le solde encaissé pour la boutique
            (hors acomptes boutique et hors frais de course).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportOrdersCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FFFFFF] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] cursor-pointer"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export CSV Commandes</span>
          </button>

          <button
            type="button"
            onClick={handleExportSettlementsCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Règlements</span>
          </button>
        </div>
      </div>

      {/* 4 Cartes KPI Séparation stricte Acomptes Boutique vs Dette Livreur vs Frais Course */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase text-[#64748B]">
            Acomptes payés à la boutique
          </p>
          <p className="text-2xl font-extrabold text-[#0F172A] mt-2 tabular-nums">
            {totalDirectShopDeposits.toLocaleString('fr-FR')} F
          </p>
          <p className="text-[11px] text-[#10B981] font-semibold mt-1">
            Exclus de la dette livreur
          </p>
        </div>

        <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase text-[#64748B]">
            Solde encaissé par livreur (Boutique)
          </p>
          <p className="text-2xl font-extrabold text-[#0F172A] mt-2 tabular-nums">
            {totalDriverCollectedForStore.toLocaleString('fr-FR')} F
          </p>
          <p className="text-[11px] text-[#64748B] mt-1">
            Déjà remis : {totalAlreadyRemitted.toLocaleString('fr-FR')} F
          </p>
        </div>

        <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase text-[#64748B]">
            Dette nette livreur restante
          </p>
          <p className="text-2xl font-extrabold text-[#10B981] mt-2 tabular-nums">
            {remainingDriverDebt.toLocaleString('fr-FR')} F
          </p>
          <p className="text-[11px] text-[#64748B] mt-1">
            À reverser à la boutique
          </p>
        </div>

        <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase text-[#64748B]">
            Frais de course livreurs (Séparés)
          </p>
          <p className="text-2xl font-extrabold text-[#0284C7] mt-2 tabular-nums">
            {totalDeliveryFees.toLocaleString('fr-FR')} F
          </p>
          <p className="text-[11px] text-[#64748B] mt-1">
            Comptabilisés à part
          </p>
        </div>
      </div>

      {/* Formulaire de Remise partielle ou totale (sans écrasement d'historique) */}
      <form
        onSubmit={handleRecordSettlement}
        className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-primary" />
          <span>
            Enregistrer une remise (partielle ou complète) • Calcul d&apos;écart
            automatique
          </span>
        </h2>

        {feedback && (
          <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-2.5 text-xs font-semibold text-[#065F46]">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Attendu (FCFA)
            </label>
            <input
              type="number"
              min={0}
              value={expectedInput}
              onChange={(e) => setExpectedInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A] tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Montant remis (FCFA)
            </label>
            <input
              type="number"
              min={0}
              value={remittedInput}
              onChange={(e) => setRemittedInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A] tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Écart (Remis - Attendu)
            </label>
            <div
              className={`px-3.5 py-2.5 rounded-xl border text-sm font-extrabold tabular-nums ${
                liveDiscrepancy < 0
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
              }`}
            >
              {liveDiscrepancy > 0 ? `+${liveDiscrepancy}` : liveDiscrepancy}{' '}
              FCFA
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Note / Référence
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: 1ère remise T-Money"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer">
            <input
              type="checkbox"
              checked={isPartial}
              onChange={(e) => setIsPartial(e.target.checked)}
              className="rounded border-[#CBD5E1]"
            />
            <span>
              Remise partielle (conserver le solde restant ouvert sans écraser
              l&apos;historique)
            </span>
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white transition cursor-pointer"
          >
            {isPending ? 'Ajout...' : 'Ajouter la remise à l’historique'}
          </button>
        </div>
      </form>

      {/* Historique immuable des remises (Settlements) */}
      <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span>
              Historique complet des Remises &amp; Règlements ({settlements.length})
            </span>
          </h2>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#64748B]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            Historique sans écrasement
          </span>
        </div>

        {settlements.length === 0 ? (
          <p className="text-xs text-[#64748B] py-4">
            Aucune remise enregistrée pour le moment.
          </p>
        ) : (
          <div className="space-y-2.5">
            {settlements.map((s) => {
              const expected = s.expected_amount_fcfa ?? s.total_cod_fcfa
              const remitted = s.remitted_amount_fcfa ?? s.net_payout_fcfa
              const diff = s.discrepancy_fcfa ?? remitted - expected

              return (
                <div
                  key={s.id}
                  className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-[#0F172A]">
                        Remis : {remitted.toLocaleString('fr-FR')} FCFA
                      </p>
                      {s.is_partial && (
                        <span className="badge-status badge-pending">
                          Remise partielle
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Attendu : {expected.toLocaleString('fr-FR')} F • Écart :{' '}
                      <strong
                        className={
                          diff < 0 ? 'text-rose-600' : 'text-[#065F46]'
                        }
                      >
                        {diff > 0 ? `+${diff}` : diff} F
                      </strong>
                      {s.notes ? ` • ${s.notes}` : ''}
                    </p>
                  </div>
                  <span
                    className={`badge-status ${
                      diff < 0 ? 'badge-discrepancy' : 'badge-delivered'
                    }`}
                  >
                    ● {diff < 0 ? `Manquant (${diff} F)` : 'Comptes ronds'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
