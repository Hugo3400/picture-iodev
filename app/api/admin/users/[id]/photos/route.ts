import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin } from '@/lib/admin'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!isAdmin(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const albums = db.prepare(
    `SELECT a.id, a.name,
       (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id AND p.user_id = ?) AS photo_count
     FROM albums a WHERE a.user_id = ? ORDER BY a.created_at DESC`
  ).all(id, id)

  const rows = db.prepare(
    'SELECT p.* FROM photos p WHERE p.user_id = ? ORDER BY p.created_at DESC'
  ).all(id) as any[]

  const photos = rows.map(p => ({
    ...p,
    url: `/api/file/${p.id}`,
    thumbUrl: p.thumb_filename ? `/api/file/${p.id}?thumb=1` : `/api/file/${p.id}`,
  }))

  return NextResponse.json({ albums, photos })
}
