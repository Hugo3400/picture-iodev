import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin } from '@/lib/admin'

// Dossier de conformité légale (réquisition judiciaire, signalement) pour un
// compte donné : infos du compte, IP connues (sessions + uploads), historique
// des sessions et fichiers. N'agrège que des données déjà collectées pour cet
// utilisateur — aucune nouvelle capture n'est déclenchée par cette route.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!isAdmin(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const account = db.prepare(
    'SELECT id, email, discord_id, discord_name, discord_username, created_at FROM users WHERE id = ?'
  ).get(id)
  if (!account) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const sessions = db.prepare(
    'SELECT id, created_at, expires_at, user_agent, ip FROM sessions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(id)

  const knownIps = db.prepare(`
    SELECT ip, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen FROM (
      SELECT ip, created_at FROM sessions WHERE user_id = ? AND ip IS NOT NULL
      UNION ALL
      SELECT ip, created_at FROM photos WHERE user_id = ? AND ip IS NOT NULL
    ) GROUP BY ip ORDER BY last_seen DESC
  `).all(id, id)

  const albums = db.prepare(
    `SELECT a.id, a.name,
       (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id AND p.user_id = ?) AS photo_count
     FROM albums a WHERE a.user_id = ? ORDER BY a.created_at DESC`
  ).all(id, id)

  const photos = db.prepare(
    `SELECT id, album_id, filename, original_name, caption, size, nsfw, ip, created_at
     FROM photos WHERE user_id = ? ORDER BY created_at DESC`
  ).all(id)

  const dossier = {
    generated_at: new Date().toISOString(),
    generated_by: user!.discord_name,
    account,
    known_ips: knownIps,
    sessions,
    albums,
    photos,
  }

  return new NextResponse(JSON.stringify(dossier, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="dossier-utilisateur-${id}.json"`,
    },
  })
}
