import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin } from '@/lib/admin'
import { UPLOADS_DIR } from '@/lib/publicUploads'
import { existsSync } from 'fs'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!isAdmin(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const row = db.prepare('SELECT filename FROM public_uploads WHERE id = ?').get(id) as { filename: string } | undefined
  if (!row) return NextResponse.json({ error: 'Upload introuvable' }, { status: 404 })

  db.prepare('DELETE FROM public_uploads WHERE id = ?').run(id)

  const filePath = path.join(UPLOADS_DIR, row.filename)
  if (existsSync(filePath)) await unlink(filePath)

  return NextResponse.json({ ok: true })
}
