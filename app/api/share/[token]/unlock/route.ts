import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  verifyPassword, signUnlock, unlockCookieName, isShareLinkExpired,
  UNLOCK_ATTEMPT_LIMIT, countRecentUnlockAttempts, recordFailedUnlockAttempt,
} from '@/lib/share'
import { getClientIp } from '@/lib/publicUploads'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const db = getDb()
  const link = db.prepare('SELECT * FROM share_links WHERE token = ?').get(params.token) as any
  if (!link) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })
  if (isShareLinkExpired(link)) return NextResponse.json({ error: 'Ce lien a expiré', expired: true }, { status: 410 })
  if (!link.password_hash) return NextResponse.json({ ok: true })

  const ip = getClientIp(req)
  if (countRecentUnlockAttempts(db, params.token, ip) >= UNLOCK_ATTEMPT_LIMIT) {
    return NextResponse.json({ error: 'Trop de tentatives, réessaie plus tard' }, { status: 429 })
  }

  const { password } = await req.json()
  if (!verifyPassword(password || '', link.password_hash)) {
    recordFailedUnlockAttempt(db, params.token, ip)
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(unlockCookieName(params.token), signUnlock(params.token), {
    httpOnly: true, secure: true, path: '/', maxAge: 86400, sameSite: 'lax',
  })
  return res
}
