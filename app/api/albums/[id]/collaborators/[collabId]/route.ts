import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: { id: string; collabId: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = parseInt(params.id, 10)
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId) as any
  if (!album || album.user_id !== user.id) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })

  db.prepare('DELETE FROM album_collaborators WHERE id = ? AND album_id = ?').run(parseInt(params.collabId, 10), albumId)
  return NextResponse.json({ ok: true })
}
