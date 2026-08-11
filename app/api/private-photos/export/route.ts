import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { getAlbumAccess } from '@/lib/permissions'
import { Readable } from 'stream'
import archiver from 'archiver'
import { withErrorNotify } from '@/lib/errorNotify'
import path from 'path'
import { existsSync } from 'fs'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

export const GET = withErrorNotify('GET', async (req: NextRequest) => {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = req.nextUrl.searchParams.get('album_id')
  const db = getDb()

  let rows: { id: number; user_id: number; filename: string; original_name: string | null }[]
  let zipName = 'mes-photos.zip'
  if (albumId) {
    const id = parseInt(albumId, 10)
    const access = getAlbumAccess(db, id, user.id)
    if (!access) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })
    const album = db.prepare('SELECT name FROM albums WHERE id = ?').get(id) as { name: string }
    zipName = `${album.name.replace(/[^a-z0-9-_ ]/gi, '_')}.zip`
    rows = db.prepare('SELECT id, user_id, filename, original_name FROM photos WHERE album_id = ?').all(id) as typeof rows
  } else {
    rows = db.prepare('SELECT id, user_id, filename, original_name FROM photos WHERE user_id = ?').all(user.id) as typeof rows
  }

  if (!rows.length) return NextResponse.json({ error: 'Aucune photo à exporter' }, { status: 404 })

  const archive = archiver('zip', { zlib: { level: 6 } })
  const usedNames = new Set<string>()
  for (const p of rows) {
    const filePath = path.join(STORAGE_DIR, String(p.user_id), p.filename)
    if (!existsSync(filePath)) continue
    let name = p.original_name || p.filename
    if (usedNames.has(name)) {
      const ext = path.extname(name)
      name = `${name.slice(0, -ext.length || undefined)}-${p.id}${ext}`
    }
    usedNames.add(name)
    archive.file(filePath, { name })
  }
  archive.finalize()

  return new NextResponse(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
    },
  })
})
