import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/session'
import { verifyUnlock, unlockCookieName, isShareLinkExpired } from '@/lib/share'
import { canEditPhoto } from '@/lib/permissions'
import { EXT_MIME } from '@/lib/fileSniff'
import { resolveServedFilename, parseRangeHeader } from '@/lib/fileServing'
import { isAdmin } from '@/lib/admin'
import { createReadStream, existsSync, statSync } from 'fs'
import { withErrorNotify } from '@/lib/errorNotify'
import { Readable } from 'stream'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

const MIME: Record<string, string> = EXT_MIME

export const GET = withErrorNotify('GET', async (req: NextRequest, { params }: { params: { id: string } }) => {
  const photoId = parseInt(params.id, 10)
  if (!photoId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const db = getDb()
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as any
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let allowed = false

  const user = await getSession()
  if (user && canEditPhoto(db, photo, user.id)) allowed = true
  // Le panel admin doit pouvoir afficher les vignettes/photos de n'importe quel
  // utilisateur en lecture seule, sans en être propriétaire ni passer par un lien
  // de partage.
  if (user && isAdmin(user)) allowed = true

  const shareToken = req.nextUrl.searchParams.get('share')
  if (!allowed && shareToken) {
    const link = db.prepare("SELECT * FROM share_links WHERE token = ?").get(shareToken) as any
    if (link) {
      const matches = (link.type === 'photo' && link.target_id === photo.id) ||
        (link.type === 'album' && photo.album_id !== null && link.target_id === photo.album_id)
      // Un lien expiré ne doit plus donner accès au fichier, même en gardant l'URL
      // directe de l'image (contournement du endpoint /api/share/[token]).
      if (matches && !isShareLinkExpired(link)) {
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

  const servedFilename = resolveServedFilename(photo, {
    thumb: req.nextUrl.searchParams.get('thumb') === '1',
    original: req.nextUrl.searchParams.get('original') === '1',
  })

  const filePath = path.join(STORAGE_DIR, String(photo.user_id), servedFilename)
  if (!existsSync(filePath)) return NextResponse.json({ error: 'File missing' }, { status: 404 })

  const ext = servedFilename.split('.').pop()?.toLowerCase() || ''
  const stat = statSync(filePath)
  const contentType = MIME[ext] || 'application/octet-stream'
  // Le contenu d'une photo ne change jamais une fois uploadé (l'id est stable,
  // seuls la légende/l'album — hors de cette réponse — sont modifiables) :
  // un cache long côté navigateur évite de re-télécharger la même image à
  // chaque navigation dans la galerie.
  const cacheControl = 'private, max-age=31536000, immutable'

  const range = parseRangeHeader(req.headers.get('range'), stat.size)

  // Un Readable Node.js n'est pas un BodyInit valide : le cast `as any` qu'il y
  // avait ici masquait l'erreur de type mais laissait undici gérer un flux Node
  // brut comme corps de réponse, ce qui plante (ERR_INVALID_STATE) dès que le
  // client annule la requête en cours (fréquent avec le lazy-loading d'images).
  if (range) {
    const stream = createReadStream(filePath, { start: range.start, end: range.end })
    const webStream = Readable.toWeb(stream) as ReadableStream
    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(range.end - range.start + 1),
        'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl,
      },
    })
  }

  const stream = createReadStream(filePath)
  const webStream = Readable.toWeb(stream) as ReadableStream

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
    },
  })
})
