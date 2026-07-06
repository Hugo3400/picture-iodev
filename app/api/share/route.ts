import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { generateShareToken, hashPassword } from '@/lib/share'
import Database from 'better-sqlite3'

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
  const link = db.prepare('SELECT token, password_hash, view_count FROM share_links WHERE type = ? AND target_id = ?').get(type, targetId) as any
  if (!link) return NextResponse.json({ shared: false })

  return NextResponse.json({
    shared: true,
    token: link.token,
    url: `https://picture.iodev.fr/partage/${link.token}`,
    hasPassword: !!link.password_hash,
    viewCount: link.view_count,
  })
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, target_id, password } = await req.json()
  if (!['photo', 'album'].includes(type) || !target_id) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const db = getDb()
  const owns = type === 'photo' ? canPublishPhoto(db, target_id, user.id) : db.prepare('SELECT id FROM albums WHERE id = ? AND user_id = ?').get(target_id, user.id)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = db.prepare('SELECT * FROM share_links WHERE type = ? AND target_id = ?').get(type, target_id) as any

  const passwordHash = password ? hashPassword(password) : null

  let token: string
  if (existing) {
    db.prepare('UPDATE share_links SET password_hash = ? WHERE id = ?').run(passwordHash, existing.id)
    token = existing.token
  } else {
    token = generateShareToken()
    db.prepare('INSERT INTO share_links (token, type, target_id, password_hash) VALUES (?, ?, ?, ?)').run(token, type, target_id, passwordHash)
  }

  return NextResponse.json({ token, url: `https://picture.iodev.fr/partage/${token}` })
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
