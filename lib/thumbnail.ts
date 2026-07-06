import sharp from 'sharp'

export const THUMB_MAX_DIMENSION = 480

// Retourne null si le format n'est pas supporté par sharp (ex: certains BMP) —
// l'appelant doit alors se rabattre sur l'image d'origine.
export async function generateThumbnail(bytes: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .rotate()
      .resize({ width: THUMB_MAX_DIMENSION, height: THUMB_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer()
  } catch {
    return null
  }
}
