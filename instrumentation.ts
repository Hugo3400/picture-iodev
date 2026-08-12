export async function register() {
  // Ce hook tourne aussi en edge runtime : on ne veut ces listeners qu'en Node,
  // et une seule fois (register() peut être rappelé lors du hot-reload en dev).
  // Le pattern `if (process.env.NEXT_RUNTIME === 'nodejs') { ... }` (plutôt
  // qu'un early-return) est celui documenté par Next.js pour exclure les
  // imports Node-only (fs, child_process, better-sqlite3...) du bundle edge —
  // un early-return laisse quand même ces imports résolus par le bundler edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
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
}
