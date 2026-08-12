import { sniffImageExt, SniffedImageExt } from './imageSniff'

export type FileKind = 'image' | 'video' | 'text' | 'archive'

export interface SniffResult {
  kind: FileKind
  ext: string
}

export const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  txt: 'text/plain', rar: 'application/vnd.rar',
}

const RAR4_MAGIC = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])
const RAR5_MAGIC = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00])

// Les archives RAR5 partagent les 5 premiers octets de RAR4 : on teste donc
// la signature la plus longue en premier pour ne pas se tromper de version.
export function sniffRarMagic(buf: Buffer): boolean {
  if (buf.length >= RAR5_MAGIC.length && buf.subarray(0, RAR5_MAGIC.length).equals(RAR5_MAGIC)) return true
  if (buf.length >= RAR4_MAGIC.length && buf.subarray(0, RAR4_MAGIC.length).equals(RAR4_MAGIC)) return true
  return false
}

const DEFAULT_MAX_TEXT_SIZE = 2 * 1024 * 1024

// TextDecoder en mode `fatal` lève sur toute séquence d'octets invalide en
// UTF-8 : ça suffit à distinguer un vrai fichier texte d'un binaire renommé
// en .txt, sans dépendance externe.
export function isValidUtf8Text(buf: Buffer, maxSize = DEFAULT_MAX_TEXT_SIZE): boolean {
  if (buf.length > maxSize) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf)
    return true
  } catch {
    return false
  }
}

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv', 'avi']

// Pas de magic bytes fiables et simples pour distinguer tous les conteneurs
// vidéo courants : on se base sur l'extension déclarée ici, la validation
// réelle passe par ffprobe (lib/videoProcessing.ts) une fois le fichier écrit
// sur disque.
export function videoExtFromName(originalName: string): string | null {
  const ext = originalName.split('.').pop()?.toLowerCase() || ''
  return VIDEO_EXTENSIONS.includes(ext) ? ext : null
}

export interface SniffOptions {
  maxTextSize?: number
}

// Détection du type de fichier accepté par le stockage privé, par ordre de
// confiance décroissante : magic bytes image, magic bytes RAR, puis texte
// (extension + contenu UTF-8 valide), puis vidéo (extension seule).
export function sniffFile(buf: Buffer, originalName: string, opts: SniffOptions = {}): SniffResult | null {
  const imageExt: SniffedImageExt | null = sniffImageExt(buf)
  if (imageExt) return { kind: 'image', ext: imageExt }

  if (sniffRarMagic(buf)) return { kind: 'archive', ext: 'rar' }

  if (originalName.toLowerCase().endsWith('.txt') && isValidUtf8Text(buf, opts.maxTextSize)) {
    return { kind: 'text', ext: 'txt' }
  }

  const videoExt = videoExtFromName(originalName)
  if (videoExt) return { kind: 'video', ext: videoExt }

  return null
}
