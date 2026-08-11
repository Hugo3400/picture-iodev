import { cookies } from 'next/headers'
import { getDb } from './db'
import crypto from 'crypto'

const COOKIE = 'pic_session'
const TTL_DAYS = 30

export type SessionUser = {
  id: number
  discord_id: string | null
  discord_name: string
  discord_avatar: string | null
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null

  const db = getDb()
  const row = db.prepare(
    `SELECT u.id, u.discord_id, u.discord_name, u.discord_avatar
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
  ).get(token) as SessionUser | undefined

  return row ?? null
}

export function generateToken(): string {
  return crypto.randomBytes(48).toString('hex')
}

export function createSession(userId: number): string {
  const db = getDb()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86400 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt)
  return token
}

export function deleteSession(token: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export const SESSION_COOKIE = COOKIE
export const TTL = TTL_DAYS
