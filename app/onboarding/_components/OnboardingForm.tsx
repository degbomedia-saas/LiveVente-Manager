'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Check,
  MapPin,
  Palette,
  Phone,
  Sparkles,
  Store,
  Trash2,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { completeSellerOnboarding } from '@/app/actions/onboarding'
import { DEFAULT_LOME_ZONES, LOME_QUARTIERS } from '@/lib/config/lome-zones'
import {
  compressImageForUpload,
  compressImageToDataUrl,
  validateImageFile,
} from '@/lib/utils/compress-image'
import { KabaKabaLogo } from '@/components/ui/KabaKabaLogo'
import type { StorePaletteKey } from '@/types/database.types'

export const STORE_PALETTES: Array<{
  id: StorePaletteKey
  label: string
  desc: string
  hex: string
  softBg: string
  border: string
}> = [
  {
    id: 'emerald',
    label: 'Émeraude',
    desc: 'Fintech & fraîcheur (#10B981)',
    hex: '#10B981',
    softBg: 'bg-[#ECFDF5]',
    border: 'border-[#A7F3D0]',
  },
  {
    id: 'sky',
    label: 'Bleu Ciel',
    desc: 'Logistique & clarté (#0284C7)',
    hex: '#0284C7',
    softBg: 'bg-[#F0F9FF]',
    border: 'border-[#BAE6FD]',
  },
  {
    id: 'coral',
    label: 'Corail',
    desc: 'Mode & chaleur (#F97316)',
    hex: '#F97316',
    softBg: 'bg-[#FFF7ED]',
    border: 'border-[#FED7AA]',
  },
  {
    id: 'violet',
    label: 'Violet',
    desc: 'Créateur & premium (#7C3AED)',
    hex: '#7C3AED',
    softBg: 'bg-[#F5F3FF]',
    border: 'border-[#DDD6FE]',
  },
]

async function compressLogoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Image invalide'))
      img.onload = () => {
        const maxDim = 256
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/webp', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function OnboardingForm({
  initialStoreName = '',
  initialPhone = '',
  initialCity = 'Lomé',
  userId,
}: {
  initialStoreName?: string
  initialPhone?: string
  initialCity?: string
  userId: string
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [storeName, setStoreName] = useState(initialStoreName)
  const [whatsappPhone, setWhatsappPhone] = useState(
    initialPhone || '+228 '
  )
  const [city, setCity] = useState(initialCity || 'Lomé — Déckon')
  const [paletteKey, setPaletteKey] = useState<StorePaletteKey>('emerald')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelectPalette(key: StorePaletteKey) {
    setPaletteKey(key)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', key)
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return
    const check = validateImageFile(file)
    if (!check.valid) {
      setError(check.error)
      return
    }
    setUploading(true)
    setError(null)
    try {
      // Compression côté client (Canvas HTML5, max 1000px, qualité JPEG 0.75) avant envoi Supabase Storage
      const compressedFile = await compressImageForUpload(file, 1000, 0.75)
      const supabase = createClient()
      const path = `stores/${userId}/logo-${Date.now()}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('store-assets')
        .upload(path, compressedFile, {
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (!uploadErr) {
        const { data: pub } = supabase.storage
          .from('store-assets')
          .getPublicUrl(path)
        if (pub?.publicUrl) {
          setLogoUrl(pub.publicUrl)
          setUploading(false)
          return
        }
      }
      const dataUrl = await compressImageToDataUrl(file, 1000, 0.75)
      setLogoUrl(dataUrl)
    } catch {
      setError('Impossible de charger ce logo.')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const rawDigits = whatsappPhone.replace(/\D/g, '')
    const localDigits =
      rawDigits.startsWith('228') && rawDigits.length > 8
        ? rawDigits.slice(3)
        : rawDigits === '228'
          ? ''
          : rawDigits

    if (localDigits.length < 8) {
      setError(
        'Le numéro WhatsApp (+228) est obligatoire : saisissez au moins 8 chiffres (ex : +228 90 12 34 56).'
      )
      return
    }

    const formattedWhatsapp = rawDigits.startsWith('228')
      ? `+${rawDigits.slice(0, 3)} ${rawDigits.slice(3)}`
      : `+228 ${localDigits}`

    startTransition(async () => {
      const res = await completeSellerOnboarding({
        storeName,
        whatsappPhone: formattedWhatsapp,
        city,
        paletteKey,
        logoUrl,
      })

      if ('error' in res && res.error) {
        setError(res.error)
        return
      }

      router.push('/dashboard')
      router.refresh()
    })
  }

  const activePalette =
    STORE_PALETTES.find((p) => p.id === paletteKey) ?? STORE_PALETTES[0]

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <KabaKabaLogo light className="h-8 w-auto" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
            <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
            Configuration rapide • 1 min
          </span>
        </div>

        <div className="bg-[#FFFFFF] rounded-3xl border border-[#E2E8F0] shadow-xs p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-[#0F172A]">
            Configurez votre boutique
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Personnalisez votre espace vendeur. Vos 5 zones de livraison pour
            Lomé seront créées automatiquement.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Nom de la boutique */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                Nom de la boutique *
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex : Élégance Wax Lomé"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            {/* WhatsApp (+228) & Ville/Quartier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  WhatsApp (+228) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="+228 90 12 34 56"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#10B981]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  Ville / Quartier *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    list="lome-quartiers-onboarding"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Lomé — Tokoin / Déckon"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#10B981]"
                  />
                  <datalist id="lome-quartiers-onboarding">
                    {LOME_QUARTIERS.map((q) => (
                      <option key={q} value={q} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Choix visuel parmi 4 palettes */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                <Palette className="w-3.5 h-3.5" />
                <span>Couleur de votre boutique (4 palettes)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {STORE_PALETTES.map((p) => {
                  const selected = paletteKey === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPalette(p.id)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                        selected
                          ? 'bg-[#FFFFFF] border-[#0F172A] ring-2 ring-[#0F172A]/10 shadow-xs'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="h-6 w-6 rounded-full border border-black/10"
                          style={{ backgroundColor: p.hex }}
                        />
                        {selected && (
                          <Check className="w-4 h-4 text-[#0F172A]" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#0F172A]">
                        {p.label}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Upload optionnel du logo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                Logo de la boutique (optionnel)
              </label>
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Aperçu logo"
                    className="h-12 w-12 rounded-xl object-cover border border-[#E2E8F0] bg-[#FFFFFF]"
                  />
                ) : (
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
                    style={{ backgroundColor: activePalette.hex }}
                  >
                    {(storeName.trim()[0] || 'K').toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoChange(e.target.files?.[0])}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FFFFFF] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploading ? 'Chargement...' : 'Choisir une image'}
                      </span>
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl(null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Retirer</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    PNG, JPG ou WebP • Stocké sur Supabase Storage
                  </p>
                </div>
              </div>
            </div>

            {/* Aperçu des 5 zones de livraison Lomé créées automatiquement */}
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-2">
              <p className="text-xs font-bold text-[#0F172A]">
                5 zones de livraison Lomé pré-configurées :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_LOME_ZONES.map((z) => (
                  <span
                    key={z.zone_name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs font-medium text-[#0F172A]"
                  >
                    <span>{z.zone_name}</span>
                    <span className="text-[#10B981] font-bold">
                      {z.fee_fcfa} F
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || uploading}
              style={{ backgroundColor: activePalette.hex }}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
            >
              <span>
                {isPending
                  ? 'Création de votre boutique...'
                  : 'Lancer ma boutique et mes 5 zones Lomé'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
