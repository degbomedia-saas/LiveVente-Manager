'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  Mic,
  Plus,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { saveVoiceOrder } from '@/app/actions/voice-order'
import type {
  ParsedVoiceOrderItem,
  ParsedVoiceOrderResult,
} from '@/app/api/orders/parse-voice/route'

const MAX_AUDIO_SECONDS = 30
const MAX_AUDIO_BYTES = 2 * 1024 * 1024 // 2 Mo

function formatDuration(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function VoiceDictationFab({
  defaultOpen = false,
  inlineMode = false,
}: {
  defaultOpen?: boolean
  inlineMode?: boolean
}) {
  const router = useRouter()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [modeTab, setModeTab] = useState<'audio' | 'whatsapp'>('audio')
  const [whatsappRawText, setWhatsappRawText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(defaultOpen || inlineMode)
  const [quotaReachedMsg, setQuotaReachedMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Champs pré-remplis éditables
  const [transcript, setTranscript] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [zoneName, setZoneName] = useState('')
  const [deliveryFee, setDeliveryFee] = useState(1000)
  const [addressNote, setAddressNote] = useState('')
  const [paymentMethod, setPaymentMethod] =
    useState<ParsedVoiceOrderResult['payment_method']>('cash')
  const [items, setItems] = useState<ParsedVoiceOrderItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const elapsedSecRef = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const liveMissingFields: string[] = []
  if (!customerName.trim()) liveMissingFields.push('Nom cliente')
  if (!phone.trim()) liveMissingFields.push('Téléphone')
  if (!zoneName.trim()) liveMissingFields.push('Quartier / Zone')

  async function startRecording() {
    setError(null)
    setToast(null)
    setQuotaReachedMsg(null)
    setModeTab('audio')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size > MAX_AUDIO_BYTES) {
          setDrawerOpen(true)
          setError(
            'Enregistrement bloqué : le fichier audio dépasse 2 Mo (max 30 secondes).'
          )
          return
        }
        await sendToGroq({
          audioBlob: blob,
          durationSec: elapsedSecRef.current,
        })
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setElapsedSec(0)
      elapsedSecRef.current = 0
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          const next = prev + 1
          elapsedSecRef.current = next
          if (next >= MAX_AUDIO_SECONDS) {
            if (
              mediaRecorderRef.current &&
              mediaRecorderRef.current.state !== 'inactive'
            ) {
              mediaRecorderRef.current.stop()
            }
            setIsRecording(false)
            setToast('Limite de 30 secondes atteinte — analyse en cours...')
          }
          return next
        })
      }, 1000)
    } catch {
      setError(
        'Accès au microphone refusé. Autorisez le micro ou utilisez l’onglet « Coller un message WhatsApp 📋 ».'
      )
      setDrawerOpen(true)
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  async function sendToGroq(payload: {
    audioBlob?: Blob
    durationSec?: number
    rawText?: string
  }) {
    if (payload.audioBlob && payload.audioBlob.size > MAX_AUDIO_BYTES) {
      setDrawerOpen(true)
      setError(
        'Enregistrement bloqué : l’audio dépasse la limite de 2 Mo (30 secondes max).'
      )
      return
    }
    if ((payload.durationSec ?? 0) > MAX_AUDIO_SECONDS) {
      setDrawerOpen(true)
      setError('Enregistrement bloqué : durée maximale de 30 secondes dépassée.')
      return
    }

    setIsAnalyzing(true)
    setDrawerOpen(true)
    setError(null)
    setQuotaReachedMsg(null)

    try {
      const formData = new FormData()
      if (payload.audioBlob) {
        formData.append('audio', payload.audioBlob, 'dictation.webm')
        formData.append(
          'duration_sec',
          String(Math.min(MAX_AUDIO_SECONDS, payload.durationSec ?? elapsedSec))
        )
      }
      if (payload.rawText) {
        formData.append('raw_text', payload.rawText)
      }

      const res = await fetch('/api/orders/parse-voice', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        if (data.quotaReached) {
          setQuotaReachedMsg(data.error)
        } else {
          setError(data.error || 'Impossible d’analyser la commande.')
        }
        setIsAnalyzing(false)
        return
      }

      const parsed = data as ParsedVoiceOrderResult
      setTranscript(parsed.transcript)
      setCustomerName(parsed.customer_name)
      setPhone(parsed.phone)
      setZoneName(parsed.zone_name)
      setDeliveryFee(parsed.delivery_fee_fcfa || 1000)
      setAddressNote(parsed.address_note)
      setPaymentMethod(parsed.payment_method)
      setItems(parsed.items)
    } catch {
      setError('Erreur réseau lors de l’analyse Groq.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleValidateOrder(chainNext: boolean) {
    if (isSubmitting || isPending || isAnalyzing) return
    setIsSubmitting(true)
    setError(null)
    setQuotaReachedMsg(null)
    startTransition(async () => {
      try {
        const res = await saveVoiceOrder({
          customer_name: customerName,
          phone,
          zone_name: zoneName,
          delivery_fee_fcfa: deliveryFee,
          address_note: addressNote,
          payment_method: paymentMethod,
          source: modeTab === 'whatsapp' ? 'whatsapp' : 'tiktok',
          items:
            items.length > 0
              ? items
              : [
                  {
                    product_id: null,
                    product_name: 'Article Live TikTok',
                    quantity: 1,
                    unit_price_fcfa: 10000,
                  },
                ],
        })

        if ('error' in res && res.error) {
          if ('quotaReached' in res && res.quotaReached) {
            setQuotaReachedMsg(res.error)
          } else {
            setError(res.error)
          }
          return
        }

        router.refresh()

        if (chainNext) {
          setToast(
            `Commande ${res.parcelNumber} enregistrée${
              res.isMissingInfo ? ' (Infos manquantes)' : ''
            } ! Prêt pour la suivante.`
          )
          setCustomerName('')
          setPhone('')
          setZoneName('')
          setAddressNote('')
          setTranscript('')
          setWhatsappRawText('')
          if (modeTab === 'audio' && !inlineMode) {
            setDrawerOpen(false)
            setTimeout(() => {
              startRecording()
            }, 250)
          }
        } else if (!inlineMode) {
          setDrawerOpen(false)
        }
      } finally {
        setIsSubmitting(false)
      }
    })
  }

  const totalCod =
    items.reduce((s, it) => s + it.quantity * it.unit_price_fcfa, 0) +
    (Number(deliveryFee) || 0)

  const contentPanel = (
    <div
      className={
        inlineMode
          ? 'bg-[#FFFFFF] w-full rounded-3xl border border-[#E2E8F0] p-5 sm:p-6 space-y-4 shadow-xs'
          : 'bg-[#FFFFFF] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#E2E8F0] p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl'
      }
    >
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
            ⚡ Prise de Commande Express IA (Groq)
          </h3>
          <p className="text-xs text-[#64748B]">
            Dictée vocale Live TikTok ou collage de message WhatsApp
          </p>
        </div>
        {!inlineMode && (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Deux onglets rapides : Dicter (Audio) 🎙️ | Coller un message WhatsApp 📋 */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setModeTab('audio')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            modeTab === 'audio'
              ? 'bg-[#10B981] text-white shadow-2xs'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Dicter (Audio) 🎙️</span>
        </button>

        <button
          type="button"
          onClick={() => setModeTab('whatsapp')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            modeTab === 'whatsapp'
              ? 'bg-[#10B981] text-white shadow-2xs'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Coller WhatsApp 📋</span>
        </button>
      </div>

      {/* Bandeau d'upgrade Mobile Money dès qu'un quota gratuit est atteint */}
      {quotaReachedMsg && (
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 space-y-2.5">
          <div className="flex items-start gap-2 text-xs text-amber-950">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="font-bold">{quotaReachedMsg}</p>
          </div>
          <a
            href="https://wa.me/22890000000?text=Bonjour%20Kaba%20Kaba%2C%20je%20souhaite%20activer%20le%20forfait%20Pro%20(10%20000%20F)%20via%20T-Money%20%2F%20Flooz."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-xs font-extrabold bg-[#0F172A] text-white"
          >
            Passer en Pro via T-Money / Flooz (10 000 F/mois)
          </a>
        </div>
      )}

      {/* Zone de capture selon l'onglet actif */}
      {modeTab === 'audio' ? (
        <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-bold text-[#0F172A]">
              {isRecording
                ? `Enregistrement en cours (${formatDuration(elapsedSec)} / 00:30)...`
                : 'Dictez la commande à voix haute (max 30s / 2 Mo)'}
            </p>
            <p className="text-[#64748B] mt-0.5">
              Ex : &laquo; Afiwa 90 12 34 56 à Tokoin face pharmacie, 2 robes
              wax par T-Money &raquo;
            </p>
          </div>

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#10B981] text-white text-xs font-extrabold shrink-0 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Parler</span>
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 space-y-2.5">
          <textarea
            rows={3}
            value={whatsappRawText}
            onChange={(e) => setWhatsappRawText(e.target.value)}
            placeholder="Collez ici le message WhatsApp de la cliente (ex: Bonjour c'est Afiwa au 90 12 34 56, je prends 2 robes wax, livraison à Agoè pharmacie...)"
            className="w-full px-3 py-2 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#10B981]"
          />
          <button
            type="button"
            disabled={isAnalyzing || !whatsappRawText.trim()}
            onClick={() => sendToGroq({ rawText: whatsappRawText })}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold bg-[#0F172A] hover:bg-[#1E293B] text-white disabled:opacity-50 transition cursor-pointer"
          >
            ✨ Extraire la commande avec Groq IA
          </button>
        </div>
      )}

      {isAnalyzing ? (
        <div className="py-8 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#10B981] animate-spin mx-auto" />
          <p className="text-sm font-bold text-[#0F172A]">
            Analyse IA Groq (openai/gpt-oss-20b) en cours...
          </p>
        </div>
      ) : (
        <>
          {transcript && (
            <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-xs text-[#64748B]">
              <strong className="text-[#0F172A]">Texte analysé :</strong>{' '}
              &laquo; {transcript} &raquo;
            </div>
          )}

          {liveMissingFields.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Drapeau automatique : is_missing_info = true
                </p>
                <p>
                  Champs manquants :{' '}
                  <strong>{liveMissingFields.join(', ')}</strong>
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Nom cliente
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Afiwa"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Téléphone WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+228 90 00 00 00"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Quartier / Zone Lomé
              </label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Tokoin, Agoè..."
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Frais livraison (F)
              </label>
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Paiement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as ParsedVoiceOrderResult['payment_method']
                  )
                }
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
              >
                <option value="cash">Espèces (COD)</option>
                <option value="tmoney">T-Money</option>
                <option value="flooz">Flooz</option>
                <option value="online">En ligne</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Repère d&apos;adresse (address_note)
            </label>
            <input
              type="text"
              value={addressNote}
              onChange={(e) => setAddressNote(e.target.value)}
              placeholder="Ex: Face pharmacie Nation"
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]"
            />
          </div>

          {/* Articles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A]">
                Articles ({items.length}) • Total COD :{' '}
                <strong className="text-[#10B981]">
                  {totalCod.toLocaleString('fr-FR')} F
                </strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      product_id: null,
                      product_name: '',
                      quantity: 1,
                      unit_price_fcfa: 10000,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-primary cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>

            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={it.product_name}
                  onChange={(e) => {
                    const val = e.target.value
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, product_name: val } : row
                      )
                    )
                  }}
                  placeholder="Article"
                  className="col-span-6 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A]"
                />
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1)
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, quantity: val } : row
                      )
                    )
                  }}
                  className="col-span-2 px-2 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#0F172A]"
                />
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={it.unit_price_fcfa}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0)
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, unit_price_fcfa: val } : row
                      )
                    )
                  }}
                  className="col-span-3 px-2 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#0F172A]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="col-span-1 text-rose-600 flex justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              disabled={isPending || isSubmitting}
              onClick={() => handleValidateOrder(true)}
              className="flex-1 py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold bg-[#10B981] hover:bg-[#059669] text-white shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mic className="w-4 h-4" />
              <span>
                {isPending || isSubmitting
                  ? 'Enregistrement...'
                  : 'Valider et enchaîner ⚡'}
              </span>
            </button>

            <button
              type="button"
              disabled={isPending || isSubmitting}
              onClick={() => handleValidateOrder(false)}
              className="py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold bg-[#0F172A] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isSubmitting ? 'Patientez...' : 'Valider'}
            </button>
          </div>
        </>
      )}
    </div>
  )

  if (inlineMode) {
    return contentPanel
  }

  return (
    <>
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-2">
        {toast && !isRecording && (
          <div className="rounded-2xl bg-[#0F172A] text-white px-3.5 py-2 text-xs font-bold shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{toast}</span>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-3 rounded-full bg-rose-600 text-white pl-4 pr-2 py-2 shadow-xl border-2 border-white">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
            <span className="text-xs font-extrabold font-mono tabular-nums">
              🎙️ {formatDuration(elapsedSec)}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-rose-700 text-xs font-extrabold cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-rose-700" />
              <span>Stop</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            title="Mode Dictée Vocale & Collage WhatsApp (Groq)"
            className="inline-flex items-center gap-2 px-4 py-3.5 rounded-full bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-xs sm:text-sm shadow-[0_8px_28px_rgba(16,185,129,0.45)] border-2 border-white transition cursor-pointer"
          >
            <Mic className="w-5 h-5" />
            <span>🎙️ Dictée / WhatsApp</span>
          </button>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          {contentPanel}
        </div>
      )}
    </>
  )
}
