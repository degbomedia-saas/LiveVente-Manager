'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Trash2, Check, Sparkles, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateBrandingSettings } from '@/app/actions/settings'
import type { ThemePalette } from '@/lib/supabase/ensure-profile'

const PALETTES: Array<{
  id: ThemePalette
  title: string
  subtitle: string
  swatchPrimary: string
  swatchSoft: string
}> = [
  {
    id: 'indigo',
    title: 'Indigo Moderne',
    subtitle: 'Par défaut : Indigo-600, Slate épuré',
    swatchPrimary: 'bg-indigo-600',
    swatchSoft: 'bg-indigo-50 border-indigo-200',
  },
  {
    id: 'emerald',
    title: 'Émeraude Wax',
    subtitle: 'Vert chic, accents forêt & émeraude',
    swatchPrimary: 'bg-emerald-600',
    swatchSoft: 'bg-emerald-50 border-emerald-200',
  },
  {
    id: 'terracotta',
    title: 'Terracotta / Ocre',
    subtitle: 'Ambre chaleureux, teintes africaines élégantes',
    swatchPrimary: 'bg-orange-700',
    swatchSoft: 'bg-orange-50 border-orange-200',
  },
]

async function compressLogoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Format image invalide'))
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

export default function BrandingSettingsForm({
  companyId,
  initialName,
  initialLogoUrl,
  initialPalette,
}: {
  companyId: string
  initialName: string
  initialLogoUrl: string | null
  initialPalette: ThemePalette
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initialName)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [themePalette, setThemePalette] = useState<ThemePalette>(initialPalette)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelectPalette(next: ThemePalette) {
    setThemePalette(next)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next)
      document.querySelectorAll('[data-theme]').forEach((el) => {
        el.setAttribute('data-theme', next)
      })
    }
  }

  async function handleLogoFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setStatusMessage({
        type: 'error',
        text: 'Format non supporté. Utilisez PNG, JPG ou WebP.',
      })
      return
    }

    setStatusMessage(null)
    setUploadingLogo(true)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${companyId}/logo-${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('store-assets')
        .upload(path, file, { upsert: true })

      if (!uploadErr) {
        const { data: pub } = supabase.storage.from('store-assets').getPublicUrl(path)
        if (pub?.publicUrl) {
          setLogoUrl(pub.publicUrl)
          setUploadingLogo(false)
          return
        }
      }

      // Repli transparent en Data URL compressée si le bucket store-assets n'est pas encore créé
      const dataUrl = await compressLogoToDataUrl(file)
      setLogoUrl(dataUrl)
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Impossible de charger le logo.',
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatusMessage(null)

    startTransition(async () => {
      const res = await updateBrandingSettings({
        name,
        logoUrl,
        themePalette,
      })

      if (res.error) {
        setStatusMessage({ type: 'error', text: res.error })
        return
      }

      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', themePalette)
        document.title = name.trim()
      }

      setStatusMessage({
        type: 'success',
        text: 'Identité et palette enregistrées ! Le thème a été mis à jour.',
      })
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary-soft-text flex items-center justify-center shrink-0">
          <Palette className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Identité &amp; Marque</h2>
          <p className="text-xs text-slate-500">
            Personnalisez le nom commercial, le logo et les couleurs de votre boutique.
          </p>
        </div>
      </div>

      {/* Nom commercial */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
          Nom commercial de la boutique <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Élégance Wax Lomé"
          className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Zone de téléversement de logo */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Logo de la boutique (PNG, JPG, WebP)
        </label>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Aperçu */}
          <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo boutique" className="w-full h-full object-cover" />
            ) : (
              <Sparkles className="w-7 h-7 text-slate-300" strokeWidth={1.75} />
            )}
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) handleLogoFile(dropped)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 w-full rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition text-center sm:text-left ${
              isDragging
                ? 'border-[var(--primary)] bg-primary-soft'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const chosen = e.target.files?.[0]
                if (chosen) handleLogoFile(chosen)
              }}
            />
            <div className="flex items-center justify-center sm:justify-start gap-2.5 text-sm font-medium text-slate-700">
              <Upload className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
              <span>
                {uploadingLogo
                  ? 'Chargement du logo...'
                  : 'Glissez votre logo ici ou cliquez pour choisir'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Affiché dans le header, la connexion et vos reçus.
            </p>
          </div>

          {logoUrl && (
            <button
              type="button"
              onClick={() => setLogoUrl(null)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 transition inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Retirer</span>
            </button>
          )}
        </div>
      </div>

      {/* Sélecteur de Palettes de Couleurs Préconstruites */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2.5">
          Palette de couleurs de l&apos;application
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PALETTES.map((p) => {
            const isSelected = themePalette === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPalette(p.id)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'ring-2 ring-[var(--primary)] border-transparent bg-white shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg ${p.swatchPrimary} shadow-xs`} />
                    <span className={`w-6 h-6 rounded-lg border ${p.swatchSoft}`} />
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                      <Check className="w-3 h-3" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.subtitle}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-sm border font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button
          type="submit"
          disabled={isPending || uploadingLogo}
          className="bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl h-11 px-6 shadow-sm transition disabled:opacity-50"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  )
}
