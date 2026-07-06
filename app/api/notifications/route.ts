import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()

  const invites = db.prepare(
    `SELECT c.id, a.id AS album_id, a.name AS album_name, u.discord_name AS owner_name, c.created_at
     FROM album_collaborators c
     JOIN albums a ON a.id = c.album_id
     JOIN users u ON u.id = a.user_id
     WHERE c.user_id = ? AND c.seen = 0
     ORDER BY c.created_at DESC`
  ).all(user.id)

  const joinRequests = db.prepare(
    `SELECT r.id, r.album_id, a.name AS album_name, r.user_id, u.discord_name, u.discord_avatar, r.created_at
     FROM album_join_requests r
     JOIN albums a ON a.id = r.album_id
     JOIN users u ON u.id = r.user_id
     WHERE a.user_id = ? AND r.status = 'pending'
     ORDER BY r.created_at ASC`
  ).all(user.id)

  return NextResponse.json({ invites, joinRequests })
}
