'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Tag,
  Bike,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Store,
  Phone,
  MapPin,
  RotateCcw,
} from 'lucide-react'
import { updateCompanySettings } from '@/app/actions/settings'
import { resetOperationalDataForTest } from '@/app/actions/reset'
import { companySettingsSchema } from '@/lib/validations/settings'
import { toWhatsAppUrl } from '@/lib/validations/orders'
import type { ThemePalette } from '@/lib/supabase/ensure-profile'
import BrandingSettingsForm from './BrandingSettingsForm'

export interface CompanySettingsData {
  id: string
  name: string
  slug: string
  country: string
  currency: string
  phone: string | null
  city: string | null
  address: string | null
  logo_url?: string | null
  theme_palette?: ThemePalette | null
}

export interface CourierSummaryItem {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface ProductSummaryItem {
  id: string
  name: string
  base_price: number
  available_sizes: string[]
  available_colors: string[]
  is_active: boolean
  created_at: string
}

export interface CustomerSummaryItem {
  id: string
  full_name: string
  phone: string
  city: string | null
  address: string | null
  created_at: string
}

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

export default function SettingsView({
  company,
  userName,
  userEmail,
  couriers,
  products,
  customers,
}: {
  company: CompanySettingsData
  userName: string
  userEmail: string
  couriers: CourierSummaryItem[]
  products: ProductSummaryItem[]
  customers: CustomerSummaryItem[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'couriers' | 'catalog' | 'customers' | 'shop'>('shop')

  // Formulaire boutique essentiel
  const [name, setName] = useState(company.name)
  const [phone, setPhone] = useState(company.phone ?? '')
  const [currency] = useState(company.currency || 'XOF')
  const [city, setCity] = useState(company.city ?? '')
  const [address, setAddress] = useState(company.address ?? '')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isResetting, startResetting] = useTransition()

  // Recherche clientes
  const [customerSearch, setCustomerSearch] = useState('')

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 8)
    const q = customerSearch.toLowerCase().trim()
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (c.city && c.city.toLowerCase().includes(q))
    )
  }, [customers, customerSearch])

  function handleShopSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const payload = {
      name,
      phone,
      currency,
      city,
      address,
    }

    const parsed = companySettingsSchema.safeParse(payload)
    if (!parsed.success) {
      setMessage({ type: 'error', text: parsed.error.issues[0].message })
      return
    }

    startTransition(async () => {
      const res = await updateCompanySettings(parsed.data)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: 'Coordonnées de la boutique enregistrées avec succès !' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* En-tête principal */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          ⚙️ Gestion & Configuration
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Les 3 piliers essentiels de votre boutique : Livreurs, Articles et Clientes.
        </p>
      </div>

      {/* Navigation par onglets des 3 blocs épurés */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/60 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('couriers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === 'couriers'
              ? 'bg-white text-teal-900 shadow-xs border border-teal-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <Bike className="w-4 h-4 text-teal-600" />
          <span>1. Flotte de Livreurs ({couriers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === 'catalog'
              ? 'bg-white text-primary-soft-text shadow-xs border border-primary-border'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <Tag className="w-4 h-4 text-primary" />
          <span>2. Catalogue Express ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === 'customers'
              ? 'bg-white text-blue-900 shadow-xs border border-blue-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>3. Répertoire Clientes ({customers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shop')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === 'shop'
              ? 'bg-white text-gray-900 shadow-xs border border-gray-300'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <Store className="w-4 h-4 text-gray-500" />
          <span>Infos Boutique</span>
        </button>
      </div>

      {/* BLOC 1 : FLOTTE DE LIVREURS */}
      {activeTab === 'couriers' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <span>🛵</span>
                <span>Flotte de Livreurs ({couriers.length})</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Livreurs habilités à recevoir des courses et effectuer les tournées terrain.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/couriers"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un livreur</span>
              </Link>
            </div>
          </div>

          {couriers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Bike className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="font-bold text-gray-900 text-sm">Aucun livreur enregistré</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 mb-4">
                Créez vos coursiers pour leur assigner des colis lors du ramassage.
              </p>
              <Link
                href="/dashboard/couriers"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"
              >
                + Créer le premier livreur
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {couriers.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl border border-gray-200/80 bg-gray-50/50 hover:bg-white hover:border-teal-300 hover:shadow-xs transition flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-900 text-sm">{c.full_name}</p>
                      {c.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Actif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3 text-gray-400" />
                          <span>Inactif</span>
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{c.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <Link
                      href="/dashboard/couriers"
                      className="text-teal-700 hover:underline font-bold text-[11px]"
                    >
                      Modifier / Accès →
                    </Link>
                    {c.phone && (
                      <a
                        href={toWhatsAppUrl(c.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-700 hover:underline text-[11px] font-semibold"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Link
              href="/dashboard/couriers"
              className="text-xs font-bold text-teal-800 hover:underline flex items-center gap-1"
            >
              <span>Accéder à la gestion complète des livreurs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* BLOC 2 : CATALOGUE EXPRESS */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <span>🏷️</span>
                <span>Catalogue Express ({products.length} articles)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Articles prêts à la vente avec prix et déclinaisons rapides (tailles, couleurs).
              </p>
            </div>
            <Link
              href="/dashboard/products"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un article</span>
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Tag className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="font-bold text-gray-900 text-sm">Catalogue vide</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 mb-4">
                Ajoutez vos articles phares pour les insérer en 1 clic lors de la prise de commande.
              </p>
              <Link
                href="/dashboard/products"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
              >
                + Ajouter un article
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-gray-200/80 bg-gray-50/50 hover:bg-white hover:border-primary-border hover:shadow-xs transition space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-gray-900 text-sm leading-tight">{p.name}</p>
                    <p className="font-extrabold text-primary-soft-text text-sm flex-shrink-0">
                      {formatMoney(p.base_price)}
                    </p>
                  </div>

                  {/* Déclinaisons rapides */}
                  <div className="space-y-1 text-xs">
                    {p.available_sizes.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] text-gray-400 font-semibold">Tailles :</span>
                        {p.available_sizes.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-bold text-gray-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.available_colors.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] text-gray-400 font-semibold">Couleurs :</span>
                        {p.available_colors.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-medium text-gray-700"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex justify-end">
                    <Link
                      href="/dashboard/products"
                      className="text-primary-soft-text hover:underline font-bold text-[11px]"
                    >
                      Modifier l&apos;article →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Link
              href="/dashboard/products"
              className="text-xs font-bold text-primary-soft-text hover:underline flex items-center gap-1"
            >
              <span>Accéder à la gestion complète du catalogue</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* BLOC 3 : RÉPERTOIRE CLIENTES */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <span>👥</span>
                <span>Répertoire Clientes ({customers.length})</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Historique et coordonnées de contact de vos acheteuses.
              </p>
            </div>
            <Link
              href="/dashboard/clients"
              className="px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <span>Voir tout le répertoire</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Recherche rapide instantanée */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Rechercher une cliente par nom, téléphone ou quartier..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-2xl">
              <p className="text-sm font-semibold text-gray-700">Aucune cliente trouvée</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {customerSearch ? `Aucun résultat pour "${customerSearch}"` : 'Le répertoire est vide.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/40 hover:bg-white hover:border-blue-300 transition space-y-1.5"
                >
                  <p className="font-bold text-gray-900 text-sm truncate">{c.full_name}</p>
                  <p className="text-xs text-gray-600 font-mono">{c.phone}</p>
                  {c.city && (
                    <p className="text-xs text-blue-800 font-medium flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span>{c.city}</span>
                    </p>
                  )}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <Link
                      href="/dashboard/clients"
                      className="text-blue-800 hover:underline font-bold text-[11px]"
                    >
                      Fiche →
                    </Link>
                    <a
                      href={toWhatsAppUrl(c.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-700 hover:underline font-semibold text-[11px]"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BLOC 4 : IDENTITÉ & COORDONNÉES DE LA BOUTIQUE */}
      {activeTab === 'shop' && (
        <div className="space-y-6">
          <BrandingSettingsForm
            companyId={company.id}
            initialName={company.name}
            initialLogoUrl={company.logo_url ?? null}
            initialPalette={company.theme_palette ?? 'indigo'}
          />

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <span>🏪</span>
              <span>Coordonnées de la Boutique</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ces informations apparaissent sur vos bordereaux et reçus de livraison.
            </p>
          </div>

          <form onSubmit={handleShopSubmit} className="space-y-4 max-w-xl" noValidate>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Nom de la boutique <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mode & Chic Lomé"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Téléphone WhatsApp boutique
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+228 90 00 00 00"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Ville / Pays
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Lomé, Togo"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Adresse physique / Quartier
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Quartier Adidogomé"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-sm border font-medium ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-3 bg-blue-800 text-white rounded-xl font-extrabold text-sm hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
            >
              {isPending ? 'Enregistrement...' : 'Enregistrer les coordonnées'}
            </button>
          </form>

          {/* Rappel du compte connecté */}
          <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            <p>Compte administrateur : <strong className="text-gray-800">{userName}</strong> ({userEmail})</p>
          </div>

          {/* Zone de réinitialisation complète pour test grandeur nature */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-600" strokeWidth={1.75} />
                  <span>Réinitialisation complète (Test grandeur nature)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vide toutes les commandes, livraisons, paiements, versements de caisse, clients et produits du catalogue (compteur colis remis à #01), tout en conservant uniquement les comptes utilisateurs et livreurs.
                </p>
              </div>
            </div>

            {resetMessage && (
              <div
                className={`p-3 rounded-xl text-xs border font-medium ${
                  resetMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {resetMessage.text}
              </div>
            )}

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => {
                  setResetMessage(null)
                  setConfirmReset(true)
                }}
                className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 bg-rose-50/70 hover:bg-rose-100 text-xs font-semibold transition"
              >
                Vider l&apos;historique opérationnel
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <span className="text-xs font-semibold text-rose-900 mr-auto">
                  Confirmer la purge définitive de l&apos;historique ?
                </span>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => {
                    startResetting(async () => {
                      const res = await resetOperationalDataForTest()
                      if (res.error) {
                        setResetMessage({ type: 'error', text: res.error })
                      } else {
                        setResetMessage({
                          type: 'success',
                          text: 'Base opérationnelle réinitialisée (0 FCFA, 0 commande, compteur colis à #01).',
                        })
                        setConfirmReset(false)
                        router.refresh()
                      }
                    })
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  {isResetting ? 'Purge en cours...' : 'Confirmer la purge'}
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
