import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, description } = await req.json()
  db.prepare("UPDATE albums SET name = COALESCE(?, name), description = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name?.trim() || null, description ?? null, id)

  return NextResponse.json(db.prepare('SELECT * FROM albums WHERE id = ?').get(id))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare("DELETE FROM share_links WHERE type = 'album' AND target_id = ?").run(id)
  db.prepare('DELETE FROM albums WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
