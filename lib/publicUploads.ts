import Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'

export const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 Mo par image
export const MAX_FILES_PER_REQUEST = 10
export const RATE_LIMIT_COUNT = 20 // uploads max par IP
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // par heure

export function getClientIp(req: NextRequest): string {
  // Le site est derrière Cloudflare : CF-Connecting-IP est posé par Cloudflare
  // lui-même (il écrase toute valeur envoyée par le client) et identifie le
  // vrai visiteur de façon stable, contrairement à $remote_addr vu par nginx
  // qui correspond au nœud Cloudflare de sortie et change à chaque requête.
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  // Sinon, nginx ajoute (append) $remote_addr en dernière position de
  // X-Forwarded-For sans jamais écraser ce qu'envoie le client — prendre le
  // premier élément laisserait un client forger n'importe quelle IP pour
  // contourner le rate-limit. Le dernier élément est celui observé
  // directement par notre reverse proxy, donc non falsifiable par le client.
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return req.headers.get('x-real-ip') || 'unknown'
}

export function countRecentUploads(db: Database.Database, ip: string): number {
  // created_at est au format SQLite (datetime('now'), sans "T"/"Z") : comparer avec
  // un cutoff JS (toISOString) casse silencieusement la comparaison texte. On calcule
  // donc le cutoff côté SQLite pour rester dans le même format.
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM public_uploads WHERE ip = ? AND created_at >= datetime('now', ?)`
  ).get(ip, `-${Math.round(RATE_LIMIT_WINDOW_MS / 1000)} seconds`) as { n: number }
  return row.n
}

export type ExpiryChoice = '1h' | '24h' | '7d' | '30d' | 'never'

const DURATIONS_MS: Record<Exclude<ExpiryChoice, 'never'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export function computeExpiresAt(choice: ExpiryChoice): string | null {
  if (choice === 'never') return null
  return new Date(Date.now() + DURATIONS_MS[choice]).toISOString()
}

export function cleanupExpiredPublicUploads(db: Database.Database) {
  const now = new Date().toISOString()
  const expired = db.prepare(
    'SELECT filename FROM public_uploads WHERE expires_at IS NOT NULL AND expires_at <= ?'
  ).all(now) as { filename: string }[]

  for (const row of expired) {
    const filePath = path.join(UPLOADS_DIR, row.filename)
    if (existsSync(filePath)) unlinkSync(filePath)

    // La vignette suit la convention "<base>-thumb.webp" (voir app/api/upload/route.ts) :
    // pas de colonne dédiée, donc on la retrouve par convention pour éviter un fichier orphelin.
    const thumbPath = path.join(UPLOADS_DIR, `${row.filename.replace(/\.[a-zA-Z0-9]+$/, '')}-thumb.webp`)
    if (existsSync(thumbPath)) unlinkSync(thumbPath)
  }

  db.prepare('DELETE FROM public_uploads WHERE expires_at IS NOT NULL AND expires_at <= ?').run(now)
}
