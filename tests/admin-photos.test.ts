import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'

let dbPath: string
let currentUser: any = null

// Les deux nouvelles routes admin ne font que déléguer à getSession() + isAdmin() :
// on mocke getSession pour basculer entre "admin", "utilisateur normal" et
// "non connecté" sans avoir à poser de vrai cookie de session.
vi.mock('@/lib/session', () => ({
  getSession: async () => currentUser,
}))

const adminUser = { id: 1, discord_id: '999', discord_name: 'Admin', discord_avatar: null }
const regularUser = { id: 2, discord_id: '123', discord_name: 'Alice', discord_avatar: null }

beforeAll(() => {
  dbPath = path.join(os.tmpdir(), `test-admin-photos-${Date.now()}-${Math.random()}.db`)
  process.env.DB_PATH = dbPath
  process.env.ADMIN_DISCORD_IDS = '999'
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true })
})

describe('GET /api/admin/users/[id]/photos', () => {
  it('refuse un utilisateur non admin (403)', async () => {
    currentUser = regularUser
    const { GET } = await import('../app/api/admin/users/[id]/photos/route')
    const res = await GET(new NextRequest('http://localhost/api/admin/users/2/photos'), { params: { id: '2' } })
    expect(res.status).toBe(403)
  })

  it('refuse un visiteur non connecté (403)', async () => {
    currentUser = null
    const { GET } = await import('../app/api/admin/users/[id]/photos/route')
    const res = await GET(new NextRequest('http://localhost/api/admin/users/2/photos'), { params: { id: '2' } })
    expect(res.status).toBe(403)
  })

  it("renvoie les albums et les photos d'un utilisateur ciblé, groupables par album, pour un admin", async () => {
    currentUser = adminUser
    const { getDb } = await import('@/lib/db')
    const db = getDb()
    db.prepare("INSERT INTO users (id, discord_id, discord_name) VALUES (2, '123', 'Alice')").run()
    db.prepare("INSERT INTO albums (id, user_id, name) VALUES (10, 2, 'Vacances')").run()
    db.prepare("INSERT INTO photos (id, user_id, album_id, filename, size) VALUES (100, 2, 10, 'a.jpg', 123)").run()
    db.prepare("INSERT INTO photos (id, user_id, album_id, filename, size) VALUES (101, 2, NULL, 'b.jpg', 456)").run()

    const { GET } = await import('../app/api/admin/users/[id]/photos/route')
    const res = await GET(new NextRequest('http://localhost/api/admin/users/2/photos'), { params: { id: '2' } })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.albums).toHaveLength(1)
    expect(body.albums[0]).toMatchObject({ id: 10, name: 'Vacances', photo_count: 1 })
    expect(body.photos).toHaveLength(2)
    const photoWithAlbum = body.photos.find((p: any) => p.id === 100)
    expect(photoWithAlbum).toMatchObject({ album_id: 10, url: '/api/file/100', thumbUrl: '/api/file/100' })
    const photoWithoutAlbum = body.photos.find((p: any) => p.id === 101)
    expect(photoWithoutAlbum.album_id).toBeNull()
  })

  it('renvoie 404 pour un utilisateur inexistant, même en étant admin', async () => {
    currentUser = adminUser
    const { GET } = await import('../app/api/admin/users/[id]/photos/route')
    const res = await GET(new NextRequest('http://localhost/api/admin/users/9999/photos'), { params: { id: '9999' } })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/admin/photos/[id]/nsfw', () => {
  const patchReq = (body: unknown) => new NextRequest('http://localhost/api/admin/photos/200/nsfw', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  beforeAll(async () => {
    const { getDb } = await import('@/lib/db')
    const db = getDb()
    db.prepare("INSERT INTO users (id, discord_id, discord_name) VALUES (3, '456', 'Bob')").run()
    db.prepare("INSERT INTO photos (id, user_id, filename, size, nsfw) VALUES (200, 3, 'c.jpg', 789, 0)").run()
  })

  it('refuse un utilisateur non admin (403), même propriétaire de la photo', async () => {
    currentUser = { id: 3, discord_id: '456', discord_name: 'Bob', discord_avatar: null }
    const { PATCH } = await import('../app/api/admin/photos/[id]/nsfw/route')
    const res = await PATCH(patchReq({ nsfw: true }), { params: { id: '200' } })
    expect(res.status).toBe(403)
  })

  it("marque comme sensible une photo appartenant à un autre utilisateur", async () => {
    currentUser = adminUser
    const { PATCH } = await import('../app/api/admin/photos/[id]/nsfw/route')
    const res = await PATCH(patchReq({ nsfw: true }), { params: { id: '200' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nsfw).toBe(1)
  })

  it('retire le marquage sensible quand nsfw: false est envoyé', async () => {
    currentUser = adminUser
    const { PATCH } = await import('../app/api/admin/photos/[id]/nsfw/route')
    const res = await PATCH(patchReq({ nsfw: false }), { params: { id: '200' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nsfw).toBe(0)
  })

  it('renvoie 404 pour une photo inexistante', async () => {
    currentUser = adminUser
    const { PATCH } = await import('../app/api/admin/photos/[id]/nsfw/route')
    const req = new NextRequest('http://localhost/api/admin/photos/999999/nsfw', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nsfw: true }),
    })
    const res = await PATCH(req, { params: { id: '999999' } })
    expect(res.status).toBe(404)
  })
})
