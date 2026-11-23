'use client'

import { useState } from 'react'
import { Check, Copy, MessageCircle, Wallet, X } from 'lucide-react'
import { formatLomeDateFr } from '@/lib/utils/lome-time'

export interface DailyCashSummaryProps {
  isOpen: boolean
  onClose: () => void
  companyName: string
  totalSalesCount: number
  totalSalesRevenueFcfa: number
  directShopCollectedFcfa: number
  expectedFromCouriersFcfa: number
  settledByCouriersFcfa: number
  discrepancyFcfa: number
}

export function DailyCashSummaryModal({
  isOpen,
  onClose,
  companyName,
  totalSalesCount,
  totalSalesRevenueFcfa,
  directShopCollectedFcfa,
  expectedFromCouriersFcfa,
  settledByCouriersFcfa,
  discrepancyFcfa,
}: DailyCashSummaryProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const todayStr = formatLomeDateFr(new Date())

  const summaryText = `📊 *BILAN DE CAISSE DU JOUR — ${companyName}* (${todayStr})
• Total ventes : *${Math.round(totalSalesRevenueFcfa).toLocaleString('fr-FR')} FCFA* (${totalSalesCount} cmd)
• Encaissé direct boutique (T-Money/Flooz/Cash) : *${Math.round(directShopCollectedFcfa).toLocaleString('fr-FR')} FCFA*
• Attendu livreurs (COD net) : *${Math.round(expectedFromCouriersFcfa).toLocaleString('fr-FR')} FCFA*
• Remis par livreurs : *${Math.round(settledByCouriersFcfa).toLocaleString('fr-FR')} FCFA*
• Écart du jour : *${discrepancyFcfa > 0 ? `+${Math.round(discrepancyFcfa)}` : Math.round(discrepancyFcfa)} FCFA*`

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    summaryText
  )}`

  function handleCopy() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(summaryText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#E2E8F0] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
                Bilan de caisse du jour
              </h3>
              <p className="text-xs text-[#64748B]">
                {companyName} • {todayStr}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#64748B]">
                Total Ventes ({totalSalesCount} commandes)
              </p>
              <p className="text-xl font-extrabold text-[#0F172A] tabular-nums mt-0.5">
                {Math.round(totalSalesRevenueFcfa).toLocaleString('fr-FR')} FCFA
              </p>
            </div>
            <span className="badge-status badge-delivered">CA du jour</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-3.5">
              <p className="text-xs font-bold text-[#64748B]">
                Encaissé direct boutique
              </p>
              <p className="text-base font-extrabold text-[#10B981] tabular-nums mt-1">
                {Math.round(directShopCollectedFcfa).toLocaleString('fr-FR')} F
              </p>
              <p className="text-[11px] text-[#64748B]">
                T-Money / Flooz / Espèces
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-3.5">
              <p className="text-xs font-bold text-[#64748B]">
                Attendu livreurs (COD net)
              </p>
              <p className="text-base font-extrabold text-[#0284C7] tabular-nums mt-1">
                {Math.round(expectedFromCouriersFcfa).toLocaleString('fr-FR')} F
              </p>
              <p className="text-[11px] text-[#64748B]">
                Remis : {Math.round(settledByCouriersFcfa).toLocaleString('fr-FR')} F
              </p>
            </div>
          </div>

          <div
            className={`rounded-2xl border p-3.5 flex items-center justify-between ${
              discrepancyFcfa < 0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
            }`}
          >
            <span className="text-xs font-bold">
              Écart de caisse livreurs (Remis - Attendu)
            </span>
            <span className="text-base font-extrabold tabular-nums">
              {discrepancyFcfa > 0
                ? `+${Math.round(discrepancyFcfa).toLocaleString('fr-FR')}`
                : Math.round(discrepancyFcfa).toLocaleString('fr-FR')}{' '}
              FCFA
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-[#F8FAFC] hover:bg-[#E2E8F0]/50 border border-[#E2E8F0] text-[#0F172A] cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#10B981]" />
                <span>Bilan copié !</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copier le bilan</span>
              </>
            )}
          </button>

          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-white"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Partager sur WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  )
}
