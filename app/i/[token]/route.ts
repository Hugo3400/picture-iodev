import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyUnlock, unlockCookieName, isShareLinkExpired } from '@/lib/share'
import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token.replace(/\.[a-zA-Z0-9]+$/, '')

  const db = getDb()
  const link = db.prepare("SELECT * FROM share_links WHERE token = ? AND type = 'photo'").get(token) as any
  if (!link) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })
  // Le hotlink expose le fichier directement (embed/img src) : il doit s'éteindre
  // en même temps que le lien de partage, pas rester accessible indéfiniment.
  if (isShareLinkExpired(link)) return NextResponse.json({ error: 'Lien expiré' }, { status: 410 })

  if (link.password_hash) {
    const cookieVal = req.cookies.get(unlockCookieName(token))?.value
    if (!verifyUnlock(token, cookieVal)) return NextResponse.json({ error: 'Mot de passe requis' }, { status: 401 })
  }

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(link.target_id) as any
  if (!photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

  const filePath = path.join(STORAGE_DIR, String(photo.user_id), photo.filename)
  if (!existsSync(filePath)) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

  const ext = photo.filename.split('.').pop()?.toLowerCase() || ''
  const stat = statSync(filePath)
  const stream = createReadStream(filePath)

  db.prepare('UPDATE share_links SET view_count = view_count + 1 WHERE id = ?').run(link.id)

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
