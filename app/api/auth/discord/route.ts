import { NextRequest, NextResponse } from 'next/server'

export function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get('redirect')
  const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : undefined

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: 'code',
    scope: 'identify',
  })
  if (safeRedirect) params.set('state', safeRedirect)

  return NextResponse.redirect('https://discord.com/api/oauth2/authorize?' + params)
}
