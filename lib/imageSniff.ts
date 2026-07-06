export type SniffedImageExt = 'jpg' | 'png' | 'gif' | 'webp' | 'bmp' | 'avif'

// Vérifie les magic bytes plutôt que de faire confiance au Content-Type déclaré
// par le client ou à l'extension du nom de fichier (les deux sont falsifiables).
export function sniffImageExt(buf: Buffer): SniffedImageExt | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'

  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'png'

  if (
    buf.length >= 6 && buf.toString('ascii', 0, 3) === 'GIF' &&
    (buf.toString('ascii', 3, 6) === '87a' || buf.toString('ascii', 3, 6) === '89a')
  ) return 'gif'

  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp'

  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'
  ) return 'webp'

  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12)
    if (brand === 'avif' || brand === 'avis') return 'avif'
  }

  return null
}
