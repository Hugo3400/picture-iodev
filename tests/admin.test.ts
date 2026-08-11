import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAdmin, formatBytes } from '@/lib/admin'

const user = (discord_id: string) => ({ id: 1, discord_id, discord_name: 'Test', discord_avatar: null })

describe('isAdmin', () => {
  const original = process.env.ADMIN_DISCORD_IDS

  beforeEach(() => { delete process.env.ADMIN_DISCORD_IDS })
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_DISCORD_IDS
    else process.env.ADMIN_DISCORD_IDS = original
  })

  it('denies everyone when ADMIN_DISCORD_IDS is unset (no crash, unlike SHARE_SECRET)', () => {
    expect(isAdmin(user('123'))).toBe(false)
  })

  it('denies everyone when ADMIN_DISCORD_IDS is an empty string', () => {
    process.env.ADMIN_DISCORD_IDS = ''
    expect(isAdmin(user('123'))).toBe(false)
  })

  it('denies a null session (logged-out user)', () => {
    process.env.ADMIN_DISCORD_IDS = '123'
    expect(isAdmin(null)).toBe(false)
  })

  it('allows a discord_id present in the comma-separated allowlist', () => {
    process.env.ADMIN_DISCORD_IDS = '111,123,999'
    expect(isAdmin(user('123'))).toBe(true)
  })

  it('trims whitespace around each id in the allowlist', () => {
    process.env.ADMIN_DISCORD_IDS = ' 111 , 123 ,999 '
    expect(isAdmin(user('123'))).toBe(true)
  })

  it('denies a discord_id not present in the allowlist', () => {
    process.env.ADMIN_DISCORD_IDS = '111,999'
    expect(isAdmin(user('123'))).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats sub-megabyte sizes in Ko', () => {
    expect(formatBytes(500 * 1024)).toBe('500 Ko')
  })

  it('formats sub-gigabyte sizes in Mo', () => {
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 Mo')
  })

  it('formats large sizes in Go', () => {
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 Go')
  })
})
