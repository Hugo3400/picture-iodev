import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin } from '@/lib/admin'
import { rm } from 'fs/promises'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!isAdmin(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (id === user!.id) {
    return NextResponse.json({ error: 'Impossible de supprimer son propre compte depuis le panel admin' }, { status: 400 })
  }

  const db = getDb()
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  // Les FK ON DELETE CASCADE (albums, photos, sessions, album_collaborators)
  // s'occupent des lignes liées, mais pas des fichiers sur disque.
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  await rm(path.join(STORAGE_DIR, String(id)), { recursive: true, force: true })

  return NextResponse.json({ ok: true })
}
