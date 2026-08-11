import { NextRequest, NextResponse } from 'next/server'

const WEBHOOK = process.env.DISCORD_ERROR_WEBHOOK

// Anti-spam : une erreur qui boucle (ex. crash à chaque requête) ne doit pas
// inonder le salon Discord. On regroupe par message d'erreur et on n'en
// renvoie qu'une par fenêtre de 5 minutes.
const THROTTLE_MS = 5 * 60 * 1000
const lastSent = new Map<string, number>()

export async function notifyError(error: unknown, context?: { path?: string; method?: string }) {
  if (!WEBHOOK) return

  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const key = `${context?.path || ''}:${message}`

  const now = Date.now()
  const last = lastSent.get(key)
  if (last && now - last < THROTTLE_MS) return
  lastSent.set(key, now)

  const fields = []
  if (context?.path) fields.push({ name: 'Route', value: `${context.method || 'GET'} ${context.path}`, inline: true })

  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🔴 Erreur — picture.iodev.fr',
          description: `\`\`\`${message.slice(0, 500)}\`\`\``,
          fields,
          footer: stack ? { text: stack.split('\n').slice(0, 6).join('\n').slice(0, 1000) } : undefined,
          color: 0xf0586b,
          timestamp: new Date().toISOString(),
        }],
      }),
    })
  } catch {
    // best-effort : une panne du webhook ne doit jamais faire planter l'appli
  }
}

type RouteHandler = (req: NextRequest, ctx: any) => Promise<NextResponse> | NextResponse

// Next 14.2 n'a pas encore le hook global onRequestError (ajouté dans des versions
// plus récentes) : on enveloppe donc chaque route sensible individuellement pour
// être notifié des exceptions non gérées, sans changer leur comportement normal.
export function withErrorNotify(method: string, handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      await notifyError(error, { path: req.nextUrl.pathname, method })
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
}
