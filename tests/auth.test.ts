import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, isValidEmail, isValidPassword } from '../lib/auth'

describe('hashPassword / verifyPassword', () => {
  it('vérifie un mot de passe correct', () => {
    const hash = hashPassword('motdepasse123')
    expect(verifyPassword('motdepasse123', hash)).toBe(true)
  })

  it('rejette un mauvais mot de passe', () => {
    const hash = hashPassword('motdepasse123')
    expect(verifyPassword('autrechose', hash)).toBe(false)
  })

  it('utilise un sel différent à chaque hash', () => {
    const a = hashPassword('motdepasse123')
    const b = hashPassword('motdepasse123')
    expect(a).not.toBe(b)
    expect(verifyPassword('motdepasse123', a)).toBe(true)
    expect(verifyPassword('motdepasse123', b)).toBe(true)
  })

  it('rejette un hash stocké malformé sans lever d\'exception', () => {
    expect(verifyPassword('x', 'pas-un-hash-valide')).toBe(false)
    expect(verifyPassword('x', '')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepte des emails valides', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('prohugo10@gmail.com')).toBe(true)
  })

  it('rejette les entrées invalides', () => {
    expect(isValidEmail('pas-un-email')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(null)).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
    expect(isValidEmail(42)).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })
})

describe('isValidPassword', () => {
  it('accepte 8 caractères ou plus', () => {
    expect(isValidPassword('12345678')).toBe(true)
  })

  it('rejette moins de 8 caractères', () => {
    expect(isValidPassword('1234567')).toBe(false)
  })

  it('rejette les valeurs non-string', () => {
    expect(isValidPassword(12345678 as unknown as string)).toBe(false)
  })
})
