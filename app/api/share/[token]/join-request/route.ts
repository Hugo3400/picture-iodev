import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { createJoinRequest } from '@/lib/permissions'

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Connecte-toi avec Discord pour demander l\'accès' }, { status: 401 })

  const db = getDb()
  const link = db.prepare('SELECT * FROM share_links WHERE token = ?').get(params.token) as any
  if (!link) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })
  if (link.type !== 'album') return NextResponse.json({ error: 'Cette demande ne concerne que les albums' }, { status: 400 })

  const result = createJoinRequest(db, link.target_id, user.id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 })
  return NextResponse.json(result.request)
}
