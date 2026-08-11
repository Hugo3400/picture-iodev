import { describe, it, expect } from 'vitest'
import { isShareLinkExpired } from '@/lib/share'

describe('isShareLinkExpired', () => {
  it('returns false for a link without expiration (expires_at IS NULL)', () => {
    expect(isShareLinkExpired({ expires_at: null })).toBe(false)
  })

  it('returns false for a link expiring in the future', () => {
    expect(isShareLinkExpired({ expires_at: new Date(Date.now() + 60_000).toISOString() })).toBe(false)
  })

  it('returns true for a link that already expired', () => {
    expect(isShareLinkExpired({ expires_at: new Date(Date.now() - 60_000).toISOString() })).toBe(true)
  })
})
