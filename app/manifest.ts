import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kaba Kaba',
    short_name: 'Kaba Kaba',
    description:
      'Commandes, étiquettes QR, livreurs et caisse Mobile Money (T-Money / Flooz) pour vendeurs Live TikTok & WhatsApp.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#242424',
    theme_color: '#242424',
    icons: [
      {
        src: '/kaba-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/kaba-icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/kaba-icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
