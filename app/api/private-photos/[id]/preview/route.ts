import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { canEditPhoto } from '@/lib/permissions'
import { withErrorNotify } from '@/lib/errorNotify'
import { createExtractorFromData } from 'node-unrar-js'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')
const MAX_TEXT_PREVIEW_BYTES = 200 * 1024

export const GET = withErrorNotify('GET', async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const db = getDb()
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as any
  if (!photo || !canEditPhoto(db, photo, user.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = path.join(STORAGE_DIR, String(photo.user_id), photo.filename)
  if (!existsSync(filePath)) return NextResponse.json({ error: 'File missing' }, { status: 404 })

  if (photo.file_type === 'text') {
    const buf = await readFile(filePath)
    const truncated = buf.byteLength > MAX_TEXT_PREVIEW_BYTES
    const content = buf.subarray(0, MAX_TEXT_PREVIEW_BYTES).toString('utf-8')
    return NextResponse.json({ type: 'text', content, truncated })
  }

  if (photo.file_type === 'archive') {
    const buf = await readFile(filePath)
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

    try {
      const extractor = await createExtractorFromData({ data: arrayBuf })
      const list = extractor.getFileList()
      // Les itérateurs `fileHeaders`/`files` de node-unrar-js doivent être
      // consommés jusqu'au bout (documenté par le package) sous peine de fuite
      // mémoire côté objet C++ sous-jacent : le spread ci-dessous s'en charge.
      const entries = Array.from(list.fileHeaders)
        .filter(h => !h.flags.directory)
        .map(h => ({ name: h.name, size: h.unpSize }))
      return NextResponse.json({ type: 'archive', entries })
    } catch {
      return NextResponse.json({ error: 'Archive invalide ou corrompue' }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'Type de fichier non prévisualisable via cette route' }, { status: 400 })
})
