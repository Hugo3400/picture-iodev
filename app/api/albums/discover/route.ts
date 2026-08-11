import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'

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
     FROM albums WHERE user_id = ? AND unlisted = 0 ORDER BY created_at DESC`
  ).all(target.id) as { id: number; name: string; description: string | null; photo_count: number }[]

  const pendingRows = db.prepare(
    "SELECT album_id FROM album_join_requests WHERE user_id = ? AND status = 'pending'"
  ).all(user.id) as { album_id: number }[]
  const pendingSet = new Set(pendingRows.map(r => r.album_id))

  // target.id !== user.id (vérifié plus haut) donc ces albums ne peuvent jamais
  // appartenir à l'utilisateur courant : seul le statut "collaborateur" est
  // possible, qu'on récupère en une seule requête au lieu d'un aller-retour
  // getAlbumAccess() par album.
  const albumIds = albums.map(a => a.id)
  const collabSet = new Set<number>()
  if (albumIds.length) {
    const placeholders = albumIds.map(() => '?').join(',')
    const collabRows = db.prepare(
      `SELECT album_id FROM album_collaborators WHERE user_id = ? AND album_id IN (${placeholders})`
    ).all(user.id, ...albumIds) as { album_id: number }[]
    collabRows.forEach(r => collabSet.add(r.album_id))
  }

  const results = albums.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    photoCount: a.photo_count,
    access: collabSet.has(a.id) ? 'collaborator' : (pendingSet.has(a.id) ? 'pending' : null),
  }))

  return NextResponse.json({ user: { discord_name: target.discord_name, discord_avatar: target.discord_avatar }, albums: results })
}
