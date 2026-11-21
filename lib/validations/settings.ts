import { z } from 'zod'

export const companySettingsSchema = z.object({
  name: z.string().trim().min(2, 'Le nom de la boutique doit comporter au moins 2 caractères.'),
  phone: z.string().trim().optional().or(z.literal('')),
  currency: z.string().trim().min(1, 'La devise est obligatoire.'),
  city: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
})

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>
