import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { getAlbumAccess, canEditPhoto, createJoinRequest } from '@/lib/permissions'

function makeDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE albums (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL);
    CREATE TABLE album_collaborators (id INTEGER PRIMARY KEY, album_id INTEGER NOT NULL, user_id INTEGER);
    CREATE TABLE album_join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, album_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `)
  db.prepare('INSERT INTO albums (id, user_id) VALUES (1, 100)').run() // owned by user 100
  db.prepare('INSERT INTO album_collaborators (album_id, user_id) VALUES (1, 200)').run() // user 200 is collaborator
  return db
}

describe('getAlbumAccess', () => {
  it('returns owner for the album creator', () => {
    expect(getAlbumAccess(makeDb(), 1, 100)).toBe('owner')
  })

  it('returns collaborator for an invited user', () => {
    expect(getAlbumAccess(makeDb(), 1, 200)).toBe('collaborator')
  })

  it('returns null for an unrelated user', () => {
    expect(getAlbumAccess(makeDb(), 1, 999)).toBeNull()
  })

  it('returns null for a nonexistent album', () => {
    expect(getAlbumAccess(makeDb(), 42, 100)).toBeNull()
  })
})

describe('canEditPhoto', () => {
  const db = makeDb()

  it('lets the uploader edit their own unfiled photo', () => {
    expect(canEditPhoto(db, { user_id: 100, album_id: null }, 100)).toBe(true)
  })

  it('blocks a stranger from an unfiled photo they did not upload', () => {
    expect(canEditPhoto(db, { user_id: 100, album_id: null }, 999)).toBe(false)
  })

  it('lets an album collaborator edit a photo they did not personally upload', () => {
    // C'est le cas d'usage central de la co-édition : un co-éditeur doit pouvoir
    // gérer les photos d'autrui dans l'album partagé.
    expect(canEditPhoto(db, { user_id: 100, album_id: 1 }, 200)).toBe(true)
  })

  it('blocks a non-collaborator even if the photo sits in an album', () => {
    expect(canEditPhoto(db, { user_id: 100, album_id: 1 }, 999)).toBe(false)
  })
})

describe('createJoinRequest', () => {
  let db: Database.Database
  beforeEach(() => { db = makeDb() })

  it('rejects a request for a nonexistent album', () => {
    const res = createJoinRequest(db, 42, 999)
    expect(res.status).toBe(404)
  })

  it('rejects a request from someone who already has access', () => {
    const res = createJoinRequest(db, 1, 200)
    expect(res.status).toBe(400)
  })

  it('creates a pending request for a new user', () => {
    const res = createJoinRequest(db, 1, 999)
    expect(res.request).toBeTruthy()
    expect(res.request.status).toBe('pending')
  })

  it('rejects a second request while one is already pending', () => {
    createJoinRequest(db, 1, 999)
    const res = createJoinRequest(db, 1, 999)
    expect(res.status).toBe(400)
  })
})
