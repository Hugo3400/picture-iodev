const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')

const DB_PATH = path.join(__dirname, '..', 'data', 'picture.db')
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups')
const RETENTION_DAYS = 14

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(BACKUP_DIR, `picture-${stamp}.db`)

  // db.backup() passe par l'API sqlite "online backup" : elle produit un snapshot
  // cohérent même si le WAL contient des écritures non checkpointées, contrairement
  // à une simple copie de fichier qui risquerait de capturer une DB dans un état
  // incohérent pendant une écriture concurrente.
  const db = new Database(DB_PATH, { readonly: true })
  await db.backup(dest)
  db.close()

  const gz = zlib.gzipSync(fs.readFileSync(dest))
  fs.writeFileSync(`${dest}.gz`, gz)
  fs.unlinkSync(dest)

  const cutoff = Date.now() - RETENTION_DAYS * 86400 * 1000
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    const full = path.join(BACKUP_DIR, f)
    if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full)
  }

  console.log(`[backup-db] ${dest}.gz`)
}

main().catch(err => {
  console.error('[backup-db] échec :', err)
  process.exit(1)
})
