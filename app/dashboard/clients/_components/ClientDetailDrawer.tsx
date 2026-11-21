'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getCustomerOrderHistory,
  type CustomerOrderHistoryResult,
  type CustomerOrderHistoryItem,
} from '@/app/actions/clients'

interface Customer {
  id: string
  full_name: string
  phone: string
  city: string | null
  address: string | null
  created_at: string
}

interface ClientDetailDrawerProps {
  client: Customer
  onClose: () => void
}

function formatMoney(amount: number) {
  return `${amount.toLocaleString('fr-FR')} FCFA`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ORDER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmée', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  in_transit: { label: 'En cours', className: 'bg-purple-50 text-purple-800 border-purple-200' },
  delivered: { label: 'Livrée', className: 'bg-green-50 text-green-800 border-green-200' },
  delivery_failed: { label: 'Échec', className: 'bg-red-50 text-red-800 border-red-200' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-700 border-gray-300' },
}

export default function ClientDetailDrawer({ client, onClose }: ClientDetailDrawerProps) {
  const [data, setData] = useState<CustomerOrderHistoryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function fetchHistory() {
      setLoading(true)
      setError(null)
      try {
        const res = await getCustomerOrderHistory(client.id)
        if (!isMounted) return
        if (res.error) {
          setError(res.error)
        } else if (res.data) {
          setData(res.data)
        }
      } catch {
        if (isMounted) setError('Impossible de charger l\'historique des commandes.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchHistory()
    return () => {
      isMounted = false
    }
  }, [client.id])

  const initials = client.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panneau latéral (Drawer) */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden">
        {/* En-tête de la fiche client */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/70 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-800 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-sm">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                {client.full_name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <a
                  href={`tel:${client.phone}`}
                  className="text-sm font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100"
                >
                  📞 {client.phone}
                </a>
              </div>
              {(client.city || client.address) && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <span>📍</span>
                  <span>{[client.city, client.address].filter(Boolean).join(' — ')}</span>
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">
                Cliente depuis le {formatDate(client.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-200 text-gray-500 flex items-center justify-center transition border border-gray-200"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Métriques / KPIs */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-white border-b border-gray-100 text-center">
          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-800 font-medium">Commandes</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">
              {loading ? '…' : data?.metrics.totalOrders ?? 0}
            </p>
          </div>
          <div className="bg-green-50/60 p-2.5 rounded-xl border border-green-100">
            <p className="text-xs text-green-800 font-medium">Total dépensé</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">
              {loading ? '…' : formatMoney(data?.metrics.totalSpent ?? 0)}
            </p>
          </div>
          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
            <p className="text-xs text-amber-800 font-medium">En cours</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">
              {loading ? '…' : data?.metrics.activeOrders ?? 0}
            </p>
          </div>
        </div>

        {/* Zone de défilement de l'historique */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Historique des commandes
            </h3>
            {data && data.orders.length > 0 && (
              <span className="text-xs text-gray-500">
                {data.orders.length} commande{data.orders.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <span className="text-3xl animate-spin mb-2">⏳</span>
              <p className="text-sm">Chargement de l&apos;historique...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200">
              {error}
            </div>
          ) : !data || data.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <span className="text-4xl mb-2">📦</span>
              <p className="text-sm font-semibold text-gray-700">Aucune commande enregistrée</p>
              <p className="text-xs text-gray-400 mt-1">
                Cette cliente n&apos;a pas encore passé de commande.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.orders.map((order: CustomerOrderHistoryItem) => {
                const statusMeta = ORDER_STATUS_LABELS[order.status] ?? {
                  label: order.status,
                  className: 'bg-gray-50 text-gray-700 border-gray-200',
                }
                const isExpanded = expandedOrderId === order.id

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition hover:border-gray-300"
                  >
                    {/* Carte principale */}
                    <div
                      className="p-3.5 cursor-pointer select-none"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                              {order.orderNumber}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDateTime(order.orderedAt)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">
                            {formatMoney(order.totalAmount)}
                          </p>
                          {order.paymentStatus === 'paid' ? (
                            <span className="inline-block text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.2 rounded border border-green-200 mt-0.5">
                              ✓ Réglé
                            </span>
                          ) : order.paymentStatus === 'partial' ? (
                            <span className="inline-block text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.2 rounded border border-amber-200 mt-0.5">
                              Acompte ({formatMoney(order.amountPaid)})
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] font-medium text-gray-500 bg-gray-50 px-2 py-0.2 rounded border border-gray-200 mt-0.5">
                              Non payé
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Résumé des articles */}
                      <div className="mt-2 text-xs text-gray-600 flex items-center justify-between">
                        <span className="truncate text-gray-500">
                          {order.items.length} article{order.items.length > 1 ? 's' : ''} :{' '}
                          {order.items.map((it) => `${it.quantity}× ${it.productName}`).join(', ')}
                        </span>
                        <span className="text-gray-400 text-xs ml-2">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Détail accordéon déplié */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-2 bg-gray-50 border-t border-gray-100 text-xs space-y-2">
                        <p className="font-semibold text-gray-700">Articles commandés :</p>
                        <div className="space-y-1">
                          {order.items.map((it) => (
                            <div key={it.id} className="flex justify-between items-center text-gray-600">
                              <span>
                                {it.quantity} × {it.productName}
                              </span>
                              <span className="font-medium">{formatMoney(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>

                        {order.delivery && (
                          <div className="pt-2 border-t border-gray-200 text-gray-600 space-y-1">
                            <p className="font-semibold text-gray-700">Détails livraison :</p>
                            {order.delivery.courierName && (
                              <p>🚴 Livreur : {order.delivery.courierName}</p>
                            )}
                            {order.delivery.deliveryAddress && (
                              <p>📍 Adresse : {order.delivery.deliveryAddress}</p>
                            )}
                            {order.delivery.proof && (
                              <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200 mt-1 space-y-0.5">
                                <p className="font-semibold">
                                  ✓ Preuve de livraison ({order.delivery.proof.recipientName || 'Réceptionné'})
                                </p>
                                {order.delivery.proof.photoUrl && (
                                  <a
                                    href={order.delivery.proof.photoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-700 underline font-semibold inline-block mt-0.5"
                                  >
                                    📷 Voir la photo de livraison
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
