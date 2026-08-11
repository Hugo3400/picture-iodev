import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createSession, SESSION_COOKIE, TTL } from '@/lib/session'
import {
  verifyPassword, isValidEmail,
  LOGIN_ATTEMPT_LIMIT, countRecentLoginAttempts, recordFailedLoginAttempt,
} from '@/lib/auth'
import { getClientIp } from '@/lib/publicUploads'

export async function POST(req: NextRequest) {
  const db = getDb()
  const ip = getClientIp(req)
  if (countRecentLoginAttempts(db, ip) >= LOGIN_ATTEMPT_LIMIT) {
    return NextResponse.json({ error: 'Trop de tentatives, réessaie plus tard' }, { status: 429 })
  }

  const { email, password } = await req.json()
  if (!isValidEmail(email) || typeof password !== 'string' || !password) {
    recordFailedLoginAttempt(db, ip)
    return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(normalizedEmail) as
    { id: number; password_hash: string | null } | undefined

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    recordFailedLoginAttempt(db, ip)
    return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 })
  }

  const token = createSession(user.id)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, path: '/', maxAge: TTL * 86400, sameSite: 'lax' })
  return res
}
