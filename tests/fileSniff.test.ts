import { describe, it, expect } from 'vitest'
import { sniffFile, sniffRarMagic, isValidUtf8Text, videoExtFromName } from '@/lib/fileSniff'

describe('sniffRarMagic', () => {
  it('recognizes RAR4 signature', () => {
    expect(sniffRarMagic(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0xff]))).toBe(true)
  })

  it('recognizes RAR5 signature', () => {
    expect(sniffRarMagic(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]))).toBe(true)
  })

  it('rejects unrelated bytes', () => {
    expect(sniffRarMagic(Buffer.from('PK\x03\x04'))).toBe(false)
  })
})

describe('isValidUtf8Text', () => {
  it('accepts valid UTF-8 content', () => {
    expect(isValidUtf8Text(Buffer.from('Bonjour, ça marche très bien.', 'utf-8'))).toBe(true)
  })

  it('rejects invalid UTF-8 byte sequences', () => {
    expect(isValidUtf8Text(Buffer.from([0xff, 0xfe, 0x00, 0xff]))).toBe(false)
  })

  it('rejects content over the size ceiling', () => {
    const big = Buffer.alloc(100, 'a')
    expect(isValidUtf8Text(big, 10)).toBe(false)
  })
})

describe('videoExtFromName', () => {
  it('recognizes known video extensions', () => {
    expect(videoExtFromName('clip.mp4')).toBe('mp4')
    expect(videoExtFromName('CLIP.MKV')).toBe('mkv')
  })

  it('returns null for unknown extensions', () => {
    expect(videoExtFromName('document.pdf')).toBeNull()
  })
})

describe('sniffFile', () => {
  it('detects an image via magic bytes regardless of name', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    expect(sniffFile(buf, 'weird-name')).toEqual({ kind: 'image', ext: 'jpg' })
  })

  it('detects a RAR archive via magic bytes', () => {
    const buf = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])
    expect(sniffFile(buf, 'archive.rar')).toEqual({ kind: 'archive', ext: 'rar' })
  })

  it('detects a text file when the extension is .txt and content is valid UTF-8', () => {
    const buf = Buffer.from('un fichier texte tout simple', 'utf-8')
    expect(sniffFile(buf, 'notes.txt')).toEqual({ kind: 'text', ext: 'txt' })
  })

  it('rejects a .txt file whose content is not valid UTF-8', () => {
    const buf = Buffer.from([0xff, 0xfe, 0x00, 0xff])
    expect(sniffFile(buf, 'notes.txt')).toBeNull()
  })

  it('rejects binary content merely renamed with a .txt extension', () => {
    // Un exécutable ELF par exemple : magic bytes non-UTF8 valides
    const buf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0xfe])
    expect(sniffFile(buf, 'malware.txt')).toBeNull()
  })

  it('detects a video by extension when no other signature matches', () => {
    const buf = Buffer.from('not a real mp4 but has plausible header bytes')
    expect(sniffFile(buf, 'movie.mp4')).toEqual({ kind: 'video', ext: 'mp4' })
  })

  it('returns null for an unsupported file type', () => {
    const buf = Buffer.from('%PDF-1.4 fake pdf content')
    expect(sniffFile(buf, 'document.pdf')).toBeNull()
  })

  it('respects a custom maxTextSize for text detection', () => {
    const buf = Buffer.from('a'.repeat(50), 'utf-8')
    expect(sniffFile(buf, 'notes.txt', { maxTextSize: 10 })).toBeNull()
  })
})
