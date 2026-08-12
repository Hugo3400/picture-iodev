import { describe, it, expect } from 'vitest'
import { resolveServedFilename, parseRangeHeader } from '@/lib/fileServing'

describe('resolveServedFilename', () => {
  const base = {
    filename: 'original.mp4',
    thumb_filename: 'poster.webp' as string | null,
    compressed_filename: 'compressed.mp4' as string | null,
    processing_status: 'ready',
  }

  it('serves the thumbnail when ?thumb=1 and a thumbnail exists', () => {
    expect(resolveServedFilename(base, { thumb: true, original: false })).toBe('poster.webp')
  })

  it('falls through to the default logic when ?thumb=1 but no thumbnail exists', () => {
    const photo = { ...base, thumb_filename: null }
    expect(resolveServedFilename(photo, { thumb: true, original: false })).toBe('compressed.mp4')
  })

  it('serves the original file when ?original=1, even if a compressed version is ready', () => {
    expect(resolveServedFilename(base, { thumb: false, original: true })).toBe('original.mp4')
  })

  it('serves the compressed file by default when processing is ready', () => {
    expect(resolveServedFilename(base, { thumb: false, original: false })).toBe('compressed.mp4')
  })

  it('serves the original file by default when processing is still pending', () => {
    const photo = { ...base, processing_status: 'pending' }
    expect(resolveServedFilename(photo, { thumb: false, original: false })).toBe('original.mp4')
  })

  it('serves the original file by default when there is no compressed_filename', () => {
    const photo = { ...base, compressed_filename: null }
    expect(resolveServedFilename(photo, { thumb: false, original: false })).toBe('original.mp4')
  })

  it('prioritizes thumb over original when both query flags are set', () => {
    expect(resolveServedFilename(base, { thumb: true, original: true })).toBe('poster.webp')
  })

  it('serves the original file for an image (no compressed_filename, processing ready)', () => {
    const photo = { filename: 'photo.jpg', thumb_filename: 'photo-thumb.webp', compressed_filename: null, processing_status: 'ready' }
    expect(resolveServedFilename(photo, { thumb: false, original: false })).toBe('photo.jpg')
  })
})

describe('parseRangeHeader', () => {
  const SIZE = 1000

  it('returns null when there is no Range header', () => {
    expect(parseRangeHeader(null, SIZE)).toBeNull()
    expect(parseRangeHeader(undefined, SIZE)).toBeNull()
  })

  it('parses a standard "bytes=start-end" range', () => {
    expect(parseRangeHeader('bytes=100-199', SIZE)).toEqual({ start: 100, end: 199 })
  })

  it('parses an open-ended range "bytes=start-"', () => {
    expect(parseRangeHeader('bytes=900-', SIZE)).toEqual({ start: 900, end: 999 })
  })

  it('parses a suffix range "bytes=-500"', () => {
    expect(parseRangeHeader('bytes=-500', SIZE)).toEqual({ start: 500, end: 999 })
  })

  it('clamps a suffix range larger than the file to the whole file', () => {
    expect(parseRangeHeader('bytes=-5000', SIZE)).toEqual({ start: 0, end: 999 })
  })

  it('clamps an end beyond the file size to the last byte', () => {
    expect(parseRangeHeader('bytes=0-5000', SIZE)).toEqual({ start: 0, end: 999 })
  })

  it('rejects a malformed header', () => {
    expect(parseRangeHeader('not-a-range', SIZE)).toBeNull()
    expect(parseRangeHeader('bytes=', SIZE)).toBeNull()
  })

  it('rejects a range starting beyond the file size', () => {
    expect(parseRangeHeader('bytes=1000-1100', SIZE)).toBeNull()
  })

  it('rejects a range where start > end', () => {
    expect(parseRangeHeader('bytes=500-100', SIZE)).toBeNull()
  })

  it('rejects a zero-length suffix range', () => {
    expect(parseRangeHeader('bytes=-0', SIZE)).toBeNull()
  })
})
