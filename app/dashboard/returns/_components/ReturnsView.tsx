'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, PackagePlus, RotateCcw } from 'lucide-react'
import { createOrderReturn, updateReturnStatus } from '@/app/actions/step4'

export interface ReturnOrderOption {
  id: string
  orderNumber: string
  customerName: string
}

export interface ReturnRowItem {
  id: string
  order_id: string
  orderNumber: string
  customerName: string
  reason: string
  status:
    | 'requested'
    | 'approved'
    | 'in_transit'
    | 'received'
    | 'restocked'
    | 'settled'
  created_at: string
}

export function ReturnsView({
  initialReturns,
  orders,
}: {
  initialReturns: ReturnRowItem[]
  orders: ReturnOrderOption[]
}) {
  const router = useRouter()
  const [returnsList, setReturnsList] = useState<ReturnRowItem[]>(initialReturns)
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreateReturn(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOrderId || !reason.trim()) return
    setFeedback(null)

    startTransition(async () => {
      const res = await createOrderReturn({
        orderId: selectedOrderId,
        reason,
      })

      const ord = orders.find((o) => o.id === selectedOrderId)
      setReturnsList((prev) => [
        {
          id: `local-${Date.now()}`,
          order_id: selectedOrderId,
          orderNumber: ord?.orderNumber || '#KK',
          customerName: ord?.customerName || 'Client(e)',
          reason,
          status: 'requested',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
      setReason('')
      setFeedback(
        'error' in res && res.error
          ? res.error
          : 'Demande de retour enregistrée.'
      )
      router.refresh()
    })
  }

  function handleAdvanceStatus(
    ret: ReturnRowItem,
    nextStatus: ReturnRowItem['status']
  ) {
    setFeedback(null)
    startTransition(async () => {
      await updateReturnStatus({
        returnId: ret.id,
        orderId: ret.order_id,
        nextStatus,
      })
      setReturnsList((prev) =>
        prev.map((r) => (r.id === ret.id ? { ...r, status: nextStatus } : r))
      )
      if (nextStatus === 'restocked') {
        setFeedback(
          `Colis ${ret.orderNumber} remis en stock automatiquement !`
        )
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0F172A]">
          Retours Colis &amp; Remise en Stock Auto
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Gérez les retours clients et réintégrez automatiquement les articles
          dans votre stock à la confirmation.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-xs sm:text-sm font-semibold text-[#065F46]">
          {feedback}
        </div>
      )}

      {/* Formulaire de déclaration de retour */}
      <form
        onSubmit={handleCreateReturn}
        className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 space-y-4"
      >
        <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-primary" />
          <span>Enregistrer un retour colis</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {o.customerName}
              </option>
            ))}
          </select>

          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (ex: Taille trop petite, cliente absente)"
            className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || orders.length === 0}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white transition cursor-pointer disabled:opacity-50"
          >
            Créer le dossier de retour
          </button>
        </div>
      </form>

      {/* Cartes des retours */}
      {returnsList.length === 0 ? (
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-10 text-center text-sm text-[#64748B]">
          Aucun retour en cours.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {returnsList.map((ret) => (
            <div
              key={ret.id}
              className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-extrabold text-[#0F172A]">
                  {ret.orderNumber} • {ret.customerName}
                </span>
                <span
                  className={`badge-status ${
                    ret.status === 'restocked' || ret.status === 'settled'
                      ? 'badge-delivered'
                      : 'badge-pending'
                  }`}
                >
                  ● {ret.status}
                </span>
              </div>

              <p className="text-xs text-[#64748B]">Motif : {ret.reason}</p>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E2E8F0]">
                {ret.status !== 'restocked' && ret.status !== 'settled' && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAdvanceStatus(ret, 'restocked')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#10B981] text-white cursor-pointer"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Confirmer réception &amp; Remettre en stock</span>
                  </button>
                )}

                {ret.status === 'restocked' && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAdvanceStatus(ret, 'settled')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0F172A] text-white cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Clôturer dossier</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
