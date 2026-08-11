import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { generateShareToken, hashPassword } from '@/lib/share'
import { ExpiryChoice, computeExpiresAt } from '@/lib/publicUploads'
import Database from 'better-sqlite3'

const VALID_EXPIRY: ExpiryChoice[] = ['1h', '24h', '7d', '30d', 'never']

// Seul le propriétaire de la photo, ou le propriétaire de l'album qui la contient, peut publier un lien public.
// Un co-éditeur peut éditer le contenu d'un album partagé mais ne peut pas en exposer un lien public.
function canPublishPhoto(db: Database.Database, photoId: number, userId: number) {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as any
  if (!photo) return null
  if (photo.user_id === userId) return photo
  if (photo.album_id) {
    const album = db.prepare('SELECT user_id FROM albums WHERE id = ?').get(photo.album_id) as { user_id: number } | undefined
    if (album && album.user_id === userId) return photo
  }
  return null
}

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type')
  const targetId = req.nextUrl.searchParams.get('target_id')
  if (!type || !targetId) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const db = getDb()
  const link = db.prepare('SELECT token, password_hash, view_count, expires_at FROM share_links WHERE type = ? AND target_id = ?').get(type, targetId) as any
  if (!link) return NextResponse.json({ shared: false })

  return NextResponse.json({
    shared: true,
    token: link.token,
    url: `https://picture.iodev.fr/partage/${link.token}`,
    hasPassword: !!link.password_hash,
    viewCount: link.view_count,
    expiresAt: link.expires_at,
  })
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, target_id, password, expires_in } = await req.json()
  if (!['photo', 'album'].includes(type) || !target_id) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const db = getDb()
  const owns = type === 'photo' ? canPublishPhoto(db, target_id, user.id) : db.prepare('SELECT id FROM albums WHERE id = ? AND user_id = ?').get(target_id, user.id)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = db.prepare('SELECT * FROM share_links WHERE type = ? AND target_id = ?').get(type, target_id) as any

  const passwordHash = password ? hashPassword(password) : null
  // Même fallback sûr que /api/upload : un appelant qui omet expires_in (ou envoie
  // une valeur invalide) ne doit jamais se retrouver avec une expiration surprise.
  const expiry: ExpiryChoice = VALID_EXPIRY.includes(expires_in) ? expires_in : 'never'
  const expiresAt = computeExpiresAt(expiry)

  let token: string
  if (existing) {
    db.prepare('UPDATE share_links SET password_hash = ?, expires_at = ? WHERE id = ?').run(passwordHash, expiresAt, existing.id)
    token = existing.token
  } else {
    token = generateShareToken()
    db.prepare('INSERT INTO share_links (token, type, target_id, password_hash, expires_at) VALUES (?, ?, ?, ?, ?)').run(token, type, target_id, passwordHash, expiresAt)
  }

  return NextResponse.json({ token, url: `https://picture.iodev.fr/partage/${token}`, expiresAt })
}

export async function DELETE(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, target_id } = await req.json()
  const db = getDb()
  const owns = type === 'photo' ? canPublishPhoto(db, target_id, user.id) : db.prepare('SELECT id FROM albums WHERE id = ? AND user_id = ?').get(target_id, user.id)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare('DELETE FROM share_links WHERE type = ? AND target_id = ?').run(type, target_id)
  return NextResponse.json({ ok: true })
}
