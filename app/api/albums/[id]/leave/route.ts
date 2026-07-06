import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = parseInt(params.id, 10)
  const db = getDb()

  const collab = db.prepare(
    'SELECT id FROM album_collaborators WHERE album_id = ? AND user_id = ?'
  ).get(albumId, user.id) as { id: number } | undefined
  if (!collab) return NextResponse.json({ error: "Tu ne fais pas partie de cet album" }, { status: 404 })

  db.prepare('DELETE FROM album_collaborators WHERE id = ?').run(collab.id)
  return NextResponse.json({ ok: true })
}
