import crypto from 'crypto'
import Database from 'better-sqlite3'

const SCRYPT_KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN)
  const storedBuf = Buffer.from(hashHex, 'hex')
  // scryptSync renvoie toujours SCRYPT_KEYLEN octets ; storedBuf peut différer en
  // longueur si le hash stocké est corrompu — timingSafeEqual exige des tailles égales.
  if (hash.length !== storedBuf.length) return false
  return crypto.timingSafeEqual(hash, storedBuf)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email)
}

export function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8 && password.length <= 200
}

export const LOGIN_ATTEMPT_LIMIT = 10
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

// created_at est au format SQLite (datetime('now')) : le cutoff doit être calculé
// côté SQLite lui-même, sinon la comparaison texte avec un ISOString JS échoue silencieusement.
const loginWindowModifier = `-${Math.round(LOGIN_ATTEMPT_WINDOW_MS / 1000)} seconds`

export function countRecentLoginAttempts(db: Database.Database, ip: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND created_at >= datetime('now', ?)`
  ).get(ip, loginWindowModifier) as { n: number }
  return row.n
}

export function recordFailedLoginAttempt(db: Database.Database, ip: string): void {
  db.prepare('INSERT INTO login_attempts (ip) VALUES (?)').run(ip)
  db.prepare(`DELETE FROM login_attempts WHERE created_at < datetime('now', ?)`).run(loginWindowModifier)
}

// Fenêtre plus large que le login (1h vs 15 min) : la création de compte est un
// événement rare pour un utilisateur légitime, contrairement aux tentatives de
// connexion — pas besoin d'un délai aussi court pour freiner le spam de comptes.
export const REGISTER_ATTEMPT_LIMIT = 5
export const REGISTER_ATTEMPT_WINDOW_MS = 60 * 60 * 1000
const registerWindowModifier = `-${Math.round(REGISTER_ATTEMPT_WINDOW_MS / 1000)} seconds`

export function countRecentRegisterAttempts(db: Database.Database, ip: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM register_attempts WHERE ip = ? AND created_at >= datetime('now', ?)`
  ).get(ip, registerWindowModifier) as { n: number }
  return row.n
}

export function recordRegisterAttempt(db: Database.Database, ip: string): void {
  db.prepare('INSERT INTO register_attempts (ip) VALUES (?)').run(ip)
  db.prepare(`DELETE FROM register_attempts WHERE created_at < datetime('now', ?)`).run(registerWindowModifier)
}
