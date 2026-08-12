export async function register() {
  // Ce hook tourne aussi en edge runtime : on ne veut ces listeners qu'en Node,
  // et une seule fois (register() peut être rappelé lors du hot-reload en dev).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { notifyError } = await import('@/lib/errorNotify')

  process.on('unhandledRejection', (reason) => {
    notifyError(reason, { path: '(unhandledRejection)' })
  })
  process.on('uncaughtException', (err) => {
    notifyError(err, { path: '(uncaughtException)' })
  })

  const { startWorker } = await import('@/lib/queue')
  startWorker()
}
