import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin } from '@/lib/admin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!isAdmin(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const photo = db.prepare('SELECT id FROM photos WHERE id = ?').get(id)
  if (!photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

  const { nsfw } = await req.json()
  db.prepare('UPDATE photos SET nsfw = ? WHERE id = ?').run(nsfw ? 1 : 0, id)

  return NextResponse.json(db.prepare('SELECT * FROM photos WHERE id = ?').get(id))
}
