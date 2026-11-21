import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Lien invalide ou expiré</h2>
        <p className="text-gray-600 text-sm mb-6">
          Ce lien de vérification n&apos;est plus valide. Veuillez effectuer une nouvelle demande.
        </p>
        <div className="space-y-3">
          <Link
            href="/forgot-password"
            className="block w-full bg-blue-800 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition text-sm"
          >
            Réinitialiser mon mot de passe
          </Link>
          <Link
            href="/login"
            className="block w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition text-sm"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  )
}
