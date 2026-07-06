import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/session'
import { verifyUnlock, unlockCookieName } from '@/lib/share'
import { canEditPhoto } from '@/lib/permissions'
import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const photoId = parseInt(params.id, 10)
  if (!photoId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const db = getDb()
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as any
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let allowed = false

  const user = await getSession()
  if (user && canEditPhoto(db, photo, user.id)) allowed = true

  const shareToken = req.nextUrl.searchParams.get('share')
  if (!allowed && shareToken) {
    const link = db.prepare("SELECT * FROM share_links WHERE token = ?").get(shareToken) as any
    if (link) {
      const matches = (link.type === 'photo' && link.target_id === photo.id) ||
        (link.type === 'album' && photo.album_id !== null && link.target_id === photo.album_id)
      if (matches) {
        if (!link.password_hash) {
          allowed = true
        } else {
          const cookieVal = req.cookies.get(unlockCookieName(shareToken))?.value
          allowed = verifyUnlock(shareToken, cookieVal)
        }
      }
    }
  }

  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const wantsThumb = req.nextUrl.searchParams.get('thumb') === '1'
  const servedFilename = wantsThumb && photo.thumb_filename ? photo.thumb_filename : photo.filename

  const filePath = path.join(STORAGE_DIR, String(photo.user_id), servedFilename)
  if (!existsSync(filePath)) return NextResponse.json({ error: 'File missing' }, { status: 404 })

  const ext = servedFilename.split('.').pop()?.toLowerCase() || ''
  const stat = statSync(filePath)
  const stream = createReadStream(filePath)

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
