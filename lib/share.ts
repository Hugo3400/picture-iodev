import crypto from 'crypto'
import Database from 'better-sqlite3'

if (!process.env.SHARE_SECRET) {
  throw new Error('SHARE_SECRET env var is required (no insecure default — this secret protects share-link passwords and unlock cookies)')
}
const SECRET = process.env.SHARE_SECRET

export function generateShareToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(pwd + SECRET).digest('hex')
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function verifyPassword(pwd: string, hash: string): boolean {
  return timingSafeStringEqual(hashPassword(pwd), hash)
}

export function unlockCookieName(token: string): string {
  return `share_unlock_${token}`
}

export function signUnlock(token: string): string {
  return crypto.createHmac('sha256', SECRET).update(token).digest('hex')
}

export function verifyUnlock(token: string, value: string | undefined): boolean {
  if (!value) return false
  return timingSafeStringEqual(value, signUnlock(token))
}

// expires_at est écrit par computeExpiresAt() (lib/publicUploads.ts) au format ISO
// (new Date().toISOString()) : rester sur une comparaison de string ISO ici, ne pas
// mélanger avec le format SQLite datetime('now') utilisé par created_at.
export function isShareLinkExpired(link: { expires_at: string | null }): boolean {
  return !!link.expires_at && link.expires_at <= new Date().toISOString()
}

export const UNLOCK_ATTEMPT_LIMIT = 10
export const UNLOCK_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

// created_at est au format SQLite (datetime('now')) : le cutoff doit être calculé
// côté SQLite lui-même, sinon la comparaison texte avec un ISOString JS échoue silencieusement.
const unlockWindowModifier = `-${Math.round(UNLOCK_ATTEMPT_WINDOW_MS / 1000)} seconds`

export function countRecentUnlockAttempts(db: Database.Database, token: string, ip: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM share_unlock_attempts WHERE token = ? AND ip = ? AND created_at >= datetime('now', ?)`
  ).get(token, ip, unlockWindowModifier) as { n: number }
  return row.n
}

export function recordFailedUnlockAttempt(db: Database.Database, token: string, ip: string): void {
  db.prepare('INSERT INTO share_unlock_attempts (token, ip) VALUES (?, ?)').run(token, ip)
  db.prepare(`DELETE FROM share_unlock_attempts WHERE created_at < datetime('now', ?)`).run(unlockWindowModifier)
}
