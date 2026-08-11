import { describe, it, expect } from 'vitest'
import { sniffImageExt } from '@/lib/imageSniff'

describe('sniffImageExt', () => {
  it('recognizes JPEG magic bytes', () => {
    expect(sniffImageExt(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
  })

  it('recognizes PNG magic bytes', () => {
    expect(sniffImageExt(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
  })

  it('recognizes GIF87a and GIF89a', () => {
    expect(sniffImageExt(Buffer.from('GIF87a'))).toBe('gif')
    expect(sniffImageExt(Buffer.from('GIF89a'))).toBe('gif')
  })

  it('recognizes BMP magic bytes', () => {
    expect(sniffImageExt(Buffer.from([0x42, 0x4d, 0, 0]))).toBe('bmp')
  })

  it('recognizes WEBP (RIFF....WEBP)', () => {
    const buf = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')])
    expect(sniffImageExt(buf)).toBe('webp')
  })

  it('recognizes AVIF ftyp brand', () => {
    const buf = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('ftyp'), Buffer.from('avif')])
    expect(sniffImageExt(buf)).toBe('avif')
  })

  it('rejects a spoofed extension with no matching magic bytes', () => {
    // Ce cas est le but même de la fonction : un client pourrait nommer un script
    // "photo.jpg" ou mentir sur le Content-Type, sniffImageExt ne doit pas le croire.
    const buf = Buffer.from('#!/bin/sh\necho not-an-image')
    expect(sniffImageExt(buf)).toBeNull()
  })

  it('rejects an empty buffer', () => {
    expect(sniffImageExt(Buffer.alloc(0))).toBeNull()
  })
})
