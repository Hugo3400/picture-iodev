import Database from 'better-sqlite3'
import { getDb } from './db'
import { probeVideo, transcodeVideo, extractPosterFrame } from './videoProcessing'
import { existsSync } from 'fs'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')
const POLL_INTERVAL_MS = 3000

export function enqueueJob(db: Database.Database, photoId: number): void {
  db.prepare('INSERT INTO processing_jobs (photo_id) VALUES (?)').run(photoId)
}

// Traite un seul job pending (le plus ancien) et retourne true s'il y en avait
// un à traiter — permet à startWorker() de drainer la file sans dépasser une
// compression à la fois (contrainte serveur : cette machine héberge d'autres
// apps via pm2).
async function processNextJob(): Promise<boolean> {
  const db = getDb()
  const job = db.prepare(
    "SELECT * FROM processing_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
  ).get() as { id: number; photo_id: number } | undefined
  if (!job) return false

  db.prepare("UPDATE processing_jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ?").run(job.id)
  db.prepare("UPDATE photos SET processing_status = 'processing' WHERE id = ?").run(job.photo_id)

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(job.photo_id) as any

  try {
    if (!photo) throw new Error('photo introuvable')

    const userDir = path.join(STORAGE_DIR, String(photo.user_id))
    const inputPath = path.join(userDir, photo.filename)
    if (!existsSync(inputPath)) throw new Error('fichier source introuvable')

    const base = photo.filename.replace(/\.[a-zA-Z0-9]+$/, '')
    const compressedFilename = `${base}-compressed.mp4`
    const compressedPath = path.join(userDir, compressedFilename)

    await transcodeVideo(inputPath, compressedPath)

    const probe = await probeVideo(inputPath)
    const posterFilename = `${base}-thumb.webp`
    const posterOk = await extractPosterFrame(inputPath, path.join(userDir, posterFilename), probe.durationSec)

    db.prepare(
      "UPDATE photos SET compressed_filename = ?, thumb_filename = COALESCE(?, thumb_filename), processing_status = 'ready' WHERE id = ?"
    ).run(compressedFilename, posterOk ? posterFilename : null, photo.id)
    db.prepare("UPDATE processing_jobs SET status = 'done', updated_at = datetime('now') WHERE id = ?").run(job.id)
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500)
    // La vidéo ORIGINALE (photo.filename) n'est jamais touchée en cas
    // d'échec : elle reste servable, seul le statut de compression change.
    if (photo) db.prepare("UPDATE photos SET processing_status = 'failed' WHERE id = ?").run(photo.id)
    db.prepare(
      "UPDATE processing_jobs SET status = 'failed', attempts = attempts + 1, error = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(message, job.id)
  }

  return true
}

let workerStarted = false

export function startWorker(): void {
  if (workerStarted) return
  workerStarted = true

  const db = getDb()
  // Résidu d'un crash précédent : un job resté "processing" ne serait plus
  // jamais repris (aucun processus ne le détient), donc on le remet en attente
  // au démarrage.
  db.prepare("UPDATE processing_jobs SET status = 'pending', updated_at = datetime('now') WHERE status = 'processing'").run()

  let running = false
  setInterval(() => {
    if (running) return
    running = true
    ;(async () => {
      try {
        // Draine toute la file un job à la fois (concurrence = 1) avant
        // d'attendre le prochain tick, plutôt que de traiter un seul job par
        // intervalle de 3s.
        while (await processNextJob()) { /* continue */ }
      } catch (err) {
        console.error('[queue] erreur worker :', err)
      } finally {
        running = false
      }
    })()
  }, POLL_INTERVAL_MS)
}
