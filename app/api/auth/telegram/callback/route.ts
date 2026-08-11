import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createSession, SESSION_COOKIE, TTL } from '@/lib/session'
import { isTelegramConfigured, verifyTelegramAuth } from '@/lib/telegramAuth'

const BASE_URL = 'https://picture.iodev.fr'

export async function GET(req: NextRequest) {
  if (!isTelegramConfigured()) return NextResponse.redirect(`${BASE_URL}/?error=telegram_disabled`)

  const params: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'redirect') params[key] = value
  })

  if (!verifyTelegramAuth(params)) return NextResponse.redirect(`${BASE_URL}/?error=telegram_auth_invalid`)

  const telegramId = params.id
  const telegramName = params.first_name + (params.last_name ? ` ${params.last_name}` : '')
  const telegramUsername = params.username || null
  const telegramAvatar = params.photo_url || null

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as { id: number } | undefined

  let userId: number
  if (existing) {
    db.prepare('UPDATE users SET discord_name = ?, discord_username = ?, discord_avatar = ? WHERE id = ?').run(telegramName, telegramUsername, telegramAvatar, existing.id)
    userId = existing.id
  } else {
    const info = db.prepare('INSERT INTO users (telegram_id, discord_name, discord_username, discord_avatar) VALUES (?, ?, ?, ?)').run(telegramId, telegramName, telegramUsername, telegramAvatar)
    userId = info.lastInsertRowid as number
  }

  const redirect = req.nextUrl.searchParams.get('redirect')
  const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/prive'

  const token = createSession(userId, req.headers.get('user-agent'))
  const res = NextResponse.redirect(`${BASE_URL}${safeRedirect}`)
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, path: '/', maxAge: TTL * 86400, sameSite: 'lax' })
  return res
}
