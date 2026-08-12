export interface ServablePhoto {
  filename: string
  thumb_filename: string | null
  compressed_filename: string | null
  processing_status: string
}

export interface ServeQuery {
  thumb: boolean
  original: boolean
}

// Ordre de priorité : ?thumb=1 (si une vignette existe) > ?original=1 (force
// le fichier d'origine, utile pour retélécharger une vidéo non compressée)
// > par défaut la version compressée si elle est prête, sinon l'original.
export function resolveServedFilename(photo: ServablePhoto, query: ServeQuery): string {
  if (query.thumb && photo.thumb_filename) return photo.thumb_filename
  if (query.original) return photo.filename
  if (photo.processing_status === 'ready' && photo.compressed_filename) return photo.compressed_filename
  return photo.filename
}

export interface ParsedRange {
  start: number
  end: number
}

// Parse un header Range HTTP à un seul intervalle ("bytes=start-end"), le cas
// utilisé en pratique par les lecteurs vidéo/audio des navigateurs. Retourne
// null si l'en-tête est absent, malformé, ou hors bornes du fichier.
export function parseRangeHeader(rangeHeader: string | null | undefined, fileSize: number): ParsedRange | null {
  if (!rangeHeader || fileSize <= 0) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return null

  const [, startStr, endStr] = match
  if (startStr === '' && endStr === '') return null

  let start: number
  let end: number

  if (startStr === '') {
    // Range suffixe "bytes=-500" : les 500 derniers octets du fichier.
    const suffixLength = parseInt(endStr, 10)
    if (Number.isNaN(suffixLength) || suffixLength <= 0) return null
    start = Math.max(0, fileSize - suffixLength)
    end = fileSize - 1
  } else {
    start = parseInt(startStr, 10)
    end = endStr === '' ? fileSize - 1 : parseInt(endStr, 10)
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0 || start >= fileSize) return null

  return { start, end: Math.min(end, fileSize - 1) }
}
