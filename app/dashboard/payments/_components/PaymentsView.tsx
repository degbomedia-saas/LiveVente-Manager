'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCourierSettlement } from '@/app/actions/payments'
import { restockReturnedDelivery } from '@/app/actions/deliveries'
import { createSettlementSchema } from '@/lib/validations/payments'
import { Bike, Check, Hourglass, Lock, Package, Phone, RotateCcw, Wallet } from 'lucide-react'

export interface ReturnedDeliveryRow {
  deliveryId: string
  courierName: string
  parcelNumber: string
  clientName: string
  failedReason: string
  items: Array<{ product_name: string; quantity: number }>
  isRestocked: boolean
}

export interface CourierBalanceRow {
  courierId: string
  fullName: string
  phone: string | null
  isActive: boolean
  deliveredCount: number
  assignedCount?: number
  totalCollected: number
  totalDeliveryFees: number
  totalExpected: number
  totalSettled: number
  remainingBalance: number
  overpaidAmount?: number
}

export interface ShopFinancialSummary {
  directShopReceived: number
  totalCourierCollected: number
  totalDeliveryFeesDue: number
  totalCourierExpectedSettlement: number
  totalCourierSettled: number
  remainingCourierSettlement: number
}

export interface SettlementHistoryRow {
  id: string
  courierName: string
  amount: number
  paidAt: string
  notes: string | null
  differenceAmount?: number
  differenceReason?: string | null
}

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function SettlementModal({
  couriers,
  initialCourierId,
  onClose,
  onCreated,
}: {
  couriers: CourierBalanceRow[]
  initialCourierId: string
  onClose: () => void
  onCreated: (
    courierId: string,
    amount: number,
    notes: string,
    differenceAmount: number,
    differenceReason: string | null
  ) => void
}) {
  const initialCourier =
    couriers.find((c) => c.courierId === initialCourierId) ?? couriers[0]
  const [courierId, setCourierId] = useState(initialCourier?.courierId ?? '')
  const selectedCourier = couriers.find((c) => c.courierId === courierId) ?? initialCourier
  const theoreticalDue = Math.max(0, Math.round(selectedCourier?.remainingBalance ?? 0))

  const [amount, setAmount] = useState(String(theoreticalDue))
  const [notes, setNotes] = useState('')
  const [recordDifference, setRecordDifference] = useState(false)
  const [differenceReason, setDifferenceReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Calcul dynamique de l'écart : Montant attendu - Montant versé
  const numericAmount = Math.max(0, Number(amount) || 0)
  const computedDifference = theoreticalDue - numericAmount
  const isExactBalance = numericAmount === theoreticalDue && theoreticalDue > 0
  const isMissingAmount = computedDifference > 0
  const isOverpaidAmount = computedDifference < 0

  const QUICK_DISCREPANCY_REASONS = [
    'Monnaie manquante',
    'Colis reporté / non livré',
    'Avance sur carburant',
    'Litige client / retour',
  ]

  function handleCourierChange(nextId: string) {
    setCourierId(nextId)
    const found = couriers.find((c) => c.courierId === nextId)
    const nextDue = Math.max(0, Math.round(found?.remainingBalance ?? 0))
    setAmount(String(nextDue))
    setRecordDifference(false)
    setDifferenceReason('')
  }

  function handleApplyQuickReason(reason: string) {
    setRecordDifference(true)
    setDifferenceReason(reason)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const diffAmount = recordDifference && isMissingAmount ? computedDifference : 0

    const parsed = createSettlementSchema.safeParse({
      courierId,
      amount,
      differenceAmount: diffAmount,
      differenceReason: diffAmount !== 0 ? differenceReason : undefined,
      notes,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Données invalides.')
      return
    }

    startTransition(async () => {
      const res = await createCourierSettlement(parsed.data)
      if (res.error) {
        setError(res.error)
        return
      }
      onCreated(
        parsed.data.courierId,
        parsed.data.amount,
        parsed.data.notes ?? '',
        diffAmount,
        diffAmount !== 0 ? differenceReason : null
      )
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Rapprochement caisse & Clôture</h2>
            <p className="text-xs text-gray-500">Saisie du versement liquide du livreur</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Livreur concerné <span className="text-red-500">*</span>
            </label>
            <select
              value={courierId}
              onChange={(e) => handleCourierChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
            >
              {couriers.map((c) => (
                <option key={c.courierId} value={c.courierId}>
                  {c.fullName} — Attendu : {formatMoney(c.remainingBalance)}
                </option>
              ))}
            </select>
          </div>

          {/* BILAN GLOBAL EN TEMPS RÉEL (Équation Caisse) */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Montant attendu des livraisons :</span>
              <span className="font-mono font-bold text-white text-sm">
                {formatMoney(theoreticalDue)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-300">Écart calculé (Attendu − Reçu) :</span>
              {isExactBalance ? (
                <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  ✓ Compte exact (0 FCFA)
                </span>
              ) : isMissingAmount ? (
                <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  Manquant : -{formatMoney(computedDifference)}
                </span>
              ) : isOverpaidAmount ? (
                <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-500/30">
                  Trop-perçu : +{formatMoney(Math.abs(computedDifference))}
                </span>
              ) : (
                <span className="font-mono text-xs text-slate-400">0 FCFA</span>
              )}
            </div>
          </div>

          {/* SAISIE DU MONTANT REMIS */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Montant liquide remis par le livreur (FCFA) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setAmount(String(theoreticalDue))
                  setRecordDifference(false)
                  setDifferenceReason('')
                }}
                className="text-xs text-primary font-semibold hover:underline"
              >
                Régler la totalité ({formatMoney(theoreticalDue)})
              </button>
            </div>
            <input
              type="number"
              min={1}
              step={500}
              value={amount}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 45000"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
            />
          </div>

          {/* MOTIFS RAPIDES EN 1 CLIC SI ÉCART CONSTATÉ */}
          {isMissingAmount && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-950">
                  Reliquat de {formatMoney(computedDifference)} à justifier
                </span>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-amber-900 mb-1.5">
                  Motif rapide en 1 clic :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DISCREPANCY_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleApplyQuickReason(reason)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                        differenceReason === reason && recordDifference
                          ? 'bg-amber-700 text-white border-amber-800'
                          : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={recordDifference}
                  onChange={(e) => setRecordDifference(e.target.checked)}
                  className="rounded text-primary focus:ring-primary-ring mt-0.5"
                />
                <span className="text-xs text-amber-900 font-medium leading-tight">
                  Enregistrer formellement cet écart comme reliquat autorisé
                </span>
              </label>

              {recordDifference && (
                <div>
                  <input
                    type="text"
                    value={differenceReason}
                    onChange={(e) => setDifferenceReason(e.target.value)}
                    placeholder="Préciser le motif de l'écart..."
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes de caisse (optionnel)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Espèces comptées au comptoir"
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`flex-1 h-11 px-5 rounded-xl text-white text-sm font-medium shadow-sm transition flex items-center justify-center gap-1.5 ${
                isExactBalance
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-primary hover:bg-primary-hover'
              } disabled:opacity-50`}
            >
              <span>{isExactBalance ? '✓' : ''}</span>
              <span>
                {isPending
                  ? 'Enregistrement...'
                  : isExactBalance
                  ? 'Valider le règlement & Clôturer la journée'
                  : `Valider le versement de ${formatMoney(numericAmount)}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CourierSettlementCard({
  row,
  canManage,
  onSettled,
  onOpenAdvanced,
}: {
  row: CourierBalanceRow
  canManage: boolean
  onSettled: (courierId: string, amount: number) => void
  onOpenAdvanced: (courierId: string) => void
}) {
  const expected = Math.max(0, Math.round(row.remainingBalance))
  const hasDue = expected > 0
  const isOverpaid = (row.overpaidAmount ?? 0) > 0
  const [typed, setTyped] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const amountStr = typed ?? String(expected)
  const numeric = Math.max(0, Number(amountStr) || 0)
  const diff = expected - numeric // > 0 : reliquat, < 0 : trop-perçu
  const isExact = hasDue && diff === 0

  function handleSubmit() {
    setError(null)
    const parsed = createSettlementSchema.safeParse({
      courierId: row.courierId,
      amount: amountStr,
      differenceAmount: 0,
      notes: '',
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Montant invalide.')
      return
    }
    startTransition(async () => {
      const res = await createCourierSettlement(parsed.data)
      if (res.error) {
        setError(res.error)
        return
      }
      setTyped(null)
      onSettled(parsed.data.courierId, parsed.data.amount)
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5 transition-all hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-primary-soft text-primary-soft-text flex items-center justify-center shrink-0">
              <Bike className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900 truncate">{row.fullName}</p>
              {row.phone && (
                <p className="text-sm text-slate-500 inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {row.phone}
                </p>
              )}
            </div>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
          {row.deliveredCount} livré{row.deliveredCount !== 1 ? 's' : ''}
          {row.assignedCount !== undefined ? ` / ${row.assignedCount} confié${row.assignedCount !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {isOverpaid && !hasDue ? 'Crédit livreur' : 'Net attendu en caisse'}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">
            {isOverpaid && !hasDue ? `+${formatMoney(row.overpaidAmount ?? 0)}` : formatMoney(expected)}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 space-y-0.5">
          <p>Gain livreur : <span className="font-medium text-slate-700">{formatMoney(row.totalDeliveryFees)}</span></p>
          <p>Déjà reversé : <span className="font-medium text-slate-700">{formatMoney(row.totalSettled)}</span></p>
        </div>
      </div>

      {canManage && hasDue && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Montant remis par le livreur (FCFA)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step={500}
                value={amountStr}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setTyped(e.target.value)}
                className="w-40 h-11 px-3 rounded-xl border border-slate-300 bg-white text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
              {isExact ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  Compte exact
                </span>
              ) : diff > 0 ? (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  Reliquat : -{formatMoney(diff)}
                </span>
              ) : diff < 0 ? (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-violet-50 text-violet-800 border border-violet-200">
                  Trop-perçu : +{formatMoney(Math.abs(diff))}
                </span>
              ) : null}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpenAdvanced(row.courierId)}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              Écart / motif…
            </button>
            <button
              type="button"
              disabled={isPending || numeric <= 0}
              onClick={handleSubmit}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <Check className="w-4 h-4" strokeWidth={1.75} />
              {isPending ? 'Enregistrement…' : 'Valider le versement'}
            </button>
          </div>
        </div>
      )}

      {!hasDue && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
          {row.totalExpected > 0 || row.totalSettled > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="w-3.5 h-3.5" strokeWidth={2} />
              Compte soldé
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">Aucune course</span>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => onOpenAdvanced(row.courierId)}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              {isOverpaid ? 'Ajuster le trop-perçu' : '+ Ajuster'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function PaymentsView({
  initialBalances,
  initialHistory,
  initialSummary,
  initialReturnedDeliveries = [],
  userRole,
}: {
  initialBalances: CourierBalanceRow[]
  initialHistory: SettlementHistoryRow[]
  initialSummary?: ShopFinancialSummary
  initialReturnedDeliveries?: ReturnedDeliveryRow[]
  userRole: string
}) {
  const router = useRouter()
  const [balances, setBalances] = useState<CourierBalanceRow[]>(initialBalances)
  const [history, setHistory] = useState<SettlementHistoryRow[]>(initialHistory)
  const [returnedDeliveries, setReturnedDeliveries] = useState<ReturnedDeliveryRow[]>(
    initialReturnedDeliveries
  )
  const [restockingId, setRestockingId] = useState<string | null>(null)
  const [modalCourierId, setModalCourierId] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [isClosing, startClosing] = useTransition()

  useEffect(() => {
    setBalances(initialBalances)
  }, [initialBalances])

  useEffect(() => {
    setHistory(initialHistory)
  }, [initialHistory])

  useEffect(() => {
    setReturnedDeliveries(initialReturnedDeliveries)
  }, [initialReturnedDeliveries])

  async function handleRestock(deliveryId: string) {
    setRestockingId(deliveryId)
    const res = await restockReturnedDelivery(deliveryId)
    setRestockingId(null)
    if (res.error) {
      alert(res.error)
      return
    }
    setReturnedDeliveries((prev) =>
      prev.map((r) => (r.deliveryId === deliveryId ? { ...r, isRestocked: true } : r))
    )
    router.refresh()
  }

  const totals = useMemo(() => {
    return balances.reduce(
      (acc, row) => ({
        expected: acc.expected + row.totalExpected,
        settled: acc.settled + row.totalSettled,
        remaining: acc.remaining + row.remainingBalance,
        delivered: acc.delivered + row.deliveredCount,
        fees: acc.fees + row.totalDeliveryFees,
      }),
      { expected: 0, settled: 0, remaining: 0, delivered: 0, fees: 0 }
    )
  }, [balances])

  const canManage = userRole === 'owner'
  const unsettled = balances.filter((b) => Math.round(b.remainingBalance) > 0)
  const visibleBalances = balances.filter(
    (b) => b.isActive || b.totalExpected > 0 || b.totalSettled > 0 || b.remainingBalance > 0
  )
  const directShop = initialSummary?.directShopReceived ?? 0

  function applySettlement(courierId: string, amount: number, notes: string, diffAmount: number, diffReason: string | null) {
    setBalances((prev) =>
      prev.map((row) =>
        row.courierId === courierId
          ? {
              ...row,
              totalSettled: row.totalSettled + amount,
              remainingBalance: Math.max(0, row.totalExpected - (row.totalSettled + amount)),
            }
          : row
      )
    )
    const courierName = balances.find((b) => b.courierId === courierId)?.fullName ?? 'Livreur'
    setHistory((prev) => [
      {
        id: `${Date.now()}-${courierId}`,
        courierName,
        amount,
        paidAt: new Date().toISOString(),
        notes: notes || null,
        differenceAmount: diffAmount,
        differenceReason: diffReason,
      },
      ...prev,
    ])
    router.refresh()
  }

  function handleCloseDay() {
    setCloseError(null)
    startClosing(async () => {
      for (const row of unsettled) {
        const amount = Math.round(row.remainingBalance)
        const parsed = createSettlementSchema.safeParse({
          courierId: row.courierId,
          amount: String(amount),
          differenceAmount: 0,
          notes: 'Clôture de caisse du jour',
        })
        if (!parsed.success) {
          setCloseError(parsed.error.issues[0]?.message ?? 'Données invalides.')
          return
        }
        const res = await createCourierSettlement(parsed.data)
        if (res.error) {
          setCloseError(`${row.fullName} : ${res.error}`)
          return
        }
        applySettlement(row.courierId, parsed.data.amount, parsed.data.notes ?? '', 0, null)
      }
      setShowCloseConfirm(false)
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Caisse &amp; Rapprochement</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Montant attendu = encaissé par le livreur − frais de livraison (gain livreur)
          </p>
        </div>
        {canManage && unsettled.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCloseConfirm(true)}
            className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm transition inline-flex items-center gap-2"
          >
            <Lock className="w-4 h-4" strokeWidth={1.75} />
            Clôturer la caisse du jour
          </button>
        )}
      </div>

      {showCloseConfirm && (
        <div className="mb-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-base font-semibold text-slate-900">Confirmer la clôture de la caisse ?</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Un versement égal au montant attendu sera enregistré pour chaque livreur ci-dessous (
                <span className="font-semibold text-slate-700">{formatMoney(totals.remaining)}</span> au total).
              </p>
            </div>
          </div>
          <ul className="divide-y divide-slate-100 text-sm rounded-xl border border-slate-100">
            {unsettled.map((r) => (
              <li key={r.courierId} className="px-3 py-2 flex items-center justify-between">
                <span className="text-slate-700 font-medium">{r.fullName}</span>
                <span className="font-semibold text-slate-900">{formatMoney(r.remainingBalance)}</span>
              </li>
            ))}
          </ul>
          {closeError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{closeError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isClosing}
              onClick={() => {
                setShowCloseConfirm(false)
                setCloseError(null)
              }}
              className="h-11 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isClosing}
              onClick={handleCloseDay}
              className="h-11 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium shadow-sm transition disabled:opacity-50"
            >
              {isClosing ? 'Clôture en cours…' : 'Confirmer la clôture'}
            </button>
          </div>
        </div>
      )}

      {/* KPI financiers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Wallet className="w-4 h-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wider">Total encaissé</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatMoney(directShop + totals.settled)}</p>
          <p className="text-xs text-slate-500 mt-1">
            Espèces reçues en caisse (comptoir {formatMoney(directShop)} + versements {formatMoney(totals.settled)})
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Bike className="w-4 h-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wider">Courses livrées</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totals.delivered}</p>
          <p className="text-xs text-slate-500 mt-1">Commissions livreurs : {formatMoney(totals.fees)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Hourglass className="w-4 h-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wider">En circulation</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatMoney(totals.remaining)}</p>
          <p className="text-xs text-slate-500 mt-1">Encore entre les mains des livreurs</p>
        </div>
      </div>

      {totals.remaining === 0 && totals.expected > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
          <Check className="w-5 h-5 shrink-0" strokeWidth={2} />
          <div>
            <p className="font-semibold text-sm">Toutes les caisses livreurs sont soldées</p>
            <p className="text-xs text-emerald-800">
              L&apos;intégralité des versements attendus ({formatMoney(totals.settled)}) a été encaissée.
            </p>
          </div>
        </div>
      )}

      {visibleBalances.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-12 text-center">
          <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-3" strokeWidth={1.75} />
          <p className="text-slate-900 font-semibold">Aucun livreur enregistré</p>
          <p className="text-sm text-slate-500 mt-1">Créez des livreurs pour suivre leurs encaissements.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {visibleBalances.map((row) => (
            <CourierSettlementCard
              key={row.courierId}
              row={row}
              canManage={canManage}
              onSettled={(courierId, amount) => applySettlement(courierId, amount, '', 0, null)}
              onOpenAdvanced={setModalCourierId}
            />
          ))}
        </div>
      )}

      {returnedDeliveries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5 mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Colis retournés à la boutique ({returnedDeliveries.filter((r) => !r.isRestocked).length} à traiter)
              </h2>
              <p className="text-xs text-slate-500">
                Colis en échec ou reportés ramenés par les livreurs
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {returnedDeliveries.map((ret) => (
              <div
                key={ret.deliveryId}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <Package className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Colis {ret.parcelNumber}</span>
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{ret.clientName}</span>
                    <span className="text-xs text-slate-500">• Livreur : {ret.courierName}</span>
                  </div>
                  <p className="text-xs text-rose-700 font-medium">Motif : {ret.failedReason}</p>
                  {ret.items.length > 0 && (
                    <p className="text-xs text-slate-600">
                      Articles : {ret.items.map((it) => `${it.quantity}× ${it.product_name}`).join(', ')}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  {ret.isRestocked ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>Retourné et classé</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={restockingId === ret.deliveryId}
                      onClick={() => handleRestock(ret.deliveryId)}
                      className="h-9 px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>
                        {restockingId === ret.deliveryId ? 'Réintégration...' : 'Réintégrer au stock'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Historique des reversements</h2>
          <div className="divide-y divide-slate-100 text-sm">
            {history.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{item.courierName}</p>
                    {item.differenceAmount !== undefined && item.differenceAmount > 0 && (
                      <span
                        className="inline-flex items-center text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                        title={item.differenceReason ? `Motif : ${item.differenceReason}` : 'Écart enregistré'}
                      >
                        Écart : -{formatMoney(item.differenceAmount)}
                        {item.differenceReason && ` (${item.differenceReason})`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(item.paidAt).toLocaleDateString('fr-FR')}
                    {item.notes ? ` • ${item.notes}` : ''}
                  </p>
                </div>
                <span className="font-semibold text-slate-900">{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalCourierId && (
        <SettlementModal
          couriers={balances}
          initialCourierId={modalCourierId}
          onClose={() => setModalCourierId(null)}
          onCreated={(courierId, amount, notes, diffAmount, diffReason) =>
            applySettlement(courierId, amount, notes, diffAmount, diffReason)
          }
        />
      )}
    </>
  )
}
