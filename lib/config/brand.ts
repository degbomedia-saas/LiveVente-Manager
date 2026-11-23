'use client'

import React, { createContext, useContext, useState } from 'react'

export interface BrandConfig {
  name: string
  taglineFr: string
  taglineEn: string
  logoUrl: string | null
  primaryColor: string
  countryPrefix: string
  currency: string
  city: string
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  name: 'Kaba Kaba',
  taglineFr: 'Logistique & Caisse pour vendeurs TikTok, WhatsApp & Instagram',
  taglineEn: 'Logistics & Cash Control for TikTok, WhatsApp & Instagram Sellers',
  logoUrl: null,
  primaryColor: '#10B981',
  countryPrefix: '+228',
  currency: 'FCFA',
  city: 'Lomé',
}

interface BrandContextValue {
  brand: BrandConfig
  setBrand: React.Dispatch<React.SetStateAction<BrandConfig>>
}

const BrandContext = createContext<BrandContextValue>({
  brand: DEFAULT_BRAND_CONFIG,
  setBrand: () => {},
})

export function BrandConfigProvider({
  children,
  initialConfig,
}: {
  children: React.ReactNode
  initialConfig?: Partial<BrandConfig>
}) {
  const [brand, setBrand] = useState<BrandConfig>({
    ...DEFAULT_BRAND_CONFIG,
    ...initialConfig,
  })

  return React.createElement(
    BrandContext.Provider,
    { value: { brand, setBrand } },
    children
  )
}

export function useBrandConfig() {
  return useContext(BrandContext)
}
