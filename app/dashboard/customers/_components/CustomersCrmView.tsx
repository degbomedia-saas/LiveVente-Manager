'use client'

import { useMemo, useState } from 'react'
import {
  Award,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react'
import { toWhatsAppUrl } from '@/lib/validations/orders'
import { ServerPagination } from '@/components/ui/ServerPagination'

export interface CrmCustomerRow {
  id: string
  full_name: string
  phone: string
  city: string | null
  address: string | null
  default_address?: string | null
  total_orders?: number | null
  total_spent_fcfa?: number | null
  loyalty_points?: number | null
  created_at: string
}

type Lang = 'fr' | 'en'

export function CustomersCrmView({
  customers,
  loyaltyThreshold = 5,
  currentPage = 1,
  totalCount,
  pageSize = 20,
}: {
  customers: CrmCustomerRow[]
  loyaltyThreshold?: number
  currentPage?: number
  totalCount?: number
  pageSize?: number
}) {
  const [search, setSearch] = useState('')
  const [lang, setLang] = useState<Lang>('fr')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
    )
  }, [customers, search])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">
            {lang === 'fr' ? 'Base Clients CRM & Fidélité' : 'Customer CRM & Loyalty'}
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            {lang === 'fr'
              ? `${totalCount ?? customers.length} client(e)s • Synchronisation automatique à chaque commande`
              : `${totalCount ?? customers.length} customers • Auto-synced on every order`}
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
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="relative w-full sm:w-96">
        <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            lang === 'fr'
              ? 'Rechercher par nom, téléphone (+228), quartier...'
              : 'Search by name, phone (+228), neighborhood...'
          }
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] text-sm text-[#0F172A] focus:outline-none focus:border-primary"
        />
      </div>

      {/* Cartes empilées Mobile-First */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-[#FFFFFF] border border-[#E2E8F0] p-12 text-center space-y-2">
          <Users className="w-8 h-8 text-[#64748B] mx-auto" />
          <p className="text-sm font-bold text-[#0F172A]">
            {lang === 'fr' ? 'Aucun client trouvé' : 'No customers found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const ordersCount = c.total_orders ?? 0
            const totalSpent = c.total_spent_fcfa ?? 0
            const points = c.loyalty_points ?? ordersCount
            const isVip = points >= loyaltyThreshold
            const waUrl = toWhatsAppUrl(
              c.phone,
              lang === 'fr'
                ? `Bonjour ${c.full_name}, merci pour votre fidélité chez notre boutique !`
                : `Hello ${c.full_name}, thank you for shopping with us!`
            )

            return (
              <div
                key={c.id}
                className="rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-[#0F172A]">
                        {c.full_name}
                      </h3>
                      <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        <span>{c.phone}</span>
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        isVip
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-primary-soft text-primary-soft-text border-primary-border'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>
                        {points} {lang === 'fr' ? 'pts' : 'pts'}
                        {isVip ? ' • VIP' : ''}
                      </span>
                    </span>
                  </div>

                  {(c.city || c.default_address || c.address) && (
                    <p className="text-xs text-[#64748B] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                      <span className="truncate">
                        {[c.city, c.default_address || c.address]
                          .filter(Boolean)
                          .join(' — ')}
                      </span>
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-2.5">
                      <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        <span>{lang === 'fr' ? 'Commandes' : 'Orders'}</span>
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A] mt-0.5 tabular-nums">
                        {ordersCount}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-2.5">
                      <p className="text-[11px] text-[#64748B]">
                        {lang === 'fr' ? 'Total dépensé' : 'Total spent'}
                      </p>
                      <p className="text-sm font-extrabold text-primary mt-0.5 tabular-nums">
                        {Math.round(totalSpent).toLocaleString('fr-FR')} F
                      </p>
                    </div>
                  </div>
                </div>

                {waUrl && (
                  <div className="pt-3 border-t border-[#E2E8F0]">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'fr'
                          ? 'Contacter sur WhatsApp'
                          : 'Message on WhatsApp'}
                      </span>
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ServerPagination
        currentPage={currentPage}
        totalCount={totalCount ?? customers.length}
        pageSize={pageSize}
        basePath="/dashboard/customers"
        lang={lang}
      />
    </div>
  )
}
