import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { getAlbumAccess } from '@/lib/permissions'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = parseInt(params.id, 10)
  const db = getDb()
  if (!getAlbumAccess(db, albumId, user.id)) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })

  const collaborators = db.prepare(
    `SELECT c.id, c.invited_name, c.user_id, c.created_at, u.discord_name, u.discord_avatar
     FROM album_collaborators c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.album_id = ? ORDER BY c.created_at ASC`
  ).all(albumId)

  return NextResponse.json(collaborators)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = parseInt(params.id, 10)
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId) as any
  if (!album || album.user_id !== user.id) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })

  const { discord_tag } = await req.json()
  const tag = typeof discord_tag === 'string' ? discord_tag.trim().replace(/^@/, '') : ''
  if (!tag) return NextResponse.json({ error: 'Pseudo Discord requis' }, { status: 400 })

  const existingCollab = db.prepare('SELECT id FROM album_collaborators WHERE album_id = ? AND LOWER(invited_name) = LOWER(?)').get(albumId, tag)
  if (existingCollab) return NextResponse.json({ error: 'Déjà invité sur cet album' }, { status: 400 })

  const matchedUser = db.prepare('SELECT id FROM users WHERE LOWER(discord_username) = LOWER(?)').get(tag) as { id: number } | undefined
  if (matchedUser && matchedUser.id === user.id) {
    return NextResponse.json({ error: 'Tu ne peux pas t\'inviter toi-même' }, { status: 400 })
  }

  const info = db.prepare('INSERT INTO album_collaborators (album_id, invited_name, user_id) VALUES (?, ?, ?)').run(albumId, tag, matchedUser?.id ?? null)
  const collaborator = db.prepare(
    `SELECT c.id, c.invited_name, c.user_id, c.created_at, u.discord_name, u.discord_avatar
     FROM album_collaborators c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`
  ).get(info.lastInsertRowid)

  return NextResponse.json(collaborator)
}
