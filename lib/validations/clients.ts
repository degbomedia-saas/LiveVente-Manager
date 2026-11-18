import { z } from 'zod'

/**
 * Schéma Zod — Formulaire client
 * AGENTS.md : toute entrée utilisateur validée avec Zod avant la logique métier.
 */
export const clientSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères.')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères.'),

  phone: z
    .string()
    .min(8, 'Le numéro doit contenir au moins 8 chiffres.')
    .max(20, 'Le numéro est trop long.')
    .regex(/^[\d\s+\-()+]+$/, 'Numéro de téléphone invalide. Ex : +228 90 00 00 00'),

  city: z
    .string()
    .max(100, 'Le quartier ne peut pas dépasser 100 caractères.')
    .optional()
    .or(z.literal('')),

  address: z
    .string()
    .max(255, 'La localisation ne peut pas dépasser 255 caractères.')
    .optional()
    .or(z.literal('')),
})

export type ClientInput = z.infer<typeof clientSchema>
