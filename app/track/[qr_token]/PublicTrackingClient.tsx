'use client'

import { useState, useTransition } from 'react'
import { Award, CheckCircle2, PackageCheck, Star, Truck } from 'lucide-react'
import { confirmPublicDeliveryAndRate } from '@/app/actions/step4'

export interface PublicTrackingData {
  token: string
  orderNumber: string
  status: string
  totalAmount: number
  storeName: string
  storeLogoUrl: string | null
  paletteHex: string
  customerName: string
  loyaltyPoints: number
  loyaltyThreshold: number
  alreadyConfirmed: boolean
}

export function PublicTrackingClient({
  data,
}: {
  data: PublicTrackingData
}) {
  const [rating, setRating] = useState(5)
  const [confirmed, setConfirmed] = useState(
    data.alreadyConfirmed || data.status === 'delivered'
  )
  const [points, setPoints] = useState(data.loyaltyPoints)
  const [isPending, startTransition] = useTransition()

  const threshold = data.loyaltyThreshold || 5
  const progressPct = Math.min(100, Math.round((points / threshold) * 100))

  function handleConfirm() {
    startTransition(async () => {
      const res = await confirmPublicDeliveryAndRate({
        token: data.token,
        rating,
      })
      setConfirmed(true)
      if ('loyaltyPoints' in res && typeof res.loyaltyPoints === 'number') {
        setPoints(res.loyaltyPoints)
      } else {
        setPoints((prev) => prev + 1)
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-8 px-4">
      <div className="max-w-md mx-auto space-y-5">
        {/* Bandeau boutique */}
        <div
          className="rounded-3xl p-5 text-white shadow-sm flex items-center justify-between"
          style={{ backgroundColor: data.paletteHex }}
        >
          <div className="flex items-center gap-3">
            {data.storeLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.storeLogoUrl}
                alt={data.storeName}
                className="h-10 w-10 rounded-xl object-cover bg-white p-0.5"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center font-extrabold">
                {(data.storeName[0] || 'K').toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-extrabold">{data.storeName}</h1>
              <p className="text-xs opacity-90">Suivi Colis Direct • Lomé</p>
            </div>
          </div>

          <span className="font-mono text-sm font-extrabold bg-white/20 px-2.5 py-1 rounded-lg">
            {data.orderNumber}
          </span>
        </div>

        {/* Statut du colis */}
        <div className="rounded-3xl bg-[#FFFFFF] border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[#64748B]">
                Destinataire
              </p>
              <p className="text-base font-extrabold text-[#0F172A]">
                {data.customerName}
              </p>
            </div>
            <span
              className={`badge-status ${
                confirmed ? 'badge-delivered' : 'badge-en-route'
              }`}
            >
              ● {confirmed ? 'Livré & Confirmé' : 'En cours de livraison'}
            </span>
          </div>

          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B]">
              Montant commande
            </span>
            <span className="text-lg font-extrabold text-[#0F172A] tabular-nums">
              {data.totalAmount.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          {/* Barre de progression fidélité */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 text-[#0F172A]">
                <Award className="w-4 h-4" style={{ color: data.paletteHex }} />
                Programme Fidélité Boutique
              </span>
              <span style={{ color: data.paletteHex }}>
                {points} / {threshold} vers une remise
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: data.paletteHex,
                }}
              />
            </div>
          </div>

          {/* Bouton Confirmer la réception & Noter le livreur */}
          {confirmed ? (
            <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-4 text-center space-y-1">
              <CheckCircle2 className="w-7 h-7 text-[#10B981] mx-auto" />
              <p className="text-sm font-extrabold text-[#065F46]">
                Réception confirmée ! (+1 point fidélité)
              </p>
              <p className="text-xs text-[#065F46]">
                Merci pour votre note de {rating}/5 au livreur.
              </p>
            </div>
          ) : (
            <div className="pt-2 space-y-3 border-t border-[#E2E8F0]">
              <p className="text-xs font-bold text-center text-[#0F172A]">
                Notez votre livreur (1 à 5 étoiles) :
              </p>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1.5 rounded-lg hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-[#CBD5E1]'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                style={{ backgroundColor: data.paletteHex }}
                className="w-full py-3.5 px-5 rounded-2xl text-sm font-bold text-white shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>
                  {isPending
                    ? 'Confirmation...'
                    : 'Confirmer la réception & Noter le livreur'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
