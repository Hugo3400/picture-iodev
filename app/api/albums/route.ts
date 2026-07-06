import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const owned = db.prepare(
    `SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count, 'owner' AS role
     FROM albums a WHERE a.user_id = ? ORDER BY a.created_at DESC`
  ).all(user.id)
  const shared = db.prepare(
    `SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count, 'collaborator' AS role,
            u.discord_name AS owner_name
     FROM albums a
     JOIN album_collaborators c ON c.album_id = a.id
     JOIN users u ON u.id = a.user_id
     WHERE c.user_id = ? ORDER BY a.created_at DESC`
  ).all(user.id)

  return NextResponse.json([...owned, ...shared])
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  }

  const db = getDb()
  const info = db.prepare('INSERT INTO albums (user_id, name, description) VALUES (?, ?, ?)').run(user.id, name.trim(), description || null)
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(info.lastInsertRowid)
  return NextResponse.json(album)
}
