import type { SessionUser } from './session'
import { promises as fs } from 'fs'
import path from 'path'

function parseAdminIds(): Set<string> {
  const raw = process.env.ADMIN_DISCORD_IDS
  if (!raw) return new Set()
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
}

// Pas de colonne users.is_admin : on évite toute migration risquée sur la table
// users en prod. La liste d'IDs Discord admin vient d'une variable d'env
// optionnelle — contrairement à SHARE_SECRET, une valeur absente/vide ne doit pas
// faire planter le site, elle signifie simplement "personne n'est admin".
export function isAdmin(user: SessionUser | null): boolean {
  if (!user || !user.discord_id) return false
  return parseAdminIds().has(user.discord_id)
}

export async function getDirSize(dir: string): Promise<number> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }

  let total = 0
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += await getDirSize(full)
    } else if (entry.isFile()) {
      try {
        total += (await fs.stat(full)).size
      } catch {
        // fichier supprimé entre le readdir et le stat : on l'ignore
      }
    }
  }
  return total
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`
}
