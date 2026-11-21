import type { Metadata } from 'next'
import { LandingClient } from './_components/LandingClient'

export const metadata: Metadata = {
  title: 'Kaba Kaba — La logistique nouvelle génération à Lomé',
  description:
    'Centralisez vos commandes WhatsApp, pilotez vos livreurs moto et maîtrisez votre caisse T-Money / Moov en temps réel.',
}

export default function HomePage() {
  return <LandingClient />
}
