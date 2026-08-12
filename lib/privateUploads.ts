import Database from 'better-sqlite3'

export const MAX_PRIVATE_FILE_SIZE = 25 * 1024 * 1024 // 25 Mo par image
export const MAX_VIDEO_FILE_SIZE = 500 * 1024 * 1024 // 500 Mo par vidéo
export const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024 // 2 Mo par fichier texte
export const MAX_ARCHIVE_FILE_SIZE = 150 * 1024 * 1024 // 150 Mo par archive RAR
export const MAX_PRIVATE_FILES_PER_REQUEST = 20
export const PRIVATE_UPLOAD_BYTES_PER_HOUR = 300 * 1024 * 1024 // 300 Mo / heure / utilisateur

export function sumRecentUploadBytes(db: Database.Database, userId: number): number {
  // photos.created_at est au format SQLite (datetime('now')) : cutoff calculé côté SQLite
  // pour éviter le mismatch de format avec un ISOString JS.
  const row = db.prepare(
    `SELECT COALESCE(SUM(size), 0) AS total FROM photos WHERE user_id = ? AND created_at >= datetime('now', '-1 hours')`
  ).get(userId) as { total: number }
  return row.total
}
