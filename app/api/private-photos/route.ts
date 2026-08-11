import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { getAlbumAccess } from '@/lib/permissions'
import { sniffImageExt } from '@/lib/imageSniff'
import { scanBuffer } from '@/lib/antivirus'
import { generateThumbnail } from '@/lib/thumbnail'
import {
  MAX_PRIVATE_FILE_SIZE, MAX_PRIVATE_FILES_PER_REQUEST, PRIVATE_UPLOAD_BYTES_PER_HOUR,
  sumRecentUploadBytes,
} from '@/lib/privateUploads'
import { getClientIp } from '@/lib/publicUploads'
import { withErrorNotify } from '@/lib/errorNotify'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

export const GET = withErrorNotify('GET', async (req: NextRequest) => {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const albumId = req.nextUrl.searchParams.get('album_id')
  const db = getDb()

  let rows: any[]
  if (albumId) {
    const id = parseInt(albumId, 10)
    if (!getAlbumAccess(db, id, user.id)) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })
    rows = db.prepare(
      `SELECT p.*, u.discord_name AS uploader_name, u.discord_avatar AS uploader_avatar
       FROM photos p JOIN users u ON u.id = p.user_id WHERE p.album_id = ? ORDER BY p.created_at DESC`
    ).all(id)
  } else {
    rows = db.prepare(
      `SELECT p.*, u.discord_name AS uploader_name, u.discord_avatar AS uploader_avatar
       FROM photos p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? ORDER BY p.created_at DESC`
    ).all(user.id)
  }

  const photos = rows.map(p => ({
    ...p,
    url: `/api/file/${p.id}`,
    thumbUrl: p.thumb_filename ? `/api/file/${p.id}?thumb=1` : `/api/file/${p.id}`,
  }))
  return NextResponse.json(photos)
})

export const POST = withErrorNotify('POST', async (req: NextRequest) => {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = getClientIp(req)
  const formData = await req.formData()
  const albumId = formData.get('album_id') ? parseInt(formData.get('album_id') as string, 10) : null
  const duplicateAction = formData.get('duplicate_action') as 'upload_anyway' | 'skip_duplicates' | null
  const files = formData.getAll('files') as File[]
  if (!files.length) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

  if (files.length > MAX_PRIVATE_FILES_PER_REQUEST) {
    return NextResponse.json({ error: `Maximum ${MAX_PRIVATE_FILES_PER_REQUEST} images par envoi` }, { status: 400 })
  }

  const oversized = files.find(f => f.size > MAX_PRIVATE_FILE_SIZE)
  if (oversized) {
    return NextResponse.json({ error: `"${oversized.name}" dépasse la taille maximale de ${MAX_PRIVATE_FILE_SIZE / 1024 / 1024} Mo` }, { status: 400 })
  }

  const db = getDb()
  if (albumId && !getAlbumAccess(db, albumId, user.id)) {
    return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })
  }

  const requestBytes = files.reduce((sum, f) => sum + f.size, 0)
  if (sumRecentUploadBytes(db, user.id) + requestBytes > PRIVATE_UPLOAD_BYTES_PER_HOUR) {
    return NextResponse.json({ error: `Limite atteinte : ${PRIVATE_UPLOAD_BYTES_PER_HOUR / 1024 / 1024} Mo max par heure` }, { status: 429 })
  }

  const prepared: { file: File; bytes: Buffer; ext: string; hash: string }[] = []
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const bytes = Buffer.from(await file.arrayBuffer())
    const ext = sniffImageExt(bytes)
    if (!ext) continue
    const scan = await scanBuffer(bytes)
    if ('infected' in scan && scan.infected) continue
    const hash = crypto.createHash('sha256').update(bytes).digest('hex')
    prepared.push({ file, bytes, ext, hash })
  }

  if (!prepared.length) return NextResponse.json({ error: 'Aucune image valide' }, { status: 400 })

  const findExisting = db.prepare(
    'SELECT id, created_at FROM photos WHERE user_id = ? AND content_hash = ?'
  )
  const duplicates: { name: string; existingCreatedAt: string }[] = []
  const newOnes: typeof prepared = []
  for (const p of prepared) {
    const existing = findExisting.get(user.id, p.hash) as { id: number; created_at: string } | undefined
    if (existing) {
      duplicates.push({ name: p.file.name, existingCreatedAt: existing.created_at })
    } else {
      newOnes.push(p)
    }
  }

  let toUpload = prepared
  if (duplicates.length && duplicateAction !== 'upload_anyway') {
    if (duplicateAction === 'skip_duplicates') {
      toUpload = newOnes
      if (!toUpload.length) {
        return NextResponse.json({ uploaded: [], skippedDuplicates: duplicates.length })
      }
    } else {
      return NextResponse.json({ needsConfirmation: true, duplicates, newCount: newOnes.length })
    }
  }

  const userDir = path.join(STORAGE_DIR, String(user.id))
  if (!existsSync(userDir)) await mkdir(userDir, { recursive: true })

  const uploaded: number[] = []

  for (const { file, bytes, ext, hash } of toUpload) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    await writeFile(path.join(userDir, filename), bytes)

    const thumbBuffer = await generateThumbnail(bytes)
    let thumbFilename: string | null = null
    if (thumbBuffer) {
      thumbFilename = `${filename.replace(/\.[a-zA-Z0-9]+$/, '')}-thumb.webp`
      await writeFile(path.join(userDir, thumbFilename), thumbBuffer)
    }

    const info = db.prepare(
      'INSERT INTO photos (user_id, album_id, filename, original_name, size, thumb_filename, content_hash, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user.id, albumId, filename, file.name, bytes.byteLength, thumbFilename, hash, ip)
    uploaded.push(info.lastInsertRowid as number)
  }

  return NextResponse.json({ uploaded, skippedDuplicates: duplicateAction === 'skip_duplicates' ? duplicates.length : 0 })
})
