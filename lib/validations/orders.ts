import { z } from 'zod'

export const ORDER_STATUSES = [
  'pending_confirmation',
  'pending',
  'confirmed',
  'packed',
  'assigned',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
] as const

export const orderStatusSchema = z.enum(ORDER_STATUSES)

export const SHOP_PAYMENT_METHODS = [
  'Espèces',
  'Flooz',
  'Mixx',
  'Virement',
  'Autre',
] as const

export const shopPaymentMethodSchema = z.enum(SHOP_PAYMENT_METHODS)
export type ShopPaymentMethod = z.infer<typeof shopPaymentMethodSchema>

export const initialPaymentSchema = z
  .object({
    type: z.enum(['none', 'full', 'partial']).default('none'),
    amount: z.coerce.number().min(0).default(0),
    method: shopPaymentMethodSchema.default('Espèces'),
    reference: z
      .string()
      .trim()
      .max(100, 'La référence ne peut pas dépasser 100 caractères.')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'none' && data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Le montant du paiement doit être supérieur à 0.',
        path: ['amount'],
      })
    }
  })

export type InitialPaymentInput = z.infer<typeof initialPaymentSchema>

export const orderItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'La description est requise.')
    .max(150, 'La description ne peut pas dépasser 150 caractères.'),
  size: z
    .string()
    .trim()
    .max(50, 'La taille ne peut pas dépasser 50 caractères.')
    .optional()
    .or(z.literal('')),
  color: z
    .string()
    .trim()
    .max(50, 'La couleur ne peut pas dépasser 50 caractères.')
    .optional()
    .or(z.literal('')),
  quantity: z.coerce
    .number()
    .int('La quantité doit être un entier.')
    .min(1, 'Quantité minimale : 1.')
    .max(10000, 'Quantité maximale : 10 000.'),
  unitPrice: z.coerce
    .number()
    .min(0, 'Le prix doit être positif.')
    .max(100000000, 'Prix trop élevé.'),
})

export const newOrderCustomerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Le nom du client doit contenir au moins 2 caractères.')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères.'),
  phone: z
    .string()
    .trim()
    .min(8, 'Le téléphone doit contenir au moins 8 caractères.')
    .max(20, 'Le numéro est trop long.')
    .regex(/^[\d\s+\-()+]+$/, 'Numéro de téléphone invalide.'),
  city: z
    .string()
    .trim()
    .max(100, 'Le quartier ne peut pas dépasser 100 caractères.')
    .optional()
    .or(z.literal('')),
})

export const createOrderSchema = z
  .object({
    customerMode: z.enum(['existing', 'new']),
    customerId: z.string().uuid('Client invalide.').optional().or(z.literal('')),
    newCustomer: newOrderCustomerSchema.optional(),
    items: z
      .array(orderItemSchema)
      .min(1, 'Ajoutez au moins un article à la commande.')
      .max(100, 'Maximum 100 articles par commande.'),
    deliveryFee: z.coerce
      .number()
      .min(0, 'Les frais de livraison doivent être positifs.')
      .max(100000000, 'Frais de livraison trop élevés.')
      .default(0),
    discount: z.coerce
      .number()
      .min(0, 'La réduction doit être positive.')
      .max(100000000, 'Réduction trop élevée.')
      .default(0),
    status: orderStatusSchema.optional(),
    payment: initialPaymentSchema.optional(),
    notes: z
      .string()
      .trim()
      .max(500, 'Les notes ne peuvent pas dépasser 500 caractères.')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.customerMode === 'existing' && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Veuillez sélectionner un client.',
        path: ['customerId'],
      })
    }
    if (data.customerMode === 'new' && !data.newCustomer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Renseignez les informations du nouveau client.',
        path: ['newCustomer'],
      })
    }
  })

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid('Identifiant de commande invalide.'),
  status: orderStatusSchema,
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderItemInput = z.infer<typeof orderItemSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>

/**
 * Normalise un numéro saisi (ex: 8 chiffres locaux 90886744 -> +228 90 88 67 44)
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 8) {
    return `+228 ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`
  }
  return phone
}

/**
 * Génère le lien WhatsApp direct avec préfixe indicatif 228 si 8 chiffres purs
 */
export function toWhatsAppUrl(phone: string, text?: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  const fullDigits = digits.length === 8 ? `228${digits}` : digits
  const baseUrl = `https://wa.me/${fullDigits}`
  return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl
}
