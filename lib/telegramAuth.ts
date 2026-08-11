import crypto from 'crypto'

// Fenêtre de validité du hash Telegram : au-delà, on considère l'auth_date trop
// vieux pour empêcher le rejeu d'une URL de callback interceptée/loguée.
const MAX_AUTH_AGE_SECONDS = 86400

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_BOT_USERNAME
}

// Vérifie la signature du Telegram Login Widget (https://core.telegram.org/widgets/login).
// Les données transitent par le navigateur du client donc falsifiables sans cette
// vérification HMAC côté serveur, avec le token du bot (jamais exposé) comme secret.
export function verifyTelegramAuth(params: Record<string, string>): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return false

  const { hash, ...rest } = params
  if (!hash) return false

  const dataCheckString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const computedBuf = Buffer.from(computedHash, 'hex')
  const providedBuf = Buffer.from(hash, 'hex')
  if (computedBuf.length !== providedBuf.length) return false
  if (!crypto.timingSafeEqual(computedBuf, providedBuf)) return false

  const authDate = Number(rest.auth_date)
  if (!Number.isFinite(authDate)) return false
  if (Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) return false

  return true
}
