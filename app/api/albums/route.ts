import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { getAlbumAccess } from '@/lib/permissions'

// Renvoie la liste plate de TOUS les albums accessibles (tous niveaux de
// profondeur confondus, parent_id inclus via a.*) : le front construit
// l'arborescence de la sidebar et dérive "les sous-dossiers directs de X" en
// filtrant côté client sur parent_id, plutôt que via un paramètre serveur.
export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const owned = db.prepare(
    `SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count, 'owner' AS role
     FROM albums a WHERE a.user_id = ? ORDER BY a.created_at DESC`
  ).all(user.id)
  // L'accès collaborateur se propage aux sous-dossiers (cf. getAlbumAccess) : on ne
  // peut donc pas se limiter aux albums directement listés dans album_collaborators,
  // il faut aussi remonter tous leurs descendants via une CTE récursive. UNION (et non
  // UNION ALL) élimine les doublons, ce qui rend la récursion sûre même si parent_id
  // formait un cycle (données corrompues) : l'ensemble de résultats est borné par le
  // nombre total d'albums, la récursion converge donc toujours.
  const shared = db.prepare(
    `WITH RECURSIVE collab_roots AS (
       SELECT DISTINCT a.id FROM albums a JOIN album_collaborators c ON c.album_id = a.id WHERE c.user_id = ?
     ),
     descendants AS (
       SELECT id FROM collab_roots
       UNION
       SELECT a.id FROM albums a JOIN descendants d ON a.parent_id = d.id
     )
     SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count, 'collaborator' AS role,
            u.discord_name AS owner_name
     FROM albums a
     JOIN descendants d ON d.id = a.id
     JOIN users u ON u.id = a.user_id
     WHERE a.user_id != ?
     ORDER BY a.created_at DESC`
  ).all(user.id, user.id)

  return NextResponse.json([...owned, ...shared])
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, parent_id } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  }

  const db = getDb()
  let parentId: number | null = null
  if (parent_id !== undefined && parent_id !== null) {
    parentId = parseInt(parent_id, 10)
    // On ne peut créer un sous-dossier que dans un album auquel on a déjà accès
    // (propriétaire ou collaborateur, héritage inclus).
    if (!getAlbumAccess(db, parentId, user.id)) return NextResponse.json({ error: 'Album parent introuvable' }, { status: 404 })
  }

  const info = db.prepare('INSERT INTO albums (user_id, name, description, parent_id) VALUES (?, ?, ?, ?)').run(user.id, name.trim(), description || null, parentId)
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(info.lastInsertRowid)
  return NextResponse.json(album)
}
