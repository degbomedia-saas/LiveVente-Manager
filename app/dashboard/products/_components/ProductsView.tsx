'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Copy,
  Globe,
  Package,
  Plus,
  Radio,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react'
import {
  createProduct,
  updateProduct,
  toggleProductActive,
  toggleProductShowInLive,
} from '@/app/actions/products'
import { productSchema } from '@/lib/validations/products'

export interface ProductRow {
  id: string
  name: string
  base_price: number
  price_fcfa?: number | null
  sku?: string | null
  category?: string | null
  stock_qty?: number | null
  low_stock_threshold?: number | null
  image_url?: string | null
  show_in_live?: boolean | null
  available_sizes: string[]
  available_colors: string[]
  is_active?: boolean
  created_at: string
}

export interface ProductTemplateItem {
  id: string
  name: string
  default_category: string
  default_variants?: {
    sizes?: string[]
    colors?: string[]
  } | null
}

const DEFAULT_TEMPLATES: ProductTemplateItem[] = [
  {
    id: 'tpl-wax',
    name: 'Robe Wax / Prêt-à-porter',
    default_category: 'Vêtements',
    default_variants: {
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Multicolore', 'Émeraude', 'Or'],
    },
  },
  {
    id: 'tpl-bazin',
    name: 'Ensemble Bazin / Boubou',
    default_category: 'Tenues Traditionnelles',
    default_variants: {
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Blanc', 'Bleu Roi', 'Bordeaux'],
    },
  },
  {
    id: 'tpl-bag',
    name: 'Sac à Main / Maroquinerie',
    default_category: 'Accessoires',
    default_variants: {
      sizes: ['Unique'],
      colors: ['Noir', 'Camel', 'Beige'],
    },
  },
  {
    id: 'tpl-shoes',
    name: 'Sandales / Chaussures',
    default_category: 'Chaussures',
    default_variants: {
      sizes: ['37', '38', '39', '40', '41', '42'],
      colors: ['Noir', 'Doré', 'Nude'],
    },
  },
]

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

type Lang = 'fr' | 'en'

function ProductModal({
  editingProduct,
  templates,
  lang,
  onClose,
  onSaved,
}: {
  editingProduct: ProductRow | null
  templates: ProductTemplateItem[]
  lang: Lang
  onClose: () => void
  onSaved: (product: ProductRow, isEdit: boolean) => void
}) {
  const [name, setName] = useState(editingProduct?.name ?? '')
  const [basePrice, setBasePrice] = useState(
    editingProduct
      ? String(
          Math.round(editingProduct.price_fcfa ?? editingProduct.base_price)
        )
      : '0'
  )
  const [sku, setSku] = useState(editingProduct?.sku ?? '')
  const [category, setCategory] = useState(
    editingProduct?.category ?? 'Vêtements'
  )
  const [stockQty, setStockQty] = useState(
    String(editingProduct?.stock_qty ?? 10)
  )
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(editingProduct?.low_stock_threshold ?? 3)
  )
  const [sizesInput, setSizesInput] = useState(
    editingProduct?.available_sizes.join(', ') ?? ''
  )
  const [colorsInput, setColorsInput] = useState(
    editingProduct?.available_colors.join(', ') ?? ''
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function applyTemplate(tpl: ProductTemplateItem) {
    setName(tpl.name)
    setCategory(tpl.default_category)
    setSizesInput((tpl.default_variants?.sizes ?? []).join(', '))
    setColorsInput((tpl.default_variants?.colors ?? []).join(', '))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    const parsed = productSchema.safeParse({
      name,
      basePrice,
      sku,
      category,
      stockQty,
      lowStockThreshold,
      sizesInput,
      colorsInput,
    })

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) nextErrors[err.path[0] as string] = err.message
      })
      setErrors(nextErrors)
      return
    }

    startTransition(async () => {
      if (editingProduct) {
        const res = await updateProduct({
          id: editingProduct.id,
          ...parsed.data,
        })
        if (res.error) {
          if (res.field) setErrors({ [res.field]: res.error })
          else setServerError(res.error)
          return
        }
        if (res.product) onSaved(res.product as ProductRow, true)
      } else {
        const res = await createProduct(parsed.data)
        if (res.error) {
          if (res.field) setErrors({ [res.field]: res.error })
          else setServerError(res.error)
          return
        }
        if (res.product) onSaved(res.product as ProductRow, false)
      }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative w-full sm:max-w-lg bg-[#FFFFFF] sm:rounded-3xl rounded-t-3xl shadow-2xl z-10 overflow-hidden border border-[#E2E8F0] max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-lg font-extrabold text-[#0F172A]">
            {editingProduct
              ? lang === 'fr'
                ? 'Modifier le produit'
                : 'Edit Product'
              : lang === 'fr'
              ? 'Nouveau produit'
              : 'New Product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] text-sm font-bold px-2 py-1 rounded-lg hover:bg-[#F8FAFC]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!editingProduct && (
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 space-y-2">
              <p className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>
                  {lang === 'fr'
                    ? 'Création rapide depuis un Produit Type :'
                    : 'Quick fill from a Product Template:'}
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FFFFFF] border border-[#E2E8F0] hover:border-primary text-[#0F172A] transition cursor-pointer"
                  >
                    + {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {serverError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {lang === 'fr' ? 'Nom de l’article *' : 'Product Name *'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Robe Wax Royale"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] focus:outline-none focus:border-primary"
                required
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                SKU / Code
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="WAX-01"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {lang === 'fr' ? 'Prix de vente (FCFA) *' : 'Price (FCFA) *'}
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] tabular-nums focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {lang === 'fr' ? 'Catégorie' : 'Category'}
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Vêtements, Accessoires..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Stocks & Seuil d'alerte */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {lang === 'fr' ? 'Quantité en stock' : 'Stock Qty'}
              </label>
              <input
                type="number"
                min={0}
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] tabular-nums focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {lang === 'fr'
                  ? 'Seuil alerte stock faible'
                  : 'Low stock threshold'}
              </label>
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] tabular-nums focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {lang === 'fr' ? 'Tailles (séparées par virgule)' : 'Sizes'}
              </label>
              <input
                type="text"
                value={sizesInput}
                onChange={(e) => setSizesInput(e.target.value)}
                placeholder="S, M, L, XL"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {lang === 'fr' ? 'Couleurs (séparées par virgule)' : 'Colors'}
              </label>
              <input
                type="text"
                value={colorsInput}
                onChange={(e) => setColorsInput(e.target.value)}
                placeholder="Noir, Blanc, Rouge"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-[#FFFFFF] text-sm text-[#0F172A] focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
            >
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-xl transition cursor-pointer"
            >
              {isPending
                ? lang === 'fr'
                  ? 'Enregistrement...'
                  : 'Saving...'
                : editingProduct
                ? lang === 'fr'
                  ? 'Mettre à jour'
                  : 'Update'
                : lang === 'fr'
                ? 'Ajouter au catalogue'
                : 'Add to catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProductsView({
  initialProducts,
  initialTemplates = [],
  userRole,
  storeSlug = 'live',
}: {
  initialProducts: ProductRow[]
  initialTemplates?: ProductTemplateItem[]
  userRole?: string
  storeSlug?: string
}) {
  const router = useRouter()
  const [products, setProducts] = useState<ProductRow[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [lang, setLang] = useState<Lang>('fr')
  const [showArchived, setShowArchived] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [copiedLiveLink, setCopiedLiveLink] = useState(false)
  const [isToggling, startToggleTransition] = useTransition()

  function handleCopyLiveLink() {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://kaba-kaba.vercel.app'
    const url = `${origin}/live/${storeSlug}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url)
      setCopiedLiveLink(true)
      setTimeout(() => setCopiedLiveLink(false), 2200)
    }
  }

  function handleToggleLive(product: ProductRow) {
    const nextLive = !(product.show_in_live ?? true)
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, show_in_live: nextLive } : p
      )
    )
    startToggleTransition(async () => {
      await toggleProductShowInLive(product.id, nextLive)
    })
  }

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  const templates =
    initialTemplates.length > 0 ? initialTemplates : DEFAULT_TEMPLATES

  const activeProducts = useMemo(
    () => products.filter((p) => p.is_active !== false),
    [products]
  )

  const lowStockProducts = useMemo(
    () =>
      activeProducts.filter(
        (p) => (p.stock_qty ?? 10) <= (p.low_stock_threshold ?? 3)
      ),
    [activeProducts]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const isActive = p.is_active !== false
      if (!showArchived && !isActive) return false
      if (showArchived && isActive) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q)
      )
    })
  }, [products, search, showArchived])

  function handleSaved(saved: ProductRow, isEdit: boolean) {
    setProducts((prev) =>
      isEdit ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
    )
    router.refresh()
  }

  function handleToggleArchive(product: ProductRow) {
    const nextActive = product.is_active === false
    startToggleTransition(async () => {
      const res = await toggleProductActive(product.id, nextActive)
      if (!res.error) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, is_active: nextActive } : p
          )
        )
        router.refresh()
      }
    })
  }

  function renderStockBadge(p: ProductRow) {
    const qty = p.stock_qty ?? 10
    const threshold = p.low_stock_threshold ?? 3

    if (qty <= 0) {
      return (
        <span className="badge-status badge-discrepancy">
          ● {lang === 'fr' ? 'Rupture (0)' : 'Out of stock (0)'}
        </span>
      )
    }

    if (qty <= threshold) {
      return (
        <span className="badge-status badge-pending">
          ● {lang === 'fr' ? `Stock faible (${qty})` : `Low stock (${qty})`}
        </span>
      )
    }

    return (
      <span className="badge-status badge-delivered">
        ● {lang === 'fr' ? `En stock (${qty})` : `In stock (${qty})`}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      {/* Bannière d'alerte de réassort automatique */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold">
                {lang === 'fr'
                  ? `Alerte réassort : ${lowStockProducts.length} article(s) en stock faible ou rupture`
                  : `Restock alert: ${lowStockProducts.length} item(s) low or out of stock`}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {lowStockProducts
                  .slice(0, 4)
                  .map((p) => `${p.name} (${p.stock_qty ?? 0})`)
                  .join(' • ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* En-tête + Switcher FR/EN + Bouton Nouveau produit */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">
            {lang === 'fr' ? 'Catalogue & Stocks' : 'Catalog & Inventory'}
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            {lang === 'fr'
              ? `${activeProducts.length} produits actifs • Décrémentation auto à la confirmation`
              : `${activeProducts.length} active products • Auto stock deduction on confirm`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-0.5 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-[#64748B] ml-2 mr-1" />
            <button
              type="button"
              onClick={() => setLang('fr')}
              className={`px-2 py-1 rounded-lg cursor-pointer ${
                lang === 'fr'
                  ? 'bg-primary text-white'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded-lg cursor-pointer ${
                lang === 'en'
                  ? 'bg-primary text-white'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyLiveLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#FFFFFF] border border-[#E2E8F0] hover:border-primary text-[#0F172A] shadow-2xs transition cursor-pointer"
          >
            {copiedLiveLink ? (
              <>
                <Check className="w-4 h-4 text-[#10B981]" />
                <span>
                  {lang === 'fr' ? 'Lien Live copié !' : 'Live link copied!'}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-primary" />
                <span>
                  {lang === 'fr' ? 'Copier mon lien Live' : 'Copy Live link'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Nouveau produit' : 'New Product'}</span>
          </button>
        </div>
      </div>

      {/* Barre de création rapide par Produit Type */}
      <div className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>
            {lang === 'fr' ? 'Produits Types rapides :' : 'Quick Templates:'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                setEditingProduct({
                  id: '',
                  name: tpl.name,
                  base_price: 10000,
                  price_fcfa: 10000,
                  category: tpl.default_category,
                  stock_qty: 10,
                  low_stock_threshold: 3,
                  available_sizes: tpl.default_variants?.sizes ?? [],
                  available_colors: tpl.default_variants?.colors ?? [],
                  created_at: new Date().toISOString(),
                })
                setModalOpen(true)
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F8FAFC] hover:bg-primary-soft border border-[#E2E8F0] text-[#0F172A] transition cursor-pointer"
            >
              + {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres & Recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-1 w-fit">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              !showArchived
                ? 'bg-primary text-white'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {lang === 'fr' ? 'Catalogue actif' : 'Active'}
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              showArchived
                ? 'bg-primary text-white'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {lang === 'fr' ? 'Archivés' : 'Archived'}
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'fr'
                ? 'Rechercher article, catégorie, SKU...'
                : 'Search product, category, SKU...'
            }
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] text-sm text-[#0F172A] focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Grille de cartes Mobile-First */}
      {filtered.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-3xl border border-[#E2E8F0] p-12 text-center space-y-2">
          <Package className="w-8 h-8 text-[#64748B] mx-auto" />
          <p className="text-sm font-bold text-[#0F172A]">
            {lang === 'fr' ? 'Aucun produit trouvé' : 'No products found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                      <Tag className="w-3 h-3 text-primary" />
                      <span>{p.category || 'Mode'}</span>
                      {p.sku && (
                        <span className="font-mono text-[#0F172A]">
                          • {p.sku}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-[#0F172A] mt-0.5">
                      {p.name}
                    </h3>
                  </div>
                  {renderStockBadge(p)}
                </div>

                <p className="text-xl font-extrabold text-primary tabular-nums">
                  {formatMoney(p.price_fcfa ?? p.base_price)}
                </p>

                <div className="space-y-1.5 text-xs">
                  {p.available_sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.available_sizes.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] font-semibold text-[#0F172A]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.available_colors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.available_colors.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-md bg-primary-soft text-primary-soft-text font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle Afficher dans le Live du jour */}
              <label className="mt-2 pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs font-bold text-[#0F172A] cursor-pointer">
                <span className="inline-flex items-center gap-1.5">
                  <Radio
                    className={`w-3.5 h-3.5 ${
                      p.show_in_live ?? true
                        ? 'text-[#10B981]'
                        : 'text-[#64748B]'
                    }`}
                  />
                  <span>
                    {lang === 'fr'
                      ? 'Afficher dans le Live du jour'
                      : 'Show in Today’s Live'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={p.show_in_live ?? true}
                  onChange={() => handleToggleLive(p)}
                  className="rounded border-[#CBD5E1] accent-[#10B981]"
                />
              </label>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(p)
                    setModalOpen(true)
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#F8FAFC] hover:bg-primary-soft text-[#0F172A] border border-[#E2E8F0] transition cursor-pointer"
                >
                  {lang === 'fr' ? 'Modifier / Stock' : 'Edit / Stock'}
                </button>

                {(userRole === 'owner' ||
                  userRole === 'seller' ||
                  userRole === 'super_admin' ||
                  userRole === 'admin') && (
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleArchive(p)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition cursor-pointer"
                  >
                    {p.is_active === false
                      ? lang === 'fr'
                        ? 'Réactiver'
                        : 'Restore'
                      : lang === 'fr'
                      ? 'Archiver'
                      : 'Archive'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ProductModal
          editingProduct={editingProduct && editingProduct.id ? editingProduct : null}
          templates={templates}
          lang={lang}
          onClose={() => {
            setModalOpen(false)
            setEditingProduct(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
