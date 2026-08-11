import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'

let dbPath: string
let currentUser: any = null

vi.mock('@/lib/session', () => ({
  getSession: async () => currentUser,
}))

const adminUser = { id: 1, discord_id: '999', discord_name: 'Admin', discord_avatar: null }
const regularUser = { id: 2, discord_id: '123', discord_name: 'Alice', discord_avatar: null }

beforeAll(async () => {
  dbPath = path.join(os.tmpdir(), `test-admin-export-${Date.now()}-${Math.random()}.db`)
  process.env.DB_PATH = dbPath
  process.env.ADMIN_DISCORD_IDS = '999'

  const { getDb } = await import('@/lib/db')
  const db = getDb()
  db.prepare("INSERT INTO users (id, discord_id, discord_name, discord_username) VALUES (2, '123', 'Alice', 'alice')").run()
  // Deux sessions, une IP réutilisée entre une session et un upload : known_ips
  // doit dédupliquer et garder le min/max des dates observées pour cette IP.
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at, ip, user_agent) VALUES ('t1', 2, '2999-01-01', '2024-01-01 10:00:00', '1.2.3.4', 'Mozilla/5.0')").run()
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at, ip, user_agent) VALUES ('t2', 2, '2999-01-01', '2024-03-01 10:00:00', '5.6.7.8', 'curl/8.0')").run()
  db.prepare("INSERT INTO photos (id, user_id, filename, size, created_at, ip) VALUES (100, 2, 'a.jpg', 10, '2024-02-01 10:00:00', '1.2.3.4')").run()
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true })
})

describe('GET /api/admin/users/[id]/export', () => {
  it('refuse un utilisateur non admin (403)', async () => {
    currentUser = regularUser
    const { GET } = await import('../app/api/admin/users/[id]/export/route')
    const res = await GET(new NextRequest('http://localhost/api/admin/users/2/export'), { params: { id: '2' } })
    expect(res.status).toBe(403)
  })

  it('renvoie 404 pour un utilisateur inexistant', async () => {
    currentUser = adminUser
    const { GET } = await import('../app/api/admin/users/[id]/export/route')
    const res = await GET(new NextRequest('http://localhost/api/admin/users/9999/export'), { params: { id: '9999' } })
    expect(res.status).toBe(404)
  })

  it('compile le dossier (compte, IP dédupliquées, sessions) et pose Content-Disposition en pièce jointe', async () => {
    currentUser = adminUser
    const { GET } = await import('../app/api/admin/users/[id]/export/route')
    const res = await GET(new NextRequest('http://localhost/api/admin/users/2/export'), { params: { id: '2' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('attachment')

    const body = await res.json()
    expect(body.account).toMatchObject({ id: 2, discord_name: 'Alice', discord_username: 'alice' })

    expect(body.known_ips).toHaveLength(2)
    const ip1 = body.known_ips.find((k: any) => k.ip === '1.2.3.4')
    // Vue à la fois via une session (10:00:00 le 01/01) et un upload de photo
    // (10:00:00 le 01/02) : first_seen doit refléter l'observation la plus ancienne.
    expect(ip1.first_seen).toContain('2024-01-01')
    expect(ip1.last_seen).toContain('2024-02-01')

    expect(body.sessions).toHaveLength(2)
    expect(body.sessions[0].ip).toBeTruthy()
  })
})
