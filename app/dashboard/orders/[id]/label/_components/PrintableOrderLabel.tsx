'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  MapPin,
  Phone,
  Printer,
  QrCode,
} from 'lucide-react'
import { markOrderPackedByScan } from '@/app/actions/step4'

export interface PrintableOrderLabelProps {
  orderId: string
  orderNumber: string
  qrToken: string
  barcodeValue: string
  status: string
  totalCodFcfa: number
  deliveryFeeFcfa: number
  customerName: string
  customerPhone: string
  customerAddress: string
  itemsSummary: string[]
  storeName: string
  storeLogoUrl: string | null
  paletteHex: string
}

export function PrintableOrderLabel({
  orderId,
  orderNumber,
  qrToken,
  barcodeValue,
  status,
  totalCodFcfa,
  deliveryFeeFcfa,
  customerName,
  customerPhone,
  customerAddress,
  itemsSummary,
  storeName,
  storeLogoUrl,
  paletteHex,
}: PrintableOrderLabelProps) {
  const router = useRouter()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [packedSuccess, setPackedSuccess] = useState(status === 'packed')
  const [isPending, startTransition] = useTransition()

  function handleConfirmScan() {
    startTransition(async () => {
      await markOrderPackedByScan(orderId)
      setPackedSuccess(true)
      setScannerOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-6 px-4 print:bg-white print:p-0">
      {/* Barre d'actions (masquée à l'impression @media print) */}
      <div className="max-w-md mx-auto mb-5 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Commandes</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] cursor-pointer"
          >
            <Camera className="w-4 h-4 text-[#10B981]" />
            <span>
              {packedSuccess ? 'Emballage validé ✓' : 'Scan caméra emballage'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={{ backgroundColor: paletteHex }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer l&apos;étiquette</span>
          </button>
        </div>
      </div>

      {/* Étiquette Colis Imprimable (@media print) */}
      <div className="max-w-md mx-auto bg-[#FFFFFF] rounded-2xl border-2 border-[#0F172A] p-5 shadow-sm print:shadow-none print:rounded-none print:max-w-full">
        {/* Bandeau Boutique aux couleurs de la palette du vendeur */}
        <div
          className="rounded-xl p-3.5 text-white flex items-center justify-between gap-3"
          style={{ backgroundColor: paletteHex }}
        >
          <div className="flex items-center gap-2.5">
            {storeLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeLogoUrl}
                alt={storeName}
                className="h-9 w-9 rounded-lg object-cover bg-white p-0.5"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center font-extrabold text-sm">
                {(storeName[0] || 'K').toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-extrabold leading-tight">
                {storeName}
              </p>
              <p className="text-[10px] opacity-90">
                BON DE LIVRAISON • LOMÉ (+228)
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-lg font-extrabold font-mono">
              {orderNumber}
            </span>
          </div>
        </div>

        {/* Destinataire */}
        <div className="mt-4 py-3 border-b border-dashed border-[#CBD5E1] space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            Destinataire / Client(e)
          </p>
          <p className="text-base font-extrabold text-[#0F172A]">
            {customerName}
          </p>
          <p className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <span>{customerPhone}</span>
          </p>
          <p className="text-xs text-[#0F172A] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{customerAddress || 'Lomé'}</span>
          </p>
        </div>

        {/* Contenu du colis & COD */}
        <div className="py-3 border-b border-dashed border-[#CBD5E1] space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            Articles ({itemsSummary.length})
          </p>
          <ul className="text-xs font-semibold text-[#0F172A] space-y-1">
            {itemsSummary.map((item, idx) => (
              <li key={idx}>• {item}</li>
            ))}
          </ul>

          <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#64748B]">
                Frais course : {deliveryFeeFcfa.toLocaleString('fr-FR')} F
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                MONTANT À ENCAISSER (COD)
              </span>
              <span className="text-lg font-extrabold text-[#0F172A] tabular-nums">
                {totalCodFcfa.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        </div>

        {/* Code-barres SVG + QR Code de suivi /track/[qr_token] */}
        <div className="pt-4 flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            {/* Code-barres vectoriel sans plugin */}
            <svg
              viewBox="0 0 200 44"
              className="w-full h-11 bg-white"
              aria-label={`Barcode ${barcodeValue}`}
            >
              {[
                4, 10, 14, 22, 26, 34, 40, 44, 52, 58, 62, 70, 76, 82, 86, 94,
                100, 106, 114, 118, 126, 132, 136, 144, 150, 156, 164, 170, 174,
                182, 188,
              ].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={2}
                  width={i % 3 === 0 ? 4 : 2}
                  height={38}
                  fill="#0F172A"
                />
              ))}
            </svg>
            <p className="text-[10px] font-mono font-bold text-center text-[#0F172A]">
              {barcodeValue}
            </p>
          </div>

          <Link
            href={`/track/${qrToken}`}
            className="flex flex-col items-center p-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] shrink-0"
            title="Page de suivi public QR"
          >
            <QrCode className="w-14 h-14 text-[#0F172A]" />
            <span className="text-[9px] font-mono font-bold text-[#64748B] mt-0.5">
              /track/{qrToken.slice(0, 8)}
            </span>
          </Link>
        </div>
      </div>

      {/* Modale Scan Caméra Mobile pour valider l'emballage */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:hidden">
          <div className="bg-[#FFFFFF] rounded-3xl border border-[#E2E8F0] max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="h-14 w-14 rounded-2xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mx-auto">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-extrabold text-[#0F172A]">
              Scan Caméra • Validation Emballage
            </h3>
            <p className="text-xs text-[#64748B]">
              Code détecté :{' '}
              <strong className="font-mono text-[#0F172A]">
                {barcodeValue}
              </strong>
              . Confirmez que le colis est emballé et prêt pour le livreur.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmScan}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#10B981] text-white cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Valider colis prêt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
