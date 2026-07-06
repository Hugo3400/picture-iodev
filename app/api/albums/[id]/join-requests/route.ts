import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { createJoinRequest } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = parseInt(params.id, 10)
  const db = getDb()
  const album = db.prepare('SELECT user_id FROM albums WHERE id = ?').get(albumId) as { user_id: number } | undefined
  if (!album || album.user_id !== user.id) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })

  const requests = db.prepare(
    `SELECT r.id, r.user_id, r.created_at, u.discord_name, u.discord_avatar
     FROM album_join_requests r JOIN users u ON u.id = r.user_id
     WHERE r.album_id = ? AND r.status = 'pending' ORDER BY r.created_at ASC`
  ).all(albumId)

  return NextResponse.json(requests)
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = parseInt(params.id, 10)
  const db = getDb()
  const result = createJoinRequest(db, albumId, user.id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 })
  return NextResponse.json(result.request)
}
