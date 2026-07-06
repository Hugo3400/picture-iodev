import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { getAlbumAccess } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const username = req.nextUrl.searchParams.get('username')?.trim().replace(/^@/, '')
  if (!username) return NextResponse.json({ error: 'Pseudo Discord requis' }, { status: 400 })

  const db = getDb()
  const target = db.prepare(
    'SELECT id, discord_name, discord_avatar FROM users WHERE LOWER(discord_username) = LOWER(?)'
  ).get(username) as { id: number; discord_name: string; discord_avatar: string | null } | undefined

  if (!target) return NextResponse.json({ error: 'Aucun utilisateur avec ce pseudo' }, { status: 404 })
  if (target.id === user.id) return NextResponse.json({ error: 'Tu ne peux pas te chercher toi-même' }, { status: 400 })

  const albums = db.prepare(
    `SELECT id, name, description, (SELECT COUNT(*) FROM photos p WHERE p.album_id = albums.id) AS photo_count
     FROM albums WHERE user_id = ? ORDER BY created_at DESC`
  ).all(target.id) as { id: number; name: string; description: string | null; photo_count: number }[]

  const pendingRows = db.prepare(
    "SELECT album_id FROM album_join_requests WHERE user_id = ? AND status = 'pending'"
  ).all(user.id) as { album_id: number }[]
  const pendingSet = new Set(pendingRows.map(r => r.album_id))

  const results = albums.map(a => {
    const access = getAlbumAccess(db, a.id, user.id)
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      photoCount: a.photo_count,
      access: access ?? (pendingSet.has(a.id) ? 'pending' : null),
    }
  })

  return NextResponse.json({ user: { discord_name: target.discord_name, discord_avatar: target.discord_avatar }, albums: results })
}
