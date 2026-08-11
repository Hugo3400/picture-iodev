import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getDb } from '@/lib/db'
import {
  UPLOADS_DIR, computeExpiresAt, cleanupExpiredPublicUploads, ExpiryChoice,
  MAX_FILE_SIZE, MAX_FILES_PER_REQUEST, RATE_LIMIT_COUNT, getClientIp, countRecentUploads,
} from '@/lib/publicUploads'
import { sniffImageExt } from '@/lib/imageSniff'
import { generateThumbnail } from '@/lib/thumbnail'
import path from 'path'

export const dynamic = 'force-dynamic'

const VALID_EXPIRY: ExpiryChoice[] = ['1h', '24h', '7d', '30d', 'never']

export async function POST(req: NextRequest) {
  const db = getDb()
  cleanupExpiredPublicUploads(db)

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  // Les clients externes (ex. l'app photo de LB Phone) postent l'image
  // directement sans jamais fournir "expires_in" : sans ce fallback sur
  // "never", ces uploads héritaient silencieusement d'une expiration de 24h.
  const expiryRaw = formData.get('expires_in') as string
  const expiry: ExpiryChoice = VALID_EXPIRY.includes(expiryRaw as ExpiryChoice) ? (expiryRaw as ExpiryChoice) : 'never'
  const expiresAt = computeExpiresAt(expiry)

  const files = (formData.getAll('files') as File[]).filter(f => f.type.startsWith('image/'))
  if (!files.length) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES_PER_REQUEST} images par envoi` }, { status: 400 })
  }

  const oversized = files.find(f => f.size > MAX_FILE_SIZE)
  if (oversized) {
    return NextResponse.json({ error: `"${oversized.name}" dépasse la taille maximale de ${MAX_FILE_SIZE / 1024 / 1024} Mo` }, { status: 400 })
  }

  const ip = getClientIp(req)
  const recentCount = countRecentUploads(db, ip)
  if (recentCount + files.length > RATE_LIMIT_COUNT) {
    return NextResponse.json({ error: `Limite atteinte : ${RATE_LIMIT_COUNT} images max par heure et par IP` }, { status: 429 })
  }

  // Le Content-Type déclaré par le client est falsifiable : on lit le contenu
  // de chaque fichier et on vérifie les magic bytes avant d'écrire quoi que ce soit.
  const withBytes: { file: File; bytes: Buffer; ext: string }[] = []
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const ext = sniffImageExt(bytes)
    if (!ext) {
      return NextResponse.json({ error: `"${file.name}" n'est pas une image valide` }, { status: 400 })
    }
    withBytes.push({ file, bytes, ext })
  }

  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true })
  }

  const uploaded: { filename: string; url: string; thumbUrl?: string; expiresAt: string | null }[] = []
  for (const { file, bytes, ext } of withBytes) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    await writeFile(path.join(UPLOADS_DIR, filename), bytes)

    // Vignette utilisée uniquement pour l'aperçu 48x48 de l'historique côté client :
    // sans elle, cet aperçu re-téléchargeait l'image en pleine résolution.
    const thumbBuffer = await generateThumbnail(bytes)
    let thumbFilename: string | null = null
    if (thumbBuffer) {
      thumbFilename = `${filename.replace(/\.[a-zA-Z0-9]+$/, '')}-thumb.webp`
      await writeFile(path.join(UPLOADS_DIR, thumbFilename), thumbBuffer)
    }

    db.prepare(
      'INSERT INTO public_uploads (filename, original_name, size, expires_at, ip) VALUES (?, ?, ?, ?, ?)'
    ).run(filename, file.name, bytes.byteLength, expiresAt, ip)

    uploaded.push({ filename, url: `/uploads/${filename}`, thumbUrl: thumbFilename ? `/uploads/${thumbFilename}` : undefined, expiresAt })
  }

  return NextResponse.json({ uploaded })
}
