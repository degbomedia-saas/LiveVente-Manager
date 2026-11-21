import { z } from 'zod'

/**
 * Schémas Zod de validation — Auth
 * Appliqués AVANT tout appel à Supabase.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'L\'email est requis.')
    .email('Adresse email invalide.'),

  password: z
    .string()
    .min(1, 'Le mot de passe est requis.')
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
})

export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères.')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères.')
    .regex(/^[\p{L}\s'-]+$/u, 'Le nom contient des caractères non autorisés.'),

  companyName: z
    .string()
    .min(2, 'Le nom de l\'entreprise doit contenir au moins 2 caractères.')
    .max(100, 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères.'),

  email: z
    .string()
    .min(1, 'L\'email est requis.')
    .email('Adresse email invalide.')
    .max(255, 'L\'email est trop long.'),

  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),
})

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'L\'email est requis.')
    .email('Adresse email invalide.')
    .max(255, 'L\'email est trop long.'),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
      .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.')
      .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
      .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
