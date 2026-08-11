import { describe, it, expect } from 'vitest'
import { computeExpiresAt } from '@/lib/publicUploads'

describe('computeExpiresAt', () => {
  it('returns null for "never" (no expiration row written)', () => {
    // Régression du bug LB Phone : un appelant qui omet expires_in doit
    // retomber sur ce même comportement ("never"), pas sur une expiration à 24h.
    expect(computeExpiresAt('never')).toBeNull()
  })

  it.each([
    ['1h', 60 * 60 * 1000],
    ['24h', 24 * 60 * 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
    ['30d', 30 * 24 * 60 * 60 * 1000],
  ] as const)('schedules %s roughly %dms in the future', (choice, ms) => {
    const before = Date.now()
    const result = computeExpiresAt(choice)
    expect(result).not.toBeNull()
    const delta = new Date(result!).getTime() - before
    expect(delta).toBeGreaterThan(ms - 5000)
    expect(delta).toBeLessThan(ms + 5000)
  })
})
