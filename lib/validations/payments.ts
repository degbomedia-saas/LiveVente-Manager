import { z } from 'zod'

export const createSettlementSchema = z
  .object({
    courierId: z.string().uuid('Livreur invalide.'),
    amount: z.coerce
      .number()
      .positive('Le montant reversé doit être supérieur à 0.')
      .max(100000000, 'Montant trop élevé.'),
    differenceAmount: z.coerce
      .number()
      .max(100000000, 'Montant trop élevé.')
      .default(0),
    differenceReason: z
      .string()
      .trim()
      .max(255, 'Le motif ne peut pas dépasser 255 caractères.')
      .optional()
      .or(z.literal('')),
    notes: z
      .string()
      .trim()
      .max(500, 'Les notes ne peuvent pas dépasser 500 caractères.')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.differenceAmount !== 0) {
      if (!data.differenceReason || data.differenceReason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Veuillez indiquer le motif de l\'écart de caisse (3 caractères min.).',
          path: ['differenceReason'],
        })
      }
    }
  })

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>
