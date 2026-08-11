'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Logo, IconShield, IconUsers, IconImage, IconFolder, IconLink, IconTrash, IconLogout, IconClose, IconUpload, IconEyeOff, IconChevronLeft } from './icons'

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
  last_login: string | null
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

interface AdminAlbum {
  id: number
  name: string
  photo_count: number
}

interface AdminPhoto {
  id: number
  album_id: number | null
  filename: string
  thumb_filename: string | null
  original_name: string | null
  caption: string | null
  size: number
  nsfw: number
  created_at: string
  url: string
  thumbUrl: string
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
  const [viewingUser, setViewingUser] = useState<{ id: number; name: string } | null>(null)
  const [userFiles, setUserFiles] = useState<{ albums: AdminAlbum[]; photos: AdminPhoto[] } | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [usersSort, setUsersSort] = useState<SortState>({ key: 'created_at', dir: 'desc' })
  const [uploadsSort, setUploadsSort] = useState<SortState>({ key: 'created_at', dir: 'desc' })
  const [securitySort, setSecuritySort] = useState<SortState>({ key: 'attempts', dir: 'desc' })
  const [linksSort, setLinksSort] = useState<SortState>({ key: 'created_at', dir: 'desc' })

  const openUserFiles = async (u: AdminUser) => {
    setViewingUser({ id: u.id, name: u.discord_name })
    setUserFiles(null)
    setFilesLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${u.id}/photos`)
      if (!res.ok) throw new Error('Échec du chargement des fichiers')
      setUserFiles(await res.json())
    } catch (e: any) {
      toast.error(e.message || 'Une erreur est survenue')
      setViewingUser(null)
    } finally {
      setFilesLoading(false)
    }
  }

  const toggleNsfw = async (photoId: number, next: boolean) => {
    const res = await fetch(`/api/admin/photos/${photoId}/nsfw`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nsfw: next }),
    })
    if (!res.ok) { toast.error('Échec de la mise à jour'); return }
    setUserFiles(f => f ? { ...f, photos: f.photos.map(p => p.id === photoId ? { ...p, nsfw: next ? 1 : 0 } : p) } : f)
  }

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

        {tab === 'users' && !viewingUser && (
          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <SortTh label="Utilisateur" sortKey="discord_name" sort={usersSort} onSort={setUsersSort} />
                  <SortTh label="Inscrit le" sortKey="created_at" sort={usersSort} onSort={setUsersSort} />
                  <SortTh label="Photos" sortKey="photo_count" sort={usersSort} onSort={setUsersSort} />
                  <SortTh label="Albums" sortKey="album_count" sort={usersSort} onSort={setUsersSort} />
                  <SortTh label="Sessions actives" sortKey="active_sessions" sort={usersSort} onSort={setUsersSort} />
                  <SortTh label="Dernière connexion" sortKey="last_login" sort={usersSort} onSort={setUsersSort} />
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortRows(users, usersSort, {
                  discord_name: u => u.discord_name,
                  created_at: u => u.created_at,
                  photo_count: u => u.photo_count,
                  album_count: u => u.album_count,
                  active_sessions: u => u.active_sessions,
                  last_login: u => u.last_login,
                }).map(u => (
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
                    <td style={S.td}>{u.last_login ? fmtDate(u.last_login) : 'Jamais'}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          title="Voir les fichiers"
                          style={S.iconBtn()}
                          onClick={() => openUserFiles(u)}
                        ><IconImage size={14} /></button>
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

        {tab === 'users' && viewingUser && (
          <div>
            <button
              onClick={() => { setViewingUser(null); setUserFiles(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16 }}
            ><IconChevronLeft size={16} /> Retour aux utilisateurs</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <IconImage size={16} style={{ color: 'var(--accent)' }} />
              <h2 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Fichiers de {viewingUser.name}</h2>
            </div>

            {filesLoading && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Chargement…</p>}

            {userFiles && (
              <>
                {userFiles.albums.filter(a => a.photo_count > 0).map(a => (
                  <UserPhotoSection
                    key={a.id}
                    title={a.name}
                    photos={userFiles.photos.filter(p => p.album_id === a.id)}
                    onPreview={setPreview}
                    onToggleNsfw={toggleNsfw}
                  />
                ))}
                <UserPhotoSection
                  title="Sans album"
                  photos={userFiles.photos.filter(p => p.album_id === null)}
                  onPreview={setPreview}
                  onToggleNsfw={toggleNsfw}
                />
                {userFiles.photos.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Aucune photo.</p>}
              </>
            )}
          </div>
        )}

        {tab === 'uploads' && (
          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <SortTh label="Fichier" sortKey="name" sort={uploadsSort} onSort={setUploadsSort} />
                  <SortTh label="Taille" sortKey="size" sort={uploadsSort} onSort={setUploadsSort} />
                  <SortTh label="IP" sortKey="ip" sort={uploadsSort} onSort={setUploadsSort} />
                  <SortTh label="Envoyé le" sortKey="created_at" sort={uploadsSort} onSort={setUploadsSort} />
                  <SortTh label="Expiration" sortKey="expires_at" sort={uploadsSort} onSort={setUploadsSort} />
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortRows(uploads, uploadsSort, {
                  name: u => u.original_name || u.filename,
                  size: u => u.size,
                  ip: u => u.ip,
                  created_at: u => u.created_at,
                  expires_at: u => u.expires_at,
                }).map(u => (
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
                  <SortTh label="IP" sortKey="ip" sort={securitySort} onSort={setSecuritySort} />
                  <SortTh label="Token du lien" sortKey="token" sort={securitySort} onSort={setSecuritySort} />
                  <SortTh label="Tentatives" sortKey="attempts" sort={securitySort} onSort={setSecuritySort} />
                  <SortTh label="Dernière tentative" sortKey="last_attempt" sort={securitySort} onSort={setSecuritySort} />
                </tr>
              </thead>
              <tbody>
                {sortRows(initialAbuseAttempts, securitySort, {
                  ip: a => a.ip,
                  token: a => a.token,
                  attempts: a => a.attempts,
                  last_attempt: a => a.last_attempt,
                }).map((a, i) => (
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
                  <SortTh label="Type" sortKey="type" sort={linksSort} onSort={setLinksSort} />
                  <SortTh label="Cible" sortKey="target_name" sort={linksSort} onSort={setLinksSort} />
                  <SortTh label="Propriétaire" sortKey="owner_name" sort={linksSort} onSort={setLinksSort} />
                  <SortTh label="Vues" sortKey="view_count" sort={linksSort} onSort={setLinksSort} />
                  <SortTh label="Mot de passe" sortKey="has_password" sort={linksSort} onSort={setLinksSort} />
                  <SortTh label="Créé le" sortKey="created_at" sort={linksSort} onSort={setLinksSort} />
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortRows(links, linksSort, {
                  type: l => l.type,
                  target_name: l => l.target_name,
                  owner_name: l => l.owner_name,
                  view_count: l => l.view_count,
                  has_password: l => l.has_password,
                  created_at: l => l.created_at,
                }).map(l => (
                  <tr key={l.id}>
                    <td style={S.td}>{l.type === 'photo' ? 'Photo' : 'Album'}</td>
                    <td style={S.td}>{l.target_name || `#${l.target_id}`}</td>
                    <td style={S.td}>{l.owner_name || '—'}</td>
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

function UserPhotoSection({
  title, photos, onPreview, onToggleNsfw,
}: {
  title: string
  photos: AdminPhoto[]
  onPreview: (p: { url: string; label: string }) => void
  onToggleNsfw: (id: number, next: boolean) => void
}) {
  if (photos.length === 0) return null
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <IconFolder size={13} style={{ color: 'var(--text-faint)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>({photos.length})</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        {photos.map(p => (
          <div key={p.id} className="masonry-item" style={{ margin: 0, aspectRatio: '1' }}>
            <img
              src={p.thumbUrl}
              alt={p.caption || p.original_name || ''}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: p.nsfw ? 'blur(16px)' : undefined }}
            />
            {/* L'overlay est au-dessus de l'image dans la pile : c'est lui qui doit
                porter le clic d'ouverture, sinon les clics n'atteignent jamais l'img
                en dessous (même pattern que .masonry-overlay dans PrivateGallery). */}
            <div
              className="masonry-overlay"
              onClick={() => onPreview({ url: p.url, label: p.caption || p.original_name || `Photo #${p.id}` })}
              style={{ justifyContent: 'flex-end', padding: 6, cursor: 'pointer' }}
            >
              <button
                title={p.nsfw ? 'Retirer le marquage sensible' : 'Marquer comme sensible'}
                onClick={e => { e.stopPropagation(); onToggleNsfw(p.id, !p.nsfw) }}
                style={{
                  background: p.nsfw ? 'var(--accent)' : 'rgba(0,0,0,0.55)', color: p.nsfw ? '#0a0a0b' : '#fff',
                  border: 'none', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              ><IconEyeOff size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
