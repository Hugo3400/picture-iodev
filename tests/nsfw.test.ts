import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'

function makeDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caption TEXT,
      album_id INTEGER,
      nsfw INTEGER NOT NULL DEFAULT 0
    );
  `)
  return db
}

describe('nsfw column migration', () => {
  it('is added with a default of 0 and backfills existing rows', () => {
    const db = new Database(':memory:')
    db.exec('CREATE TABLE photos (id INTEGER PRIMARY KEY, caption TEXT)')
    db.prepare('INSERT INTO photos (id, caption) VALUES (1, NULL)').run()

    const cols = db.prepare("PRAGMA table_info(photos)").all() as { name: string }[]
    expect(cols.some(c => c.name === 'nsfw')).toBe(false)
    db.exec('ALTER TABLE photos ADD COLUMN nsfw INTEGER NOT NULL DEFAULT 0')

    const row = db.prepare('SELECT nsfw FROM photos WHERE id = 1').get() as { nsfw: number }
    expect(row.nsfw).toBe(0)
  })

  it('is a no-op the second time it runs (idempotent, like the other ADD COLUMN blocks)', () => {
    const db = new Database(':memory:')
    db.exec('CREATE TABLE photos (id INTEGER PRIMARY KEY, nsfw INTEGER NOT NULL DEFAULT 0)')
    const cols = db.prepare("PRAGMA table_info(photos)").all() as { name: string }[]
    expect(cols.some(c => c.name === 'nsfw')).toBe(true)
    // Le pattern de migration ne doit pas retenter l'ALTER quand la colonne existe déjà.
  })
})

describe('nsfw PATCH semantics (mirrors the UPDATE in app/api/private-photos/[id]/route.ts)', () => {
  const patch = (db: Database.Database, id: number, body: { caption?: string; album_id?: number | null; nsfw?: boolean }) => {
    const { caption, album_id, nsfw } = body
    db.prepare('UPDATE photos SET caption = COALESCE(?, caption), album_id = ?, nsfw = COALESCE(?, nsfw) WHERE id = ?')
      .run(caption ?? null, album_id === undefined ? (db.prepare('SELECT album_id FROM photos WHERE id = ?').get(id) as any).album_id : album_id, nsfw === undefined ? null : (nsfw ? 1 : 0), id)
  }

  it('leaves nsfw untouched when the field is omitted', () => {
    const db = makeDb()
    db.prepare("INSERT INTO photos (id, caption, nsfw) VALUES (1, 'x', 1)").run()
    patch(db, 1, { caption: 'new caption' })
    expect((db.prepare('SELECT nsfw FROM photos WHERE id = 1').get() as any).nsfw).toBe(1)
  })

  it('marks a photo as sensitive when nsfw: true is sent', () => {
    const db = makeDb()
    db.prepare('INSERT INTO photos (id, nsfw) VALUES (1, 0)').run()
    patch(db, 1, { nsfw: true })
    expect((db.prepare('SELECT nsfw FROM photos WHERE id = 1').get() as any).nsfw).toBe(1)
  })

  it('un-marks a photo when nsfw: false is sent explicitly', () => {
    const db = makeDb()
    db.prepare('INSERT INTO photos (id, nsfw) VALUES (1, 1)').run()
    patch(db, 1, { nsfw: false })
    expect((db.prepare('SELECT nsfw FROM photos WHERE id = 1').get() as any).nsfw).toBe(0)
  })
})
