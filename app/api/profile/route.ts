import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { sumRecentUploadBytes, PRIVATE_UPLOAD_BYTES_PER_HOUR } from '@/lib/privateUploads'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const account = db.prepare('SELECT discord_username, created_at FROM users WHERE id = ?').get(user.id) as { discord_username: string | null; created_at: string }
  const photoStats = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS totalSize FROM photos WHERE user_id = ?').get(user.id) as { count: number; totalSize: number }
  const albumCount = db.prepare('SELECT COUNT(*) AS n FROM albums WHERE user_id = ?').get(user.id) as { n: number }
  // Co-éditeurs invités par cet utilisateur sur SES albums (pas les albums où lui
  // est invité ailleurs : c'est ce que le propriétaire d'un album veut voir ici).
  const collaboratorsOnMyAlbums = db.prepare(
    `SELECT COUNT(*) AS n FROM album_collaborators c JOIN albums a ON a.id = c.album_id WHERE a.user_id = ?`
  ).get(user.id) as { n: number }

  return NextResponse.json({
    discord_id: user.discord_id,
    discord_name: user.discord_name,
    discord_username: account.discord_username,
    discord_avatar: user.discord_avatar,
    member_since: account.created_at,
    photo_count: photoStats.count,
    total_size: photoStats.totalSize,
    album_count: albumCount.n,
    collab_album_count: collaboratorsOnMyAlbums.n,
    uploaded_this_hour: sumRecentUploadBytes(db, user.id),
    upload_hour_limit: PRIVATE_UPLOAD_BYTES_PER_HOUR,
  })
}
