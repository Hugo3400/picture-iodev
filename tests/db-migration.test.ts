import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'

let dbPath: string

// Simule une DB de prod existante, créée avec l'ancien schéma users
// (discord_id TEXT UNIQUE NOT NULL), pour vérifier que la migration de
// lib/db.ts reconstruit la table sans perte de données ni casse des FK.
beforeAll(() => {
  dbPath = path.join(os.tmpdir(), `test-migration-${Date.now()}-${Math.random()}.db`)
  const seed = new Database(dbPath)
  seed.pragma('foreign_keys = ON')
  seed.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      discord_name TEXT NOT NULL,
      discord_username TEXT,
      discord_avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  seed.prepare(
    'INSERT INTO users (discord_id, discord_name, discord_username, discord_avatar) VALUES (?, ?, ?, ?)'
  ).run('12345', 'Hugo', 'hugo_discord', 'https://cdn.discordapp.com/avatars/12345/x.png')
  seed.prepare('INSERT INTO albums (user_id, name) VALUES (1, ?)').run('Vacances')
  seed.close()
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true })
})

describe('migration de la table users (discord_id NOT NULL -> nullable)', () => {
  it('rend discord_id nullable, ajoute email/password_hash, et préserve les comptes Discord existants', async () => {
    process.env.DB_PATH = dbPath
    const { getDb } = await import('../lib/db')
    const db = getDb()

    const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string; notnull: number }[]
    expect(cols.find(c => c.name === 'discord_id')?.notnull).toBe(0)
    expect(cols.some(c => c.name === 'email')).toBe(true)
    expect(cols.some(c => c.name === 'password_hash')).toBe(true)

    const existing = db.prepare('SELECT * FROM users WHERE id = 1').get() as any
    expect(existing.discord_id).toBe('12345')
    expect(existing.discord_name).toBe('Hugo')
    expect(existing.discord_username).toBe('hugo_discord')
    expect(existing.discord_avatar).toBe('https://cdn.discordapp.com/avatars/12345/x.png')

    const album = db.prepare('SELECT * FROM albums WHERE id = 1').get() as any
    expect(album.user_id).toBe(1)

    const info = db.prepare(
      'INSERT INTO users (email, password_hash, discord_name) VALUES (?, ?, ?)'
    ).run('test@example.com', 'salt:hash', 'Testeur')
    expect(Number(info.lastInsertRowid)).toBeGreaterThan(1)

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as any
    expect(created.discord_id).toBeNull()
    expect(created.email).toBe('test@example.com')

    expect(() =>
      db.prepare('INSERT INTO users (discord_name) VALUES (?)').run('Personne')
    ).toThrow()
  })

  it('est idempotente : rouvrir la DB déjà migrée ne recasse rien', async () => {
    // Force une nouvelle instance du module (donc un nouveau singleton `db`) pour
    // rejouer réellement la logique de getDb() — y compris la vérification
    // notnull du rebuild — sur un fichier déjà migré, au lieu de simplement
    // récupérer l'instance mise en cache par le test précédent.
    vi.resetModules()
    process.env.DB_PATH = dbPath
    const { getDb } = await import('../lib/db')
    const db = getDb()
    const countBefore = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as any).n
    const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string; notnull: number }[]
    expect(cols.find(c => c.name === 'discord_id')?.notnull).toBe(0)
    expect(countBefore).toBeGreaterThanOrEqual(2)
  })
})
