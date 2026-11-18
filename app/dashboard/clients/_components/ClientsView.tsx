'use client'

import { useState, useTransition, useMemo } from 'react'
import { addClient, deleteClient } from '@/app/actions/clients'
import { clientSchema } from '@/lib/validations/clients'

interface Customer {
  id: string
  full_name: string
  phone: string
  city: string | null
  address: string | null
  created_at: string
}

interface ClientsViewProps {
  initialClients: Customer[]
  userRole: string
}

// ─── Formulaire d'ajout ──────────────────────────────────────────────────────
function AddClientModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [fields, setFields] = useState({ fullName: '', phone: '', city: '', address: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function set(key: string, value: string) {
    setFields(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // ✅ AGENTS.md : Validation Zod côté client avant d'appeler le Server Action
    const result = clientSchema.safeParse(fields)
    if (!result.success) {
      const fe: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) fe[err.path[0] as string] = err.message
      })
      setErrors(fe)
      return
    }

    startTransition(async () => {
      const res = await addClient(fields)
      if (res.error) {
        if (res.field) setErrors({ [res.field]: res.error })
        else setServerError(res.error)
      } else {
        onSuccess()
        onClose()
      }
    })
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition text-sm ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Carte modale — slide depuis le bas sur mobile */}
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl z-10">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Nouveau client</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition"
          >
            ✕
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {/* Nom complet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fields.fullName}
              onChange={e => set('fullName', e.target.value)}
              placeholder="ex : Ama Koffi"
              className={inputClass('fullName')}
            />
            {errors.fullName && <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={fields.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="ex : +228 90 00 00 00"
              className={inputClass('phone')}
            />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
          </div>

          {/* Quartier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quartier
            </label>
            <input
              type="text"
              value={fields.city}
              onChange={e => set('city', e.target.value)}
              placeholder="ex : Bè, Adidogomé, Tokoin..."
              className={inputClass('city')}
            />
            {errors.city && <p className="text-red-600 text-xs mt-1">{errors.city}</p>}
          </div>

          {/* Localisation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Localisation / Adresse
            </label>
            <textarea
              value={fields.address}
              onChange={e => set('address', e.target.value)}
              placeholder="ex : Face à la pharmacie centrale, 2ème maison à gauche"
              rows={2}
              className={`${inputClass('address')} resize-none`}
            />
            {errors.address && <p className="text-red-600 text-xs mt-1">{errors.address}</p>}
          </div>

          {/* Erreur serveur */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex gap-2">
              <span>⚠️</span><span>{serverError}</span>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-blue-800 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold transition text-sm flex items-center justify-center gap-2"
            >
              {isPending ? <><span className="animate-spin">⏳</span> Enregistrement...</> : '✓ Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Carte client ────────────────────────────────────────────────────────────
function ClientCard({
  client,
  canDelete,
  onDelete,
}: {
  client: Customer
  canDelete: boolean
  onDelete: (id: string) => void
}) {
  const initials = client.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      {/* Avatar initiales */}
      <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <span className="text-blue-800 font-bold text-sm">{initials}</span>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{client.full_name}</p>
        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
          <span>📞</span>
          <span>{client.phone}</span>
        </p>
        {(client.city || client.address) && (
          <p className="text-xs text-gray-400 truncate mt-0.5">
            📍 {[client.city, client.address].filter(Boolean).join(' — ')}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <a
          href={`tel:${client.phone}`}
          className="w-9 h-9 rounded-xl bg-green-50 text-green-700 flex items-center justify-center hover:bg-green-100 transition"
          title="Appeler"
        >
          📞
        </a>
        {canDelete && (
          <button
            onClick={() => onDelete(client.id)}
            className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition"
            title="Supprimer"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
        <span className="text-4xl">👥</span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Aucun client pour l&apos;instant</h3>
      <p className="text-gray-500 text-sm max-w-xs mb-6">
        Ajoutez votre premier client pour commencer à gérer vos commandes et livraisons.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-6 py-3 bg-blue-800 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
      >
        <span>+</span> Ajouter un client
      </button>
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function ClientsView({ initialClients, userRole }: ClientsViewProps) {
  const [clients, setClients] = useState<Customer[]>(initialClients)
  const [showModal, setShowModal]   = useState(false)
  const [search, setSearch]         = useState('')
  const [, startTransition]         = useTransition()

  // Recherche client-side sur la liste déjà chargée
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return clients
    return clients.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.city?.toLowerCase().includes(q))
    )
  }, [clients, search])

  function handleSuccess() {
    // revalidatePath() dans le Server Action rafraîchit les données Next.js
    // On force un refresh léger pour récupérer la nouvelle liste
    window.location.reload()
  }

  function handleDelete(id: string) {
    if (!confirm('Supprimer ce client ? Cette action est irréversible.')) return
    startTransition(async () => {
      const res = await deleteClient(id)
      if (res.error) alert(res.error)
      else setClients(c => c.filter(cl => cl.id !== id))
    })
  }

  const canDelete = userRole === 'owner'

  return (
    <>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {clients.length} client{clients.length !== 1 ? 's' : ''} enregistré{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-blue-800 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
        >
          <span className="text-lg leading-none">+</span> Ajouter un client
        </button>
      </div>

      {/* Barre de recherche */}
      {clients.length > 0 && (
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm placeholder-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Résultats de recherche */}
      {search && (
        <p className="text-sm text-gray-500 mb-3">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} pour &quot;{search}&quot;
        </p>
      )}

      {/* Liste ou Empty State */}
      {clients.length === 0 ? (
        <EmptyState onAdd={() => setShowModal(true)} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl">🔍</span>
          <p className="text-gray-500 mt-3">Aucun client ne correspond à &quot;{search}&quot;</p>
          <button onClick={() => setSearch('')} className="text-blue-700 text-sm mt-2 hover:underline">
            Effacer la recherche
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              canDelete={canDelete}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* FAB mobile — bouton flottant en bas à droite */}
      <button
        onClick={() => setShowModal(true)}
        className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition z-20"
        title="Ajouter un client"
      >
        +
      </button>

      {/* Modal d'ajout */}
      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
