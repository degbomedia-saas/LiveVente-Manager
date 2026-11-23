import { z } from 'zod'

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Le nom du produit doit contenir au moins 2 caractères.')
    .max(150, 'Le nom ne peut pas dépasser 150 caractères.'),
  basePrice: z.coerce
    .number()
    .min(0, 'Le prix doit être positif.')
    .max(100000000, 'Prix trop élevé.'),
  sku: z.string().trim().max(60).optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  stockQty: z.coerce.number().int().min(0, 'Le stock doit être >= 0.').default(10),
  lowStockThreshold: z.coerce
    .number()
    .int()
    .min(0, 'Le seuil doit être >= 0.')
    .default(3),
  imageUrl: z.string().trim().max(2_500_000).optional().or(z.literal('')),
  sizesInput: z
    .string()
    .trim()
    .max(300, 'Liste des tailles trop longue.')
    .optional()
    .or(z.literal('')),
  colorsInput: z
    .string()
    .trim()
    .max(300, 'Liste des couleurs trop longue.')
    .optional()
    .or(z.literal('')),
})

export const updateProductSchema = productSchema.extend({
  id: z.string().uuid('Identifiant produit invalide.'),
})

export type ProductInput = z.infer<typeof productSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
