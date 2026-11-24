export const LOME_QUARTIERS = [
  'Tokoin',
  'Déckon',
  'Agoè',
  'Adidogomé',
  'Baguida',
  'Bè',
  'Hedzranawoé',
  'Kégué',
  'Totsi',
  'Agbalépédogan',
  'Avédji',
  'Cacaveli',
  'Ségbé',
  'Zanguéra',
  'Akodésséwa',
  'Nyékonakpoè',
  'Kodjoviakopé',
  'Amoutivé',
  'Gbossimé',
  'Hanoukopé',
  'Vakpossito',
  'Aflao Gakli',
] as const

export const DEFAULT_LOME_ZONES: Array<{
  zone_name: string
  fee_fcfa: number
  is_active: boolean
}> = [
  { zone_name: 'Tokoin', fee_fcfa: 1000, is_active: true },
  { zone_name: 'Déckon', fee_fcfa: 1000, is_active: true },
  { zone_name: 'Agoè', fee_fcfa: 1500, is_active: true },
  { zone_name: 'Adidogomé', fee_fcfa: 1500, is_active: true },
  { zone_name: 'Baguida', fee_fcfa: 2000, is_active: true },
]
