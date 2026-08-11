import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createSession, SESSION_COOKIE, TTL } from '@/lib/session'
import { hashPassword, isValidEmail, isValidPassword } from '@/lib/auth'
import { getClientIp } from '@/lib/publicUploads'

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json()

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 })
  }
  const displayName = typeof name === 'string' ? name.trim() : ''
  if (!displayName) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)
  if (existing) {
    return NextResponse.json({ error: 'Cette adresse email est déjà utilisée' }, { status: 409 })
  }

  const passwordHash = hashPassword(password)
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, discord_name) VALUES (?, ?, ?)'
  ).run(normalizedEmail, passwordHash, displayName)
  const userId = info.lastInsertRowid as number

  const token = createSession(userId, req.headers.get('user-agent'), getClientIp(req))
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, path: '/', maxAge: TTL * 86400, sameSite: 'lax' })
  return res
}
