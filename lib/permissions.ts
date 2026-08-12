import Database from 'better-sqlite3'

export type AlbumRole = 'owner' | 'collaborator'

function checkDirectAccess(db: Database.Database, albumId: number, userId: number): AlbumRole | null {
  const album = db.prepare('SELECT user_id FROM albums WHERE id = ?').get(albumId) as { user_id: number } | undefined
  if (!album) return null
  if (album.user_id === userId) return 'owner'
  const collab = db.prepare('SELECT id FROM album_collaborators WHERE album_id = ? AND user_id = ?').get(albumId, userId)
  return collab ? 'collaborator' : null
}

export function getAlbumAccess(db: Database.Database, albumId: number, userId: number): AlbumRole | null {
  const direct = checkDirectAccess(db, albumId, userId)
  if (direct) return direct

  // L'accès à un dossier se propage à tous ses sous-dossiers : si l'accès direct
  // échoue, on remonte la chaîne des ancêtres jusqu'à en trouver un auquel
  // l'utilisateur a accès. `visited` empêche une boucle infinie si parent_id
  // forme un cycle (données corrompues) plutôt que de faire confiance à la DB.
  const visited = new Set<number>([albumId])
  let parent = db.prepare('SELECT parent_id FROM albums WHERE id = ?').get(albumId) as { parent_id: number | null } | undefined
  while (parent?.parent_id != null && !visited.has(parent.parent_id)) {
    const parentId = parent.parent_id
    visited.add(parentId)
    const access = checkDirectAccess(db, parentId, userId)
    if (access) return access
    parent = db.prepare('SELECT parent_id FROM albums WHERE id = ?').get(parentId) as { parent_id: number | null } | undefined
  }
  return null
}

export function canEditPhoto(db: Database.Database, photo: { user_id: number; album_id: number | null }, userId: number): boolean {
  if (photo.user_id === userId) return true
  if (photo.album_id) return getAlbumAccess(db, photo.album_id, userId) !== null
  return false
}

export function createJoinRequest(db: Database.Database, albumId: number, userId: number): { error?: string; status?: number; request?: any } {
  const album = db.prepare('SELECT user_id FROM albums WHERE id = ?').get(albumId) as { user_id: number } | undefined
  if (!album) return { error: 'Album introuvable', status: 404 }
  if (getAlbumAccess(db, albumId, userId)) return { error: 'Tu as déjà accès à cet album', status: 400 }

  const pending = db.prepare("SELECT id FROM album_join_requests WHERE album_id = ? AND user_id = ? AND status = 'pending'").get(albumId, userId)
  if (pending) return { error: 'Demande déjà envoyée, en attente de réponse', status: 400 }

  const info = db.prepare('INSERT INTO album_join_requests (album_id, user_id) VALUES (?, ?)').run(albumId, userId)
  return { request: db.prepare('SELECT * FROM album_join_requests WHERE id = ?').get(info.lastInsertRowid) }
}
