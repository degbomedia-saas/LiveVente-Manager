'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct, toggleProductActive } from '@/app/actions/products'
import { productSchema } from '@/lib/validations/products'

export interface ProductRow {
  id: string
  name: string
  base_price: number
  available_sizes: string[]
  available_colors: string[]
  is_active?: boolean
  created_at: string
}

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function ProductModal({
  editingProduct,
  onClose,
  onSaved,
}: {
  editingProduct: ProductRow | null
  onClose: () => void
  onSaved: (product: ProductRow, isEdit: boolean) => void
}) {
  const [name, setName] = useState(editingProduct?.name ?? '')
  const [basePrice, setBasePrice] = useState(
    editingProduct ? String(Math.round(editingProduct.base_price)) : '0'
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    const parsed = productSchema.safeParse({
      name,
      basePrice,
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
        const res = await updateProduct({ id: editingProduct.id, ...parsed.data })
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du produit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Robe en satin"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix de base (FCFA) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step={500}
              value={basePrice}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="Ex: 5000"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.basePrice && <p className="text-red-600 text-xs mt-1">{errors.basePrice}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tailles disponibles (séparées par des virgules)
            </label>
            <input
              type="text"
              value={sizesInput}
              onChange={(e) => setSizesInput(e.target.value)}
              placeholder="Ex: S, M, L, XL"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.sizesInput && <p className="text-red-600 text-xs mt-1">{errors.sizesInput}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Couleurs disponibles (séparées par des virgules)
            </label>
            <input
              type="text"
              value={colorsInput}
              onChange={(e) => setColorsInput(e.target.value)}
              placeholder="Ex: Rouge, Bleu, Noir"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.colorsInput && <p className="text-red-600 text-xs mt-1">{errors.colorsInput}</p>}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">
              {serverError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold"
            >
              {isPending ? 'Enregistrement...' : editingProduct ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProductsView({
  initialProducts,
  userRole,
}: {
  initialProducts: ProductRow[]
  userRole: string
}) {
  const router = useRouter()
  const [products, setProducts] = useState<ProductRow[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const canManage = userRole === 'owner' || userRole === 'employee'

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue Produits</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {products.length} produit{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingProduct(null)
              setModalOpen(true)
            }}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-blue-800 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
          >
            <span className="text-lg leading-none">+</span> Ajouter un produit
          </button>
        )}
      </div>

      {products.length > 0 && (
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
          />
        </div>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-white rounded-2xl border border-gray-100">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">🏷️</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Aucun produit dans votre catalogue
          </h3>
          <p className="text-gray-500 text-sm max-w-xs mb-6">
            Ajoutez vos produits pour accélérer la création des commandes.
          </p>
          {canManage && (
            <button
              onClick={() => {
                setEditingProduct(null)
                setModalOpen(true)
              }}
              className="px-6 py-3 bg-blue-800 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
            >
              + Ajouter un produit
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-3">
                  <p className={`font-bold truncate ${product.is_active === false ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {product.name}
                  </p>
                  <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg ${
                    product.is_active === false ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-800'
                  }`}>
                    {formatMoney(product.base_price)}
                  </span>
                  {product.is_active === false && (
                    <span className="text-[11px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                      Archivé
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {product.available_sizes.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      Taille: {s}
                    </span>
                  ))}
                  {product.available_colors.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded bg-primary-soft text-primary-soft-text">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditingProduct(product)
                      setModalOpen(true)
                    }}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={async () => {
                      const nextState = product.is_active === false
                      const confirmMsg = nextState
                        ? `Réactiver le produit "${product.name}" ?`
                        : `Archiver le produit "${product.name}" ? Il ne sera plus proposé pour les nouvelles commandes.`
                      if (!confirm(confirmMsg)) return
                      const res = await toggleProductActive(product.id, nextState)
                      if (res.error) {
                        alert(res.error)
                      } else {
                        setProducts((prev) =>
                          prev.map((p) => (p.id === product.id ? { ...p, is_active: nextState } : p))
                        )
                        router.refresh()
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                      product.is_active === false
                        ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title={product.is_active === false ? 'Réactiver le produit' : 'Archiver le produit'}
                  >
                    {product.is_active === false ? '♻️ Réactiver' : '📦 Archiver'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <button
          onClick={() => {
            setEditingProduct(null)
            setModalOpen(true)
          }}
          className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition z-20"
          title="Ajouter un produit"
        >
          +
        </button>
      )}

      {modalOpen && (
        <ProductModal
          editingProduct={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={(saved, isEdit) => {
            if (isEdit) {
              setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
            } else {
              setProducts((prev) => [saved, ...prev])
            }
            router.refresh()
          }}
        />
      )}
    </>
  )
}
