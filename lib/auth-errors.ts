const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Identifiants invalides.',
  'User already registered': 'Email déjà utilisé.',
  'Email not confirmed': 'Email non confirmé. Vérifiez votre boîte mail.',
}

export function formatAuthError(message: string): string {
  return KNOWN_MESSAGES[message] ?? message
}
