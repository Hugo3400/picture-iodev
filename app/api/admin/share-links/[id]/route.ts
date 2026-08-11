import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin } from '@/lib/admin'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!isAdmin(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const info = db.prepare('DELETE FROM share_links WHERE id = ?').run(id)
  if (info.changes === 0) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
