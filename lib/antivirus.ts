import NodeClam from 'clamscan'
import { Readable } from 'stream'

let scannerPromise: Promise<NodeClam> | null = null

function getScanner(): Promise<NodeClam> {
  if (!scannerPromise) {
    scannerPromise = new NodeClam().init({
      removeInfected: false,
      clamdscan: {
        socket: '/var/run/clamav/clamd.ctl',
        timeout: 60000,
      },
      preference: 'clamdscan',
    })
  }
  return scannerPromise
}

// Scanne un buffer en mémoire via clamd (INSTREAM) avant toute écriture sur
// disque. best-effort : si clamd est indisponible, on n'expose pas le serveur
// à un blocage de tous les uploads pour autant — l'appelant décide quoi faire
// du résultat "unavailable".
export async function scanBuffer(buf: Buffer): Promise<{ infected: boolean; virusName?: string } | { unavailable: true }> {
  try {
    const scanner = await getScanner()
    const stream = Readable.from(buf)
    const result = await scanner.scanStream(stream)
    return { infected: !!result.isInfected, virusName: result.viruses?.[0] }
  } catch (err) {
    console.error('[antivirus] scan indisponible :', err instanceof Error ? err.message : err)
    return { unavailable: true }
  }
}
