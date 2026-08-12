import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { canEditPhoto, getAlbumAccess } from '@/lib/permissions'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as any
  if (!photo || !canEditPhoto(db, photo, user.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { caption, album_id, nsfw } = await req.json()

  if (album_id !== undefined && album_id !== null) {
    if (!getAlbumAccess(db, album_id, user.id)) return NextResponse.json({ error: 'Album invalide' }, { status: 400 })
  }

  db.prepare('UPDATE photos SET caption = COALESCE(?, caption), album_id = ?, nsfw = COALESCE(?, nsfw) WHERE id = ?')
    .run(caption ?? null, album_id === undefined ? photo.album_id : album_id, nsfw === undefined ? null : (nsfw ? 1 : 0), id)

  return NextResponse.json(db.prepare('SELECT * FROM photos WHERE id = ?').get(id))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as any
  if (!photo || !canEditPhoto(db, photo, user.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare("DELETE FROM share_links WHERE type = 'photo' AND target_id = ?").run(id)
  db.prepare('DELETE FROM photos WHERE id = ?').run(id)

  const filePath = path.join(STORAGE_DIR, String(photo.user_id), photo.filename)
  if (existsSync(filePath)) await unlink(filePath)

  if (photo.compressed_filename) {
    const compressedPath = path.join(STORAGE_DIR, String(photo.user_id), photo.compressed_filename)
    if (existsSync(compressedPath)) await unlink(compressedPath)
  }

  return NextResponse.json({ ok: true })
}
