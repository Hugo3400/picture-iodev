'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Logo, IconShield, IconUsers, IconImage, IconFolder, IconLink, IconTrash, IconLogout, IconClose, IconUpload } from './icons'

interface SessionUser { id: number; discord_id: string | null; discord_name: string; discord_avatar: string | null }

interface Stats {
  userCount: number
  photoCount: number
  albumCount: number
  shareLinkCount: number
  activeUploadCount: number
  privateSize: number
  publicSize: number
}

interface AdminUser {
  id: number
  discord_name: string
  discord_username: string | null
  discord_avatar: string | null
  created_at: string
  photo_count: number
  album_count: number
  active_sessions: number
}

interface PublicUpload {
  id: number
  filename: string
  original_name: string | null
  size: number
  expires_at: string | null
  ip: string | null
  created_at: string
}

interface AbuseAttempt {
  ip: string
  token: string
  attempts: number
  last_attempt: string
}

interface ShareLink {
  id: number
  token: string
  type: 'photo' | 'album'
  target_id: number
  view_count: number
  created_at: string
  has_password: number
  target_name: string | null
  owner_name: string | null
}

type Tab = 'overview' | 'users' | 'uploads' | 'security' | 'links'

type ConfirmAction =
  | { kind: 'delete-user'; id: number; label: string }
  | { kind: 'logout-user'; id: number; label: string }
  | { kind: 'delete-upload'; id: number; label: string }
  | { kind: 'revoke-link'; id: number; label: string }

const fmtBytes = (b: number) => {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} Mo`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} Go`
}

const fmtDate = (iso: string) => new Date(iso.includes('T') ? iso : iso + 'Z').toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

type SortDir = 'asc' | 'desc'
type SortState = { key: string; dir: SortDir }

// Trie générique par colonne : chaque table fournit ses propres accesseurs (getters)
// car certaines colonnes affichées sont dérivées (ex: nom d'origine avec repli sur
// le nom de fichier) plutôt que des champs bruts de la ligne.
function sortRows<T>(rows: T[], sort: SortState, getters: Record<string, (row: T) => string | number | null>): T[] {
  const get = getters[sort.key]
  if (!get) return rows
  const sorted = [...rows].sort((a, b) => {
    const av = get(a); const bv = get(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av).localeCompare(String(bv), 'fr')
  })
  return sort.dir === 'asc' ? sorted : sorted.reverse()
}

function SortTh({ label, sortKey, sort, onSort }: { label: string; sortKey: string; sort: SortState; onSort: (s: SortState) => void }) {
  const active = sort.key === sortKey
  return (
    <th
      style={{ ...S.th, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort({ key: sortKey, dir: active && sort.dir === 'asc' ? 'desc' : 'asc' })}
    >
      {label}{active && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
    </th>
  )
}

const S = {
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--accent)' : 'var(--bg-elevated)', color: active ? '#0a0a0b' : 'var(--text-dim)',
    border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
  }),
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--border)' } as React.CSSProperties,
  td: { padding: '10px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' } as React.CSSProperties,
  iconBtn: (danger = false): React.CSSProperties => ({
    background: danger ? 'rgba(240,88,107,0.12)' : 'var(--bg-elevated)', color: danger ? 'var(--danger)' : 'var(--text-dim)',
    border: 'none', borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }),
  modal: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 } as React.CSSProperties,
  modalCard: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 26, width: '100%', maxWidth: 400, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' } as React.CSSProperties,
}

export default function AdminPanel({
  user, stats, initialUsers, initialPublicUploads, initialAbuseAttempts, initialShareLinks,
}: {
  user: SessionUser
  stats: Stats
  initialUsers: AdminUser[]
  initialPublicUploads: PublicUpload[]
  initialAbuseAttempts: AbuseAttempt[]
  initialShareLinks: ShareLink[]
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [users, setUsers] = useState(initialUsers)
  const [uploads, setUploads] = useState(initialPublicUploads)
  const [links, setLinks] = useState(initialShareLinks)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [usersSort, setUsersSort] = useState<SortState>({ key: 'created_at', dir: 'desc' })
  const [uploadsSort, setUploadsSort] = useState<SortState>({ key: 'created_at', dir: 'desc' })
  const [securitySort, setSecuritySort] = useState<SortState>({ key: 'attempts', dir: 'desc' })
  const [linksSort, setLinksSort] = useState<SortState>({ key: 'created_at', dir: 'desc' })

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.kind === 'delete-user') {
        const res = await fetch(`/api/admin/users/${confirm.id}`, { method: 'DELETE' })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Échec de la suppression') }
        setUsers(u => u.filter(x => x.id !== confirm.id))
        toast.success('Compte supprimé')
      } else if (confirm.kind === 'logout-user') {
        const res = await fetch(`/api/admin/users/${confirm.id}/sessions`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Échec de la déconnexion forcée')
        setUsers(u => u.map(x => x.id === confirm.id ? { ...x, active_sessions: 0 } : x))
        toast.success('Sessions révoquées')
      } else if (confirm.kind === 'delete-upload') {
        const res = await fetch(`/api/admin/public-uploads/${confirm.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Échec de la suppression')
        setUploads(u => u.filter(x => x.id !== confirm.id))
        toast.success('Upload supprimé')
      } else if (confirm.kind === 'revoke-link') {
        const res = await fetch(`/api/admin/share-links/${confirm.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Échec de la révocation')
        setLinks(l => l.filter(x => x.id !== confirm.id))
        toast.success('Lien révoqué')
      }
      setConfirm(null)
    } catch (e: any) {
      toast.error(e.message || 'Une erreur est survenue')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,11,0.75)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={22} />
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>Picture</span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/prive" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>Espace privé</a>
          <a href="/" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>Galerie publique</a>
          {user.discord_avatar
            ? <img src={user.discord_avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
            : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-elevated)' }} />}
        </div>
      </header>

      <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '84px 24px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <IconShield size={20} style={{ color: 'var(--accent)' }} />
          <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>Panel d'administration</h1>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 22, overflowX: 'auto', paddingBottom: 4 }}>
          <button style={S.tab(tab === 'overview')} onClick={() => setTab('overview')}>Vue d'ensemble</button>
          <button style={S.tab(tab === 'users')} onClick={() => setTab('users')}><IconUsers size={13} /> Utilisateurs ({users.length})</button>
          <button style={S.tab(tab === 'uploads')} onClick={() => setTab('uploads')}><IconUpload size={13} /> Uploads publics ({uploads.length})</button>
          <button style={S.tab(tab === 'security')} onClick={() => setTab('security')}><IconShield size={13} /> Sécurité</button>
          <button style={S.tab(tab === 'links')} onClick={() => setTab('links')}><IconLink size={13} /> Liens de partage ({links.length})</button>
        </div>

        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
              <StatCard icon={<IconUsers size={16} />} label="Utilisateurs" value={stats.userCount} />
              <StatCard icon={<IconImage size={16} />} label="Photos" value={stats.photoCount} />
              <StatCard icon={<IconFolder size={16} />} label="Albums" value={stats.albumCount} />
              <StatCard icon={<IconLink size={16} />} label="Liens de partage" value={stats.shareLinkCount} />
              <StatCard icon={<IconUpload size={16} />} label="Uploads publics actifs" value={stats.activeUploadCount} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={S.card}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>Espace privé (storage/private)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fmtBytes(stats.privateSize)}</div>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>Hébergeur public (public/uploads)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fmtBytes(stats.publicSize)}</div>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>Total disque utilisé</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{fmtBytes(stats.privateSize + stats.publicSize)}</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>Utilisateur</th>
                  <th style={S.th}>Inscrit le</th>
                  <th style={S.th}>Photos</th>
                  <th style={S.th}>Albums</th>
                  <th style={S.th}>Sessions actives</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {u.discord_avatar
                          ? <img src={u.discord_avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                          : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)' }} />}
                        <div>
                          <div>{u.discord_name}{u.id === user.id && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}> (toi)</span>}</div>
                          {u.discord_username && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>@{u.discord_username}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>{fmtDate(u.created_at)}</td>
                    <td style={S.td}>{u.photo_count}</td>
                    <td style={S.td}>{u.album_count}</td>
                    <td style={S.td}>{u.active_sessions}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          title="Forcer la déconnexion"
                          disabled={u.active_sessions === 0}
                          style={{ ...S.iconBtn(), opacity: u.active_sessions === 0 ? 0.4 : 1, cursor: u.active_sessions === 0 ? 'not-allowed' : 'pointer' }}
                          onClick={() => setConfirm({ kind: 'logout-user', id: u.id, label: u.discord_name })}
                        ><IconLogout size={14} /></button>
                        <button
                          title={u.id === user.id ? "Tu ne peux pas supprimer ton propre compte" : 'Supprimer le compte'}
                          disabled={u.id === user.id}
                          style={{ ...S.iconBtn(true), opacity: u.id === user.id ? 0.4 : 1, cursor: u.id === user.id ? 'not-allowed' : 'pointer' }}
                          onClick={() => setConfirm({ kind: 'delete-user', id: u.id, label: u.discord_name })}
                        ><IconTrash size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p style={{ padding: 20, fontSize: 13, color: 'var(--text-faint)' }}>Aucun utilisateur.</p>}
          </div>
        )}

        {tab === 'uploads' && (
          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>Fichier</th>
                  <th style={S.th}>Taille</th>
                  <th style={S.th}>IP</th>
                  <th style={S.th}>Envoyé le</th>
                  <th style={S.th}>Expiration</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map(u => (
                  <tr key={u.id}>
                    <td style={{ ...S.td, maxWidth: 280 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                          src={`/uploads/${u.filename}`} alt="" loading="lazy"
                          onClick={() => setPreview({ url: `/uploads/${u.filename}`, label: u.original_name || u.filename })}
                          style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: '1px solid var(--border)' }}
                        />
                        <a
                          href={`/uploads/${u.filename}`} target="_blank" rel="noreferrer"
                          style={{ color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >{u.original_name || u.filename}</a>
                      </div>
                    </td>
                    <td style={S.td}>{fmtBytes(u.size)}</td>
                    <td style={S.td}>{u.ip || '—'}</td>
                    <td style={S.td}>{fmtDate(u.created_at)}</td>
                    <td style={S.td}>{u.expires_at ? fmtDate(u.expires_at) : 'Jamais'}</td>
                    <td style={S.td}>
                      <button title="Supprimer" style={S.iconBtn(true)} onClick={() => setConfirm({ kind: 'delete-upload', id: u.id, label: u.original_name || u.filename })}><IconTrash size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {uploads.length === 0 && <p style={{ padding: 20, fontSize: 13, color: 'var(--text-faint)' }}>Aucun upload public.</p>}
          </div>
        )}

        {tab === 'security' && (
          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <div style={{ padding: '14px 16px 0', fontSize: 12, color: 'var(--text-faint)' }}>Tentatives de déverrouillage de liens protégés par mot de passe, regroupées par IP sur les dernières 24h.</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={S.th}>IP</th>
                  <th style={S.th}>Token du lien</th>
                  <th style={S.th}>Tentatives</th>
                  <th style={S.th}>Dernière tentative</th>
                </tr>
              </thead>
              <tbody>
                {initialAbuseAttempts.map((a, i) => (
                  <tr key={i}>
                    <td style={S.td}>{a.ip}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{a.token}</td>
                    <td style={{ ...S.td, color: a.attempts >= 10 ? 'var(--danger)' : 'var(--text)', fontWeight: a.attempts >= 10 ? 700 : 400 }}>{a.attempts}</td>
                    <td style={S.td}>{fmtDate(a.last_attempt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {initialAbuseAttempts.length === 0 && <p style={{ padding: 20, fontSize: 13, color: 'var(--text-faint)' }}>Aucune tentative de déverrouillage sur les dernières 24h.</p>}
          </div>
        )}

        {tab === 'links' && (
          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Cible</th>
                  <th style={S.th}>Vues</th>
                  <th style={S.th}>Mot de passe</th>
                  <th style={S.th}>Créé le</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id}>
                    <td style={S.td}>{l.type === 'photo' ? 'Photo' : 'Album'}</td>
                    <td style={S.td}>{l.target_name || `#${l.target_id}`}</td>
                    <td style={S.td}>{l.view_count}</td>
                    <td style={S.td}>{l.has_password ? 'Oui' : 'Non'}</td>
                    <td style={S.td}>{fmtDate(l.created_at)}</td>
                    <td style={S.td}>
                      <button title="Révoquer le lien" style={S.iconBtn(true)} onClick={() => setConfirm({ kind: 'revoke-link', id: l.id, label: l.target_name || `#${l.target_id}` })}><IconClose size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {links.length === 0 && <p style={{ padding: 20, fontSize: 13, color: 'var(--text-faint)' }}>Aucun lien de partage actif.</p>}
          </div>
        )}
      </main>

      {confirm && (
        <div style={S.modal} onClick={() => { if (!busy) setConfirm(null) }}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(240,88,107,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--danger)' }}>
                {confirm.kind === 'logout-user' ? <IconLogout size={20} /> : <IconTrash size={20} />}
              </div>
              <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                {confirm.kind === 'delete-user' && 'Supprimer ce compte ?'}
                {confirm.kind === 'logout-user' && 'Forcer la déconnexion ?'}
                {confirm.kind === 'delete-upload' && 'Supprimer cet upload ?'}
                {confirm.kind === 'revoke-link' && 'Révoquer ce lien ?'}
              </h3>
              <p style={{ color: 'var(--text-faint)', fontSize: 11, wordBreak: 'break-all' }}>{confirm.label}</p>
              {confirm.kind === 'delete-user' && <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>Ses albums, photos et sessions seront supprimés, ainsi que ses fichiers sur le disque. Action irréversible.</p>}
              {confirm.kind === 'delete-upload' && <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>Le lien public deviendra immédiatement invalide.</p>}
              {confirm.kind === 'revoke-link' && <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>Le lien de partage cessera immédiatement de fonctionner.</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
              <button onClick={runConfirm} disabled={busy} style={{ flex: 1, background: 'var(--danger)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{busy ? '…' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setPreview(null)}>
          <button onClick={() => setPreview(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClose size={16} /></button>
          <img src={preview.url} alt={preview.label} onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', objectFit: 'contain', borderRadius: 4 }} />
          <span style={{ marginTop: 14, fontSize: 12, color: 'var(--text-faint)', wordBreak: 'break-all', textAlign: 'center' }}>{preview.label}</span>
        </div>
      )}
    </>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-faint)', fontSize: 12, marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value.toLocaleString('fr-FR')}</div>
    </div>
  )
}
