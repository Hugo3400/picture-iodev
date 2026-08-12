import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'

const BOT_TOKEN = '123456:TEST-bot-token-for-unit-tests'

function signedParams(overrides: Record<string, string> = {}, token = BOT_TOKEN) {
  const base: Record<string, string> = {
    id: '42',
    first_name: 'Hugo',
    username: 'hugotest',
    auth_date: String(Math.floor(Date.now() / 1000)),
    ...overrides,
  }
  const dataCheckString = Object.keys(base).sort().map(k => `${k}=${base[k]}`).join('\n')
  const secretKey = crypto.createHash('sha256').update(token).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return { ...base, hash }
}

describe('verifyTelegramAuth', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN

  beforeEach(() => {
    vi.resetModules()
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
  })

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken
  })

  it('accepte des données correctement signées', async () => {
    const { verifyTelegramAuth } = await import('../lib/telegramAuth')
    expect(verifyTelegramAuth(signedParams())).toBe(true)
  })

  it('refuse un hash incorrect', async () => {
    const { verifyTelegramAuth } = await import('../lib/telegramAuth')
    const params = signedParams()
    params.hash = params.hash.slice(0, -2) + (params.hash.slice(-2) === '00' ? '11' : '00')
    expect(verifyTelegramAuth(params)).toBe(false)
  })

  it('refuse des données signées avec un mauvais bot token', async () => {
    const { verifyTelegramAuth } = await import('../lib/telegramAuth')
    const params = signedParams({}, 'un-autre-token')
    expect(verifyTelegramAuth(params)).toBe(false)
  })

  it('refuse un auth_date trop ancien (rejeu)', async () => {
    const { verifyTelegramAuth } = await import('../lib/telegramAuth')
    const oldDate = String(Math.floor(Date.now() / 1000) - 90000)
    const params = signedParams({ auth_date: oldDate })
    expect(verifyTelegramAuth(params)).toBe(false)
  })

  it('refuse si TELEGRAM_BOT_TOKEN absent (pas de crash)', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const { verifyTelegramAuth } = await import('../lib/telegramAuth')
    expect(verifyTelegramAuth(signedParams())).toBe(false)
  })
})

describe('isTelegramConfigured', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN
  const originalUsername = process.env.TELEGRAM_BOT_USERNAME

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken
    process.env.TELEGRAM_BOT_USERNAME = originalUsername
  })

  it('vrai seulement si token ET username sont définis', async () => {
    vi.resetModules()
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    process.env.TELEGRAM_BOT_USERNAME = 'mon_bot'
    const { isTelegramConfigured } = await import('../lib/telegramAuth')
    expect(isTelegramConfigured()).toBe(true)
  })

  it('faux si username manquant', async () => {
    vi.resetModules()
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    delete process.env.TELEGRAM_BOT_USERNAME
    const { isTelegramConfigured } = await import('../lib/telegramAuth')
    expect(isTelegramConfigured()).toBe(false)
  })
})
