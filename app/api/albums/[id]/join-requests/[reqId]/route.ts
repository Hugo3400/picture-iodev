import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; reqId: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = parseInt(params.id, 10)
  const reqId = parseInt(params.reqId, 10)
  const db = getDb()

  const album = db.prepare('SELECT user_id FROM albums WHERE id = ?').get(albumId) as { user_id: number } | undefined
  if (!album || album.user_id !== user.id) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })

  const request = db.prepare(
    "SELECT * FROM album_join_requests WHERE id = ? AND album_id = ? AND status = 'pending'"
  ).get(reqId, albumId) as { id: number; user_id: number } | undefined
  if (!request) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  const { action } = await req.json()
  if (action !== 'accept' && action !== 'refuse') return NextResponse.json({ error: 'Action invalide' }, { status: 400 })

  if (action === 'accept') {
    const requester = db.prepare('SELECT discord_username, discord_name FROM users WHERE id = ?').get(request.user_id) as { discord_username: string | null; discord_name: string } | undefined
    const invitedName = requester?.discord_username || requester?.discord_name || 'utilisateur'
    db.prepare('INSERT INTO album_collaborators (album_id, invited_name, user_id) VALUES (?, ?, ?)').run(albumId, invitedName, request.user_id)
    db.prepare("UPDATE album_join_requests SET status = 'accepted' WHERE id = ?").run(reqId)
  } else {
    db.prepare("UPDATE album_join_requests SET status = 'refused' WHERE id = ?").run(reqId)
  }

  return NextResponse.json({ ok: true })
}
