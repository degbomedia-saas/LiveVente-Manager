import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const defaultNext = type === 'recovery' ? '/reset-password' : '/dashboard'
  const rawNext = searchParams.get('next') ?? defaultNext
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : defaultNext

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Conserver un éventuel hash (#access_token=...&type=recovery) envoyé par Supabase
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redirection Kaba Kaba...</title>
</head>
<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #1e3a8a; color: white;">
  <p>Ouverture de la page de réinitialisation...</p>
  <script>
    (function() {
      var hash = window.location.hash || '';
      var search = window.location.search || '';
      window.location.replace('/reset-password' + search + hash);
    })();
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
