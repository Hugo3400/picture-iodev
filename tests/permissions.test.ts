import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { getAlbumAccess, canEditPhoto, createJoinRequest } from '@/lib/permissions'

function makeDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE albums (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, parent_id INTEGER);
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

function makeNestedDb() {
  const db = makeDb()
  // 1 (owner 100, collab 200) -> 2 -> 3 -> 4, chaîne de sous-dossiers sur 3 niveaux.
  db.prepare('INSERT INTO albums (id, user_id, parent_id) VALUES (2, 100, 1)').run()
  db.prepare('INSERT INTO albums (id, user_id, parent_id) VALUES (3, 100, 2)').run()
  db.prepare('INSERT INTO albums (id, user_id, parent_id) VALUES (4, 100, 3)').run()
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

  it('inherits owner access from an ancestor several levels up', () => {
    const db = makeNestedDb()
    expect(getAlbumAccess(db, 4, 100)).toBe('owner')
  })

  it('inherits collaborator access from an ancestor several levels up', () => {
    const db = makeNestedDb()
    expect(getAlbumAccess(db, 4, 200)).toBe('collaborator')
  })

  it('direct access on a deep sub-folder wins even if unrelated to inherited access', () => {
    const db = makeNestedDb()
    db.prepare('INSERT INTO album_collaborators (album_id, user_id) VALUES (4, 300)').run()
    expect(getAlbumAccess(db, 4, 300)).toBe('collaborator')
  })

  it('returns null for a user with no access anywhere in the chain', () => {
    const db = makeNestedDb()
    expect(getAlbumAccess(db, 4, 999)).toBeNull()
  })

  it('does not loop forever if parent_id data forms a cycle', () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE albums (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, parent_id INTEGER);
      CREATE TABLE album_collaborators (id INTEGER PRIMARY KEY, album_id INTEGER NOT NULL, user_id INTEGER);
    `)
    db.prepare('INSERT INTO albums (id, user_id, parent_id) VALUES (1, 100, 2)').run()
    db.prepare('INSERT INTO albums (id, user_id, parent_id) VALUES (2, 100, 1)').run()
    expect(getAlbumAccess(db, 1, 999)).toBeNull()
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
