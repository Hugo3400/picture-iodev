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

export function createSession(userId: number, userAgent?: string | null): string {
  const db = getDb()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86400 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)').run(token, userId, expiresAt, userAgent || null)
  return token
}

export function deleteSession(token: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export type SessionInfo = { id: number; created_at: string; expires_at: string; user_agent: string | null; current: boolean }

export async function listSessions(userId: number): Promise<SessionInfo[]> {
  const token = (await cookies()).get(COOKIE)?.value
  const rows = getDb().prepare(
    `SELECT id, token, created_at, expires_at, user_agent FROM sessions
     WHERE user_id = ? AND datetime(expires_at) > datetime('now') ORDER BY created_at DESC`
  ).all(userId) as { id: number; token: string; created_at: string; expires_at: string; user_agent: string | null }[]
  return rows.map(r => ({ id: r.id, created_at: r.created_at, expires_at: r.expires_at, user_agent: r.user_agent, current: r.token === token }))
}

export function deleteSessionById(userId: number, id: number): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, userId)
}

export function deleteOtherSessions(userId: number, keepToken: string): number {
  const info = getDb().prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(userId, keepToken)
  return info.changes
}

export const SESSION_COOKIE = COOKIE
export const TTL = TTL_DAYS
