import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'

const execFileAsync = promisify(execFile)

const FFPROBE_TIMEOUT_MS = 30_000
const FFMPEG_TRANSCODE_TIMEOUT_MS = 10 * 60 * 1000
const FFMPEG_POSTER_TIMEOUT_MS = 30_000

export interface ProbeResult {
  valid: boolean
  durationSec?: number
}

// ffprobe est la seule validation réelle des fichiers vidéo uploadés (le sniff
// par extension dans lib/fileSniff.ts n'est qu'un indice) : un fichier n'est
// accepté que s'il contient effectivement au moins un stream vidéo lisible.
export async function probeVideo(filePath: string): Promise<ProbeResult> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type',
      '-of', 'json',
      filePath,
    ], { timeout: FFPROBE_TIMEOUT_MS })

    const parsed = JSON.parse(stdout)
    const hasVideoStream = Array.isArray(parsed.streams) && parsed.streams.some((s: any) => s.codec_type === 'video')
    if (!hasVideoStream) return { valid: false }

    const durationSec = parsed.format?.duration ? parseFloat(parsed.format.duration) : undefined
    return { valid: true, durationSec: Number.isFinite(durationSec) ? durationSec : undefined }
  } catch {
    return { valid: false }
  }
}

// Transcode en mp4 H.264/AAC web-friendly. Résolution plafonnée à 1080p sans
// upscale (scale=-2:'min(1080,ih)' laisse la hauteur inchangée si elle est
// déjà <= 1080, -2 garde une largeur paire requise par libx264).
export function transcodeVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', "scale=-2:'min(1080,ih)'",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '26',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ]

    const child = spawn('ffmpeg', args)
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Transcodage vidéo : délai dépassé'))
    }, FFMPEG_TRANSCODE_TIMEOUT_MS)

    child.stderr?.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', err => { clearTimeout(timer); reject(err) })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg a échoué (code ${code}) : ${stderr.slice(-2000)}`))
    })
  })
}

// Best-effort, comme generateThumbnail : un échec n'empêche jamais la vidéo
// d'origine (ou transcodée) d'être servie, on se contente de ne pas avoir de
// vignette.
export async function extractPosterFrame(inputPath: string, outputPath: string, durationSec?: number): Promise<boolean> {
  // Vise ~10% de la durée (pour éviter les génériques/écrans noirs en tout
  // début de vidéo), plafonné à 5s pour les vidéos longues, avec un repli à
  // 0.5s si la durée n'est pas connue ou pour les clips très courts.
  const seek = durationSec && durationSec > 0 ? Math.min(durationSec * 0.1, 5) : 0.5

  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', seek.toFixed(2),
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'scale=480:-2',
      '-c:v', 'libwebp',
      outputPath,
    ], { timeout: FFMPEG_POSTER_TIMEOUT_MS })
    return existsSync(outputPath)
  } catch {
    return false
  }
}
