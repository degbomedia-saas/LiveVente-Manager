'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations/auth'

const RESET_SUCCESS_MESSAGE =
  'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.'

export async function requestPasswordReset(rawData: { email: string }) {
  const parsed = forgotPasswordSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? 'Adresse email invalide.',
    }
  }

  const supabase = await createClient()
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const origin = headersList.get('origin') || `${protocol}://${host}`

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm`,
  })

  return {
    success: true as const,
    message: RESET_SUCCESS_MESSAGE,
  }
}

export async function updateUserPassword(rawData: {
  password: string
  confirmPassword: string
}) {
  const parsed = resetPasswordSchema.safeParse(rawData)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false as const,
      error: firstIssue?.message ?? 'Mot de passe invalide.',
      field: firstIssue?.path[0] as string | undefined,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false as const,
      error: 'Session expirée ou invalide. Veuillez demander un nouveau lien.',
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return {
      success: false as const,
      error: 'Impossible de mettre à jour le mot de passe. Veuillez réessayer.',
    }
  }

  return { success: true as const }
}
