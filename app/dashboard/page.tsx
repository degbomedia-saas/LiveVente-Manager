import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from './_components/DashboardLayout'

// Données du profil avec les infos de l'entreprise
interface Profile {
  full_name: string
  role: string
  companies: {
    name: string
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Vérification de la session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Récupération du profil + nom de l'entreprise
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role, companies(name)')
    .eq('id', user.id)
    .single<Profile>()

  if (error || !profile) redirect('/login')

  const companyName = profile.companies?.name ?? 'Votre entreprise'
  const userName    = profile.full_name

  // --- Statistiques rapides (toutes à zéro pour l'instant) ---
  const stats = [
    { label: 'Commandes du jour',   value: '0',  icon: '📦', color: 'bg-blue-50 text-blue-700'   },
    { label: 'Livraisons en cours', value: '0',  icon: '🚚', color: 'bg-orange-50 text-orange-700' },
    { label: 'Paiements reçus',     value: '0 FCFA', icon: '💳', color: 'bg-green-50 text-green-700'  },
    { label: 'Clients enregistrés', value: '0',  icon: '👥', color: 'bg-purple-50 text-purple-700' },
  ]

  return (
    <DashboardLayout userName={userName} companyName={companyName}>
      {/* Bandeau de bienvenue */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-2xl p-6 sm:p-8 mb-6 text-white shadow-lg">
        <p className="text-blue-200 text-sm font-medium mb-1">Tableau de bord</p>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">
          Bienvenue, {userName} 👋
        </h1>
        <p className="text-blue-100 text-base">
          <span className="font-semibold">{companyName}</span> est prête à gérer vos ventes.
        </p>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${stat.color} mb-3`}>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Section actions rapides */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button className="flex items-center gap-3 px-4 py-3 bg-blue-800 text-white rounded-xl hover:bg-blue-700 transition font-medium">
            <span>➕</span> Nouvelle commande
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium">
            <span>👤</span> Ajouter un client
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium">
            <span>🚴</span> Assigner une livraison
          </button>
        </div>
      </div>

      {/* Informations du compte */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations du compte</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Utilisateur</span>
            <span className="text-gray-900 font-medium text-sm">{userName}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Email</span>
            <span className="text-gray-900 font-medium text-sm">{user.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Entreprise</span>
            <span className="text-gray-900 font-medium text-sm">{companyName}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-500 text-sm">Rôle</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
              👑 {profile.role === 'owner' ? 'Propriétaire' : profile.role}
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
