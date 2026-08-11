import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyUnlock, unlockCookieName } from '@/lib/share'
import { getSession } from '@/lib/session'
import { getAlbumAccess } from '@/lib/permissions'

// La grille de la page de partage n'a besoin que d'une vignette légère ; le plein
// format n'est chargé qu'au clic (lightbox), via `url`.
function thumbUrl(photo: { id: number; thumb_filename: string | null }, token: string): string {
  return `/api/file/${photo.id}?share=${token}${photo.thumb_filename ? '&thumb=1' : ''}`
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const db = getDb()
  const link = db.prepare('SELECT * FROM share_links WHERE token = ?').get(params.token) as any
  if (!link) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })

  const unlocked = !link.password_hash || verifyUnlock(params.token, req.cookies.get(unlockCookieName(params.token))?.value)
  if (!unlocked) {
    return NextResponse.json({ requiresPassword: true })
  }

  if (link.type === 'photo') {
    const photo = db.prepare('SELECT id, caption, filename, thumb_filename, created_at FROM photos WHERE id = ?').get(link.target_id) as any
    if (!photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
    db.prepare('UPDATE share_links SET view_count = view_count + 1 WHERE id = ?').run(link.id)
    return NextResponse.json({
      requiresPassword: false,
      type: 'photo',
      photos: [{ id: photo.id, caption: photo.caption, url: `/api/file/${photo.id}?share=${params.token}`, thumbUrl: thumbUrl(photo, params.token) }],
    })
  } else {
    const album = db.prepare('SELECT id, name, description FROM albums WHERE id = ?').get(link.target_id) as any
    if (!album) return NextResponse.json({ error: 'Album introuvable' }, { status: 404 })
    const photos = db.prepare('SELECT id, caption, thumb_filename FROM photos WHERE album_id = ? ORDER BY created_at DESC').all(link.target_id) as any[]
    db.prepare('UPDATE share_links SET view_count = view_count + 1 WHERE id = ?').run(link.id)

    const viewer = await getSession()
    let access: 'owner' | 'collaborator' | 'pending' | null | 'anonymous' = 'anonymous'
    if (viewer) {
      access = getAlbumAccess(db, album.id, viewer.id)
      if (!access) {
        const pending = db.prepare("SELECT id FROM album_join_requests WHERE album_id = ? AND user_id = ? AND status = 'pending'").get(album.id, viewer.id)
        access = pending ? 'pending' : null
      }
    }

    return NextResponse.json({
      requiresPassword: false,
      type: 'album',
      album: { name: album.name, description: album.description },
      photos: photos.map(p => ({ id: p.id, caption: p.caption, url: `/api/file/${p.id}?share=${params.token}`, thumbUrl: thumbUrl(p, params.token) })),
      viewerAccess: access,
    })
  }
}
