import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createSession, SESSION_COOKIE, TTL } from '@/lib/session'

const BASE_URL = 'https://picture.iodev.fr'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(`${BASE_URL}/?error=missing_code`)

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    }),
  })
  if (!tokenRes.ok) return NextResponse.redirect(`${BASE_URL}/?error=discord_error`)
  const tokenData = await tokenRes.json()

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  if (!userRes.ok) return NextResponse.redirect(`${BASE_URL}/?error=discord_error`)
  const discordUser = await userRes.json()

  const discordId = discordUser.id as string
  const discordName = (discordUser.global_name || discordUser.username) as string
  const discordUsername = discordUser.username as string
  const discordAvatar = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
    : null

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(discordId) as { id: number } | undefined

  let userId: number
  if (existing) {
    db.prepare('UPDATE users SET discord_name = ?, discord_username = ?, discord_avatar = ? WHERE id = ?').run(discordName, discordUsername, discordAvatar, existing.id)
    userId = existing.id
  } else {
    const info = db.prepare('INSERT INTO users (discord_id, discord_name, discord_username, discord_avatar) VALUES (?, ?, ?, ?)').run(discordId, discordName, discordUsername, discordAvatar)
    userId = info.lastInsertRowid as number
  }

  // Lie les invitations de co-édition en attente (par pseudo Discord) à ce compte
  db.prepare('UPDATE album_collaborators SET user_id = ? WHERE user_id IS NULL AND LOWER(invited_name) = LOWER(?)').run(userId, discordUsername)

  const state = req.nextUrl.searchParams.get('state')
  const safeRedirect = state && state.startsWith('/') && !state.startsWith('//') ? state : '/prive'

  const token = createSession(userId)
  const res = NextResponse.redirect(`${BASE_URL}${safeRedirect}`)
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, path: '/', maxAge: TTL * 86400, sameSite: 'lax' })
  return res
}
