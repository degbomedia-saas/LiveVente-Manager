import { z } from 'zod'

export const createCourierSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Le nom doit contenir au moins 2 caractères.')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères.'),
  phone: z
    .string()
    .trim()
    .min(8, 'Le téléphone doit contenir au moins 8 chiffres.')
    .max(20, 'Le numéro est trop long.')
    .regex(/^[\d\s+\-()+]+$/, 'Numéro de téléphone invalide.'),
  isActive: z.boolean().default(true),
  email: z
    .string()
    .trim()
    .min(1, 'L\'email du livreur est requis.')
    .email('Adresse email invalide.')
    .max(255),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(128, 'Le mot de passe est trop long.'),
})

export const toggleCourierStatusSchema = z.object({
  courierId: z.string().uuid('Identifiant livreur invalide.'),
  isActive: z.boolean(),
})

export const assignDeliverySchema = z.object({
  orderId: z.string().uuid('Commande invalide.'),
  courierId: z.string().uuid('Veuillez choisir un livreur.'),
  deliveryAddress: z
    .string()
    .trim()
    .min(2, 'L\'adresse de livraison est requise.')
    .max(255, 'L\'adresse ne peut pas dépasser 255 caractères.'),
})

export const updateDeliveryStatusSchema = z
  .object({
    deliveryId: z.string().uuid('Livraison invalide.'),
    status: z.enum(['in_transit', 'delivered', 'failed']),
    failedReason: z
      .string()
      .trim()
      .max(500, 'Le motif ne peut pas dépasser 500 caractères.')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'failed' && (!data.failedReason || data.failedReason.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Veuillez indiquer le motif de l\'échec (3 caractères min.).',
        path: ['failedReason'],
      })
    }
  })

export const PAYMENT_MODES = [
  'Espèces',
  'Flooz',
  'Mixx',
  'Virement',
  'Autre',
] as const

export const FAILURE_REASONS = [
  'Client injoignable',
  'Client absent',
  'Adresse introuvable',
  'Commande refusée',
  'Problème de paiement',
  'Report demandé',
  'Autre',
] as const

export const completeDeliverySchema = z
  .object({
    deliveryId: z.string().uuid('Livraison invalide.'),
    outcome: z.enum(['delivered', 'failed']),
    recipientName: z
      .string()
      .trim()
      .max(100, 'Le nom du réceptionnaire ne peut pas dépasser 100 caractères.')
      .optional()
      .or(z.literal('')),
    photoUrl: z
      .string()
      .trim()
      .max(1000, 'URL trop longue.')
      .optional()
      .or(z.literal('')),
    collectedAmount: z.coerce.number().optional(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    failureReason: z.enum(FAILURE_REASONS).optional(),
    comment: z
      .string()
      .trim()
      .max(500, 'Le commentaire ne peut pas dépasser 500 caractères.')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.outcome === 'delivered') {
      if (!data.recipientName || data.recipientName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Veuillez indiquer le nom de la personne ayant réceptionné le colis (2 car. min).',
          path: ['recipientName'],
        })
      }
      if (data.collectedAmount === undefined || Number.isNaN(data.collectedAmount) || data.collectedAmount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Le montant encaissé doit être supérieur ou égal à 0.',
          path: ['collectedAmount'],
        })
      }
      if (data.collectedAmount !== undefined && data.collectedAmount > 0 && !data.paymentMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Sélectionnez un mode de paiement.',
          path: ['paymentMode'],
        })
      }
    } else if (!data.failureReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sélectionnez un motif d\'échec.',
        path: ['failureReason'],
      })
    }
  })

export type CreateCourierInput = z.infer<typeof createCourierSchema>
export type ToggleCourierStatusInput = z.infer<typeof toggleCourierStatusSchema>
export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>
export type CompleteDeliveryInput = z.infer<typeof completeDeliverySchema>
