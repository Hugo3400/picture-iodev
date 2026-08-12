import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import Database from 'better-sqlite3'

// Vrai si candidateParentId est movingId lui-même, ou l'un de ses descendants —
// dans les deux cas, placer movingId sous candidateParentId créerait un cycle.
// `visited` protège contre une boucle infinie si parent_id contient déjà un
// cycle en base (données corrompues), comme dans getAlbumAccess.
function isSelfOrDescendant(db: Database.Database, movingId: number, candidateParentId: number): boolean {
  let current: number | null = candidateParentId
  const visited = new Set<number>()
  while (current != null) {
    if (current === movingId) return true
    if (visited.has(current)) return false
    visited.add(current)
    const row = db.prepare('SELECT parent_id FROM albums WHERE id = ?').get(current) as { parent_id: number | null } | undefined
    current = row ? row.parent_id : null
  }
  return false
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, unlisted } = body

  // Déplacement d'album : seul le propriétaire peut y toucher (déjà garanti par le
  // SELECT ci-dessus), et seulement vers un album qu'il possède lui aussi — pas
  // question de déplacer un dossier dans l'album partagé de quelqu'un d'autre.
  // 'parent_id' in body distingue "champ omis" (ne pas toucher) de "null explicite"
  // (remonter à la racine), ce que COALESCE ne peut pas exprimer.
  let parentId: number | null | undefined
  if ('parent_id' in body) {
    if (body.parent_id === null) {
      parentId = null
    } else {
      const target = parseInt(body.parent_id, 10)
      const targetParent = db.prepare('SELECT id, user_id FROM albums WHERE id = ?').get(target) as { id: number; user_id: number } | undefined
      if (!targetParent) return NextResponse.json({ error: 'Album parent introuvable' }, { status: 404 })
      if (targetParent.user_id !== user.id) return NextResponse.json({ error: "Impossible de déplacer un album dans le dossier d'un autre utilisateur" }, { status: 403 })
      if (isSelfOrDescendant(db, id, target)) return NextResponse.json({ error: 'Déplacement impossible : un dossier ne peut pas être déplacé dans lui-même ou l\'un de ses sous-dossiers' }, { status: 400 })
      parentId = target
    }
  }

  // COALESCE(?, col) : un champ omis (undefined -> null en param) laisse la valeur
  // existante intacte au lieu de l'écraser (avant ce fix, chaque renommage effaçait
  // silencieusement la description puisqu'elle n'est jamais envoyée par ce flux).
  db.prepare(
    "UPDATE albums SET name = COALESCE(?, name), description = COALESCE(?, description), unlisted = COALESCE(?, unlisted), updated_at = datetime('now') WHERE id = ?"
  ).run(name?.trim() || null, description ?? null, typeof unlisted === 'boolean' ? (unlisted ? 1 : 0) : null, id)

  if (parentId !== undefined) {
    db.prepare('UPDATE albums SET parent_id = ? WHERE id = ?').run(parentId, id)
  }

  return NextResponse.json(db.prepare('SELECT * FROM albums WHERE id = ?').get(id))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE id = ? AND user_id = ?').get(id, user.id)
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare("DELETE FROM share_links WHERE type = 'album' AND target_id = ?").run(id)
  db.prepare('DELETE FROM albums WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
