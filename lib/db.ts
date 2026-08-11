import Database from 'better-sqlite3'
import path from 'path'

// DB_PATH surchargeable par env var pour isoler la DB des tests de la DB de prod.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'picture.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      discord_name TEXT NOT NULL,
      discord_username TEXT,
      discord_avatar TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      caption TEXT,
      size INTEGER NOT NULL,
      thumb_filename TEXT,
      content_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS share_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('photo','album')),
      target_id INTEGER NOT NULL,
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      view_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS share_unlock_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      ip TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_unlock_attempts_lookup ON share_unlock_attempts(token, ip, created_at);

    CREATE TABLE IF NOT EXISTS album_collaborators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      invited_name TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      seen INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS album_join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','refused')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS public_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT,
      size INTEGER NOT NULL,
      expires_at TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
    CREATE INDEX IF NOT EXISTS idx_photos_album ON photos(album_id);
    CREATE INDEX IF NOT EXISTS idx_photos_user_hash ON photos(user_id, content_hash);
    CREATE INDEX IF NOT EXISTS idx_albums_user ON albums(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_collab_album ON album_collaborators(album_id);
    CREATE INDEX IF NOT EXISTS idx_collab_user ON album_collaborators(user_id);
    CREATE INDEX IF NOT EXISTS idx_join_requests_album ON album_join_requests(album_id, status);
    CREATE INDEX IF NOT EXISTS idx_join_requests_user ON album_join_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_public_uploads_expires ON public_uploads(expires_at);
  `)

  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number }[]
  if (!userCols.some(c => c.name === 'discord_username')) {
    db.exec('ALTER TABLE users ADD COLUMN discord_username TEXT')
  }

  // discord_id était UNIQUE NOT NULL à l'origine (auth Discord uniquement). Pour
  // accueillir les comptes email+mot de passe (sans discord_id), il faut lever ce
  // NOT NULL — chose que SQLite ne permet pas via un simple ALTER TABLE. On reconstruit
  // donc la table (schéma cible incluant email/password_hash) en préservant les id
  // (les FK des autres tables pointent dessus) et les données existantes. Le rebuild
  // est protégé par foreign_keys=OFF le temps de l'opération, comme recommandé par
  // SQLite pour ce genre de restructuration.
  if (userCols.some(c => c.name === 'discord_id' && c.notnull === 1)) {
    const conn = db
    conn.pragma('foreign_keys = OFF')
    conn.transaction(() => {
      conn.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          discord_id TEXT UNIQUE,
          discord_name TEXT NOT NULL,
          discord_username TEXT,
          discord_avatar TEXT,
          email TEXT UNIQUE,
          password_hash TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          CHECK (discord_id IS NOT NULL OR email IS NOT NULL)
        );
        INSERT INTO users_new (id, discord_id, discord_name, discord_username, discord_avatar, created_at)
          SELECT id, discord_id, discord_name, discord_username, discord_avatar, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `)
    })()
    conn.pragma('foreign_keys = ON')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(ip, created_at);

    CREATE TABLE IF NOT EXISTS register_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_register_attempts_lookup ON register_attempts(ip, created_at);
  `)

  const publicUploadCols = db.prepare("PRAGMA table_info(public_uploads)").all() as { name: string }[]
  if (!publicUploadCols.some(c => c.name === 'ip')) {
    db.exec('ALTER TABLE public_uploads ADD COLUMN ip TEXT')
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_public_uploads_ip ON public_uploads(ip, created_at)')

  const collabCols = db.prepare("PRAGMA table_info(album_collaborators)").all() as { name: string }[]
  if (!collabCols.some(c => c.name === 'seen')) {
    db.exec('ALTER TABLE album_collaborators ADD COLUMN seen INTEGER NOT NULL DEFAULT 0')
  }

  const photoCols = db.prepare("PRAGMA table_info(photos)").all() as { name: string }[]
  if (!photoCols.some(c => c.name === 'thumb_filename')) {
    db.exec('ALTER TABLE photos ADD COLUMN thumb_filename TEXT')
  }
  if (!photoCols.some(c => c.name === 'content_hash')) {
    db.exec('ALTER TABLE photos ADD COLUMN content_hash TEXT')
  }
  if (!photoCols.some(c => c.name === 'nsfw')) {
    db.exec('ALTER TABLE photos ADD COLUMN nsfw INTEGER NOT NULL DEFAULT 0')
  }

  const albumCols = db.prepare("PRAGMA table_info(albums)").all() as { name: string }[]
  if (!albumCols.some(c => c.name === 'unlisted')) {
    db.exec('ALTER TABLE albums ADD COLUMN unlisted INTEGER NOT NULL DEFAULT 0')
  }

  const sessionCols = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[]
  if (!sessionCols.some(c => c.name === 'id')) {
    // "token" (le secret lui-même) était la clé primaire : pour afficher une liste de
    // sessions côté client sans jamais renvoyer les tokens des AUTRES sessions au
    // navigateur, il faut un identifiant opaque (id auto-incrémenté) à exposer à la place.
    db.exec(`
      ALTER TABLE sessions RENAME TO sessions_old;
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        user_agent TEXT
      );
      INSERT INTO sessions (token, user_id, expires_at)
        SELECT token, user_id, expires_at FROM sessions_old;
      DROP TABLE sessions_old;
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `)
  }

  const shareLinkCols = db.prepare("PRAGMA table_info(share_links)").all() as { name: string }[]
  if (!shareLinkCols.some(c => c.name === 'expires_at')) {
    db.exec('ALTER TABLE share_links ADD COLUMN expires_at TEXT')
  }

  return db
}
