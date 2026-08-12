'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Logo, IconLock, IconImage, IconTrash, IconEdit, IconFolder, IconLink, IconClose, IconChevronLeft, IconChevronRight, IconCheck, IconUpload, IconGrid, IconUsers, IconDownload, IconBell, IconSearch, IconLogout, IconClock, IconEyeOff, IconShield, IconVideo, IconFileText, IconArchive } from './icons'

type ExpiryChoice = '1h' | '24h' | '7d' | '30d' | 'never'

const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: '1h', label: '1 heure' },
  { value: '24h', label: '24 heures' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'never', label: 'Jamais' },
]

const fmtExpiry = (iso: string | null) => {
  if (!iso) return "N'expire jamais"
  return `Expire le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

interface Album { id: number; name: string; description: string | null; photo_count: number; created_at: string; role: 'owner' | 'collaborator'; owner_name?: string; unlisted: number; parent_id: number | null }
interface Photo { id: number; user_id: number; album_id: number | null; filename: string; original_name: string | null; caption: string | null; size: number; created_at: string; url: string; thumbUrl: string; uploader_name?: string | null; uploader_avatar?: string | null; nsfw: number; file_type: 'image' | 'video' | 'text' | 'archive'; mime_type: string | null; processing_status: 'ready' | 'pending' | 'processing' | 'failed' }
interface TextPreview { type: 'text'; content: string; truncated: boolean }
interface ArchivePreview { type: 'archive'; entries: { name: string; size: number }[] }
interface User { id: number; discord_id: string | null; discord_name: string; discord_avatar: string | null }
interface Collaborator { id: number; invited_name: string; user_id: number | null; discord_name: string | null; discord_avatar: string | null; created_at: string }
interface JoinRequest { id: number; user_id: number; discord_name: string; discord_avatar: string | null; created_at: string }
interface NotifJoinRequest extends JoinRequest { album_id: number; album_name: string }
interface Invite { id: number; album_id: number; album_name: string; owner_name: string; created_at: string }
interface DiscoverAlbum { id: number; name: string; description: string | null; photoCount: number; access: 'owner' | 'collaborator' | 'pending' | null }
interface Profile {
  discord_id: string | null; discord_name: string; discord_username: string | null; discord_avatar: string | null
  member_since: string; photo_count: number; total_size: number; album_count: number; collab_album_count: number
  uploaded_this_hour: number; upload_hour_limit: number
}
interface SessionInfo { id: number; created_at: string; expires_at: string; user_agent: string | null; current: boolean }

const fmt = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

// Le MIME type d'un .rar est peu fiable côté navigateur : on filtre aussi sur l'extension.
const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.txt', '.rar']
const isAcceptedUploadFile = (f: File) => {
  if (f.type.startsWith('image/') || f.type.startsWith('video/')) return true
  const name = f.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext))
}

const describeUA = (ua: string | null) => {
  if (!ua) return 'Appareil inconnu'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Appareil'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur'
  return `${browser} sur ${os}`
}

// Animations d'entrée partagées par tous les modals (pas d'exit animation :
// le contenu de plusieurs modals dépend d'un state nullable qui redevient null
// à la fermeture, donc jouer une sortie animée re-render souvent sur des
// données déjà effacées).
const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
const cardMotion = { initial: { opacity: 0, scale: 0.96, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, transition: { duration: 0.18, ease: 'easeOut' as const } }

export default function PrivateGallery({ user, isAdmin, initialAlbums, initialPhotos }: { user: User; isAdmin?: boolean; initialAlbums: Album[]; initialPhotos: Photo[] }) {
  const [albums, setAlbums] = useState<Album[]>(initialAlbums)
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [preview, setPreview] = useState<TextPreview | ArchivePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [mediaView, setMediaView] = useState<'photos' | 'albums'>('photos')
  useEffect(() => {
    const saved = localStorage.getItem('mediaView')
    if (saved === 'albums') setMediaView('albums')
  }, [])
  const changeMediaView = (v: 'photos' | 'albums') => {
    setMediaView(v)
    localStorage.setItem('mediaView', v)
  }

  const [showUpload, setShowUpload] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [duplicateModal, setDuplicateModal] = useState<{ duplicates: { name: string; existingCreatedAt: string }[]; newCount: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [showNewAlbum, setShowNewAlbum] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')
  const [newAlbumAtRoot, setNewAlbumAtRoot] = useState(false)

  const [renameAlbum, setRenameAlbum] = useState<{ id: number; name: string } | null>(null)
  const [editCaption, setEditCaption] = useState<{ id: number; value: string } | null>(null)
  const [moveModal, setMoveModal] = useState<{ ids: number[]; albumId: number | null | undefined } | null>(null)
  const [moveAlbumModal, setMoveAlbumModal] = useState<{ id: number; name: string } | null>(null)

  // Dossiers dépliés dans la sidebar arborescente (état purement local, pas persisté).
  const [expandedAlbums, setExpandedAlbums] = useState<Set<number>>(new Set())
  const toggleExpandAlbum = (id: number) => setExpandedAlbums(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null)

  // Contenu marqué sensible : flouté par défaut pour tout le monde, y compris le propriétaire.
  // La révélation n'est qu'un état d'affichage local, elle ne persiste pas entre les rechargements.
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const revealPhoto = (id: number) => setRevealed(prev => new Set(prev).add(id))

  const [shareModal, setShareModal] = useState<{ type: 'photo' | 'album'; id: number; name: string; filename?: string } | null>(null)
  const [shareData, setShareData] = useState<{ shared: boolean; url?: string; token?: string; hasPassword?: boolean; viewCount?: number; expiresAt?: string | null } | null>(null)
  const [sharePwd, setSharePwd] = useState('')
  const [shareUsePwd, setShareUsePwd] = useState(false)
  const [shareExpiry, setShareExpiry] = useState<ExpiryChoice>('never')
  const [shareLoading, setShareLoading] = useState(false)

  const [deleteModal, setDeleteModal] = useState<{ type: 'photo' | 'album' | 'photos' | 'leave-album'; id?: number; ids?: number[]; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [collabModal, setCollabModal] = useState<{ albumId: number; name: string } | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [collabInput, setCollabInput] = useState('')
  const [collabError, setCollabError] = useState('')
  const [collabLoading, setCollabLoading] = useState(false)
  const [collabJoinRequests, setCollabJoinRequests] = useState<JoinRequest[]>([])

  const [notifInvites, setNotifInvites] = useState<Invite[]>([])
  const [notifJoinRequests, setNotifJoinRequests] = useState<NotifJoinRequest[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const [showDiscover, setShowDiscover] = useState(false)
  const [discoverQuery, setDiscoverQuery] = useState('')
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState('')
  const [discoverUser, setDiscoverUser] = useState<{ discord_name: string; discord_avatar: string | null } | null>(null)
  const [discoverAlbums, setDiscoverAlbums] = useState<DiscoverAlbum[]>([])

  const [showProfile, setShowProfile] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [sessionsBusy, setSessionsBusy] = useState(false)
  const openProfile = async () => {
    setShowProfile(true)
    setProfile(null)
    setSessions(null)
    const [pr, sr] = await Promise.all([fetch('/api/profile'), fetch('/api/sessions')])
    if (pr.ok) setProfile(await pr.json())
    if (sr.ok) setSessions(await sr.json())
  }
  const handleDeleteSession = async (id: number) => {
    setSessions(prev => prev ? prev.filter(s => s.id !== id) : prev)
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    toast.success('Session déconnectée')
  }
  const handleLogoutOthers = async () => {
    setSessionsBusy(true)
    const r = await fetch('/api/sessions', { method: 'DELETE' })
    const d = await r.json().catch(() => null)
    setSessions(prev => prev ? prev.filter(s => s.current) : prev)
    setSessionsBusy(false)
    toast.success(d?.deleted ? `${d.deleted} session(s) déconnectée(s)` : 'Autres sessions déconnectées')
  }

  const selectedAlbumObj = selectedAlbum !== null ? albums.find(a => a.id === selectedAlbum) : null
  const ownedAlbums = albums.filter(a => a.role !== 'collaborator')
  const sharedAlbums = albums.filter(a => a.role === 'collaborator')
  const albumCover = (albumId: number) => photos.find(p => p.album_id === albumId)?.thumbUrl
  const openAlbumFromGrid = (albumId: number) => { setSelectedAlbum(albumId); changeMediaView('photos') }

  // Groupe une liste d'albums par parent_id pour construire une arborescence.
  // Si le parent d'un album n'appartient pas à CETTE liste (ex: sous-dossier créé
  // dans l'album partagé de quelqu'un d'autre), on l'affiche comme racine de la
  // liste plutôt que de le faire disparaître silencieusement.
  const buildAlbumTree = (items: Album[]): Map<number | null, Album[]> => {
    const ids = new Set(items.map(a => a.id))
    const byParent = new Map<number | null, Album[]>()
    for (const a of items) {
      const key = a.parent_id !== null && ids.has(a.parent_id) ? a.parent_id : null
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key)!.push(a)
    }
    return byParent
  }
  const ownedTree = buildAlbumTree(ownedAlbums)
  const sharedTree = buildAlbumTree(sharedAlbums)
  const rootAlbums = [...ownedAlbums, ...sharedAlbums].filter(a => a.parent_id === null)
  const subAlbums = selectedAlbum !== null ? albums.filter(a => a.parent_id === selectedAlbum) : []

  // Chemin depuis la racine jusqu'à l'album sélectionné, pour le fil d'ariane.
  const albumPath: Album[] = (() => {
    if (selectedAlbum === null) return []
    const path: Album[] = []
    const visited = new Set<number>()
    let current = albums.find(a => a.id === selectedAlbum)
    while (current && !visited.has(current.id)) {
      path.unshift(current)
      visited.add(current.id)
      current = current.parent_id !== null ? albums.find(a => a.id === current!.parent_id) : undefined
    }
    return path
  })()

  // Descendants d'un album (tous niveaux), pour exclure côté client les cibles de
  // déplacement invalides avant même l'aller-retour serveur (qui les rejette de
  // toute façon en dernier recours).
  const getDescendantIds = (id: number): Set<number> => {
    const result = new Set<number>()
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const a of albums) {
        if (a.parent_id === cur && !result.has(a.id)) {
          result.add(a.id)
          stack.push(a.id)
        }
      }
    }
    return result
  }

  // Aplatit l'arborescence des albums possédés (avec profondeur) pour la modale de
  // déplacement, en excluant l'album qu'on déplace et tous ses descendants.
  const flattenOwnedForMove = (excludeIds: Set<number>): { album: Album; depth: number }[] => {
    const result: { album: Album; depth: number }[] = []
    const walk = (parentId: number | null, depth: number) => {
      for (const a of ownedTree.get(parentId) || []) {
        if (excludeIds.has(a.id)) continue
        result.push({ album: a, depth })
        walk(a.id, depth + 1)
      }
    }
    walk(null, 0)
    return result
  }

  // Rendu récursif d'une ligne d'album dans la sidebar (et de ses enfants s'il est
  // déplié) : indentation par niveau via marginLeft imbriqué, chevron d'expansion
  // uniquement si l'album a des enfants dans cette section (possédée ou partagée).
  const renderAlbumNode = (a: Album, tree: Map<number | null, Album[]>, shared: boolean): React.ReactNode => {
    const children = tree.get(a.id) || []
    const hasChildren = children.length > 0
    const expanded = expandedAlbums.has(a.id)
    return (
      <div key={a.id}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          {hasChildren ? (
            <button onClick={() => toggleExpandAlbum(a.id)} title={expanded ? 'Réduire' : 'Déplier'} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}>
              <IconChevronRight size={11} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
          ) : (
            <span style={{ width: 19, flexShrink: 0 }} />
          )}
          <button onClick={() => setSelectedAlbum(a.id)} title={shared && a.owner_name ? `Album de ${a.owner_name}` : undefined} style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, background: selectedAlbum === a.id ? 'rgba(91,141,239,0.12)' : 'transparent', color: selectedAlbum === a.id ? 'var(--accent)' : 'var(--text-dim)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '7px 10px', fontSize: 13, cursor: 'pointer', overflow: 'hidden' }}>
            {shared ? <IconUsers size={14} style={{ flexShrink: 0 }} /> : <IconFolder size={14} style={{ flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            <span style={{ color: 'var(--text-faint)', marginLeft: 'auto', flexShrink: 0 }}>{a.photo_count}</span>
          </button>
          {!shared ? (
            <>
              <button onClick={() => openCollab(a.id, a.name)} title="Collaborateurs" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 6 }}><IconUsers size={13} /></button>
              <button onClick={() => setMoveAlbumModal({ id: a.id, name: a.name })} title="Déplacer" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 6 }}><IconFolder size={13} /></button>
              <button onClick={() => setRenameAlbum({ id: a.id, name: a.name })} title="Renommer" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 6 }}><IconEdit size={13} /></button>
            </>
          ) : (
            <button onClick={() => setDeleteModal({ type: 'leave-album', id: a.id, name: a.name })} title="Quitter l'album" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 6 }}><IconLogout size={13} /></button>
          )}
        </div>
        {hasChildren && expanded && (
          <div style={{ marginLeft: 19 }}>
            {children.map(c => renderAlbumNode(c, tree, shared))}
          </div>
        )}
      </div>
    )
  }

  // Déplie automatiquement les ancêtres de l'album sélectionné pour qu'il reste
  // visible dans la sidebar quand on y arrive via le fil d'ariane ou une tuile
  // de sous-dossier plutôt que par un clic direct dans l'arbre.
  useEffect(() => {
    if (selectedAlbum === null) return
    const ancestorIds = albumPath.slice(0, -1).map(a => a.id)
    if (!ancestorIds.length) return
    setExpandedAlbums(prev => {
      const next = new Set(prev)
      let changed = false
      for (const id of ancestorIds) if (!next.has(id)) { next.add(id); changed = true }
      return changed ? next : prev
    })
  }, [selectedAlbum])

  const refreshAlbums = async () => {
    const r = await fetch('/api/albums')
    if (r.ok) setAlbums(await r.json())
  }
  const refreshPhotos = async () => {
    const r = await fetch('/api/private-photos')
    if (r.ok) setPhotos(await r.json())
  }
  const refreshCurrent = async () => {
    await refreshPhotos()
    if (selectedAlbum !== null) {
      const r = await fetch(`/api/private-photos?album_id=${selectedAlbum}`)
      if (r.ok) setAlbumPhotos(await r.json())
    }
  }

  const basePhotos = selectedAlbum === null ? photos : albumPhotos
  const [searchQuery, setSearchQuery] = useState('')
  const visiblePhotos = (() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return basePhotos
    return basePhotos.filter(p =>
      (p.caption || '').toLowerCase().includes(q) ||
      (p.original_name || '').toLowerCase().includes(q) ||
      (p.uploader_name || '').toLowerCase().includes(q)
    )
  })()
  const canSharePhoto = (p: Photo) => p.user_id === user.id || selectedAlbumObj?.role === 'owner'

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); setLastSelectedIdx(null) }
  const openBulkMove = () => { if (selectedIds.size) setMoveModal({ ids: Array.from(selectedIds), albumId: undefined }) }
  const openBulkDelete = () => { if (selectedIds.size) setDeleteModal({ type: 'photos', ids: Array.from(selectedIds), name: `${selectedIds.size} photo(s)` }) }
  const openBulkNsfw = async () => {
    if (!selectedIds.size) return
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map(id => fetch(`/api/private-photos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nsfw: true }) })))
    setSelectedIds(new Set())
    await refreshCurrent()
    toast.success(`${ids.length} photo(s) marquée(s) sensible(s)`)
  }

  const handlePhotoClick = (e: React.MouseEvent, idx: number, id: number) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (!selectMode) setSelectMode(true)
      toggleSelect(id)
      setLastSelectedIdx(idx)
      return
    }
    if (e.shiftKey) {
      e.preventDefault()
      if (!selectMode) setSelectMode(true)
      const start = lastSelectedIdx !== null ? lastSelectedIdx : idx
      const [from, to] = start <= idx ? [start, idx] : [idx, start]
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (let i = from; i <= to; i++) next.add(visiblePhotos[i].id)
        return next
      })
      setLastSelectedIdx(idx)
      return
    }
    if (selectMode) {
      toggleSelect(id)
      setLastSelectedIdx(idx)
    } else {
      setLightbox(idx)
    }
  }

  useEffect(() => {
    if (selectedAlbum === null) return
    let cancelled = false
    fetch(`/api/private-photos?album_id=${selectedAlbum}`).then(r => r.ok ? r.json() : []).then(d => { if (!cancelled) setAlbumPhotos(d) })
    return () => { cancelled = true }
  }, [selectedAlbum])

  useEffect(() => { setSelectedIds(new Set()); setLastSelectedIdx(null); setSearchQuery('') }, [selectedAlbum])

  // Les vidéos sont compressées de façon asynchrone côté serveur : tant qu'il en reste
  // en file d'attente, on refetch périodiquement pour récupérer le statut à jour.
  useEffect(() => {
    const current = selectedAlbum === null ? photos : albumPhotos
    const hasProcessing = current.some(p => p.file_type === 'video' && (p.processing_status === 'pending' || p.processing_status === 'processing'))
    if (!hasProcessing) return
    const interval = setInterval(() => { refreshCurrent() }, 6000)
    return () => clearInterval(interval)
  }, [photos, albumPhotos, selectedAlbum])

  useEffect(() => {
    if (!showUpload) return
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.items || [])
        .filter(i => i.type.startsWith('image/'))
        .map(i => i.getAsFile())
        .filter((f): f is File => !!f)
      if (images.length) setUploadFiles(prev => [...prev, ...images])
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [showUpload])

  const refreshNotifications = async () => {
    const r = await fetch('/api/notifications')
    if (r.ok) {
      const d = await r.json()
      setNotifInvites(d.invites)
      setNotifJoinRequests(d.joinRequests)
    }
  }
  useEffect(() => { refreshNotifications() }, [])

  const respondNotifJoinRequest = async (albumId: number, reqId: number, action: 'accept' | 'refuse') => {
    setNotifJoinRequests(prev => prev.filter(r => r.id !== reqId))
    await fetch(`/api/albums/${albumId}/join-requests/${reqId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    await refreshAlbums()
    if (collabModal?.albumId === albumId) {
      const r2 = await fetch(`/api/albums/${albumId}/collaborators`)
      if (r2.ok) setCollaborators(await r2.json())
      const r3 = await fetch(`/api/albums/${albumId}/join-requests`)
      if (r3.ok) setCollabJoinRequests(await r3.json())
    }
  }

  const handleLeaveAlbum = async (albumId: number) => {
    await fetch(`/api/albums/${albumId}/leave`, { method: 'DELETE' })
    if (selectedAlbum === albumId) setSelectedAlbum(null)
    await refreshAlbums()
  }

  useEffect(() => {
    if (!showNotifs) return
    const fn = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false) }
    window.addEventListener('mousedown', fn)
    return () => window.removeEventListener('mousedown', fn)
  }, [showNotifs])

  const dismissInvite = async (id: number) => {
    setNotifInvites(prev => prev.filter(i => i.id !== id))
    await fetch('/api/notifications/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  useEffect(() => {
    if (lightbox === null) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft') setLightbox(i => (i !== null && i > 0 ? i - 1 : i))
      if (e.key === 'ArrowRight') setLightbox(i => (i !== null && i < visiblePhotos.length - 1 ? i + 1 : i))
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [lightbox, visiblePhotos.length])

  useEffect(() => {
    const p = lightbox !== null ? visiblePhotos[lightbox] : null
    if (!p || (p.file_type !== 'text' && p.file_type !== 'archive')) { setPreview(null); setPreviewLoading(false); return }
    let cancelled = false
    setPreview(null)
    setPreviewLoading(true)
    fetch(`/api/private-photos/${p.id}/preview`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) { setPreview(d); setPreviewLoading(false) } })
      .catch(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [lightbox])

  const handleUpload = async (duplicateAction?: 'upload_anyway' | 'skip_duplicates') => {
    if (!uploadFiles.length || uploading) return
    setUploading(true)
    setUploadError('')
    const fd = new FormData()
    if (selectedAlbum !== null) fd.append('album_id', String(selectedAlbum))
    if (duplicateAction) fd.append('duplicate_action', duplicateAction)
    uploadFiles.forEach(f => fd.append('files', f))
    const r = await fetch('/api/private-photos', { method: 'POST', body: fd })
    const d = await r.json()
    setUploading(false)
    if (!r.ok) { setUploadError(d.error || 'Erreur upload'); return }
    if (d.needsConfirmation) {
      setDuplicateModal({ duplicates: d.duplicates, newCount: d.newCount })
      return
    }
    setDuplicateModal(null)
    setUploadFiles([])
    setShowUpload(false)
    await refreshCurrent()
    await refreshAlbums()
  }

  const handleUploadAnyway = () => handleUpload('upload_anyway')
  const handleSkipDuplicates = () => handleUpload('skip_duplicates')

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return
    const parentId = selectedAlbum !== null && !newAlbumAtRoot ? selectedAlbum : null
    const r = await fetch('/api/albums', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newAlbumName.trim(), parent_id: parentId }) })
    if (r.ok) {
      setNewAlbumName('')
      setShowNewAlbum(false)
      await refreshAlbums()
      toast.success('Album créé')
    } else {
      toast.error('Erreur lors de la création de l\'album')
    }
  }

  const handleMoveAlbum = async (parentId: number | null) => {
    if (!moveAlbumModal) return
    const r = await fetch(`/api/albums/${moveAlbumModal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: parentId }) })
    if (r.ok) {
      setMoveAlbumModal(null)
      await refreshAlbums()
      toast.success('Album déplacé')
    } else {
      const d = await r.json().catch(() => null)
      toast.error(d?.error || 'Erreur lors du déplacement')
    }
  }

  const handleRenameAlbum = async () => {
    if (!renameAlbum || !renameAlbum.name.trim()) return
    await fetch(`/api/albums/${renameAlbum.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameAlbum.name.trim() }) })
    setRenameAlbum(null)
    await refreshAlbums()
    toast.success('Album renommé')
  }

  const handleToggleUnlisted = async (album: Album) => {
    const next = album.unlisted ? false : true
    setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, unlisted: next ? 1 : 0 } : a))
    await fetch(`/api/albums/${album.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unlisted: next }) })
    toast.success(next ? "Album retiré de la recherche" : 'Album visible dans la recherche')
  }

  const handleSaveCaption = async () => {
    if (!editCaption) return
    await fetch(`/api/private-photos/${editCaption.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: editCaption.value }) })
    setEditCaption(null)
    await refreshCurrent()
    toast.success('Légende enregistrée')
  }

  const handleToggleNsfw = async (p: Photo) => {
    const next = p.nsfw ? 0 : 1
    const patch = (arr: Photo[]) => arr.map(x => x.id === p.id ? { ...x, nsfw: next } : x)
    setPhotos(patch)
    setAlbumPhotos(patch)
    await fetch(`/api/private-photos/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nsfw: !!next }) })
    toast.success(next ? 'Photo marquée comme sensible' : 'Marquage retiré')
  }

  const handleMove = async (albumId: number | null) => {
    if (!moveModal) return
    const count = moveModal.ids.length
    await Promise.all(moveModal.ids.map(id =>
      fetch(`/api/private-photos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ album_id: albumId }) })
    ))
    setMoveModal(null)
    if (moveModal.ids.length > 1) setSelectedIds(new Set())
    await refreshCurrent()
    await refreshAlbums()
    toast.success(count > 1 ? `${count} photos déplacées` : 'Photo déplacée')
  }

  const openShare = async (type: 'photo' | 'album', id: number, name: string, filename?: string) => {
    setShareModal({ type, id, name, filename })
    setShareData(null)
    setSharePwd('')
    setShareUsePwd(false)
    setShareExpiry('never')
    const r = await fetch(`/api/share?type=${type}&target_id=${id}`)
    const d = await r.json()
    setShareData(d)
    if (d.shared && d.hasPassword) setShareUsePwd(true)
  }

  const handleCreateShare = async () => {
    if (!shareModal) return
    setShareLoading(true)
    const r = await fetch('/api/share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: shareModal.type, target_id: shareModal.id, password: shareUsePwd ? sharePwd : undefined, expires_in: shareExpiry }),
    })
    const d = await r.json()
    setShareLoading(false)
    if (r.ok) { setShareData({ shared: true, url: d.url, token: d.token, hasPassword: shareUsePwd && !!sharePwd, expiresAt: d.expiresAt }); toast.success('Lien de partage créé') }
    else toast.error(d.error || 'Erreur lors de la création du lien')
  }

  const handleRevokeShare = async () => {
    if (!shareModal) return
    setShareLoading(true)
    await fetch('/api/share', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: shareModal.type, target_id: shareModal.id }) })
    setShareLoading(false)
    setShareData({ shared: false })
    toast.success('Lien de partage révoqué')
  }

  const copyShareLink = () => {
    if (!shareData?.url) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareData.url).then(() => toast.success('Lien copié'))
    }
  }

  const copyHotlink = (url: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => toast.success('Lien copié'))
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    if (deleteModal.type === 'photo') {
      await fetch(`/api/private-photos/${deleteModal.id}`, { method: 'DELETE' })
      await refreshCurrent()
      await refreshAlbums()
      toast.success('Photo supprimée')
    } else if (deleteModal.type === 'photos') {
      const count = (deleteModal.ids || []).length
      await Promise.all((deleteModal.ids || []).map(id => fetch(`/api/private-photos/${id}`, { method: 'DELETE' })))
      setSelectedIds(new Set())
      await refreshCurrent()
      await refreshAlbums()
      toast.success(`${count} photos supprimées`)
    } else if (deleteModal.type === 'leave-album') {
      await handleLeaveAlbum(deleteModal.id!)
      toast.success('Album quitté')
    } else {
      await fetch(`/api/albums/${deleteModal.id}`, { method: 'DELETE' })
      if (selectedAlbum === deleteModal.id) setSelectedAlbum(null)
      await refreshAlbums()
      await refreshPhotos()
      toast.success('Album supprimé')
    }
    setDeleting(false)
    setDeleteModal(null)
  }

  const openCollab = async (albumId: number, name: string) => {
    setCollabModal({ albumId, name })
    setCollaborators([])
    setCollabJoinRequests([])
    setCollabInput('')
    setCollabError('')
    const r = await fetch(`/api/albums/${albumId}/collaborators`)
    if (r.ok) setCollaborators(await r.json())
    const r2 = await fetch(`/api/albums/${albumId}/join-requests`)
    if (r2.ok) setCollabJoinRequests(await r2.json())
  }

  const handleJoinRequest = async (reqId: number, action: 'accept' | 'refuse') => {
    if (!collabModal) return
    setCollabJoinRequests(prev => prev.filter(r => r.id !== reqId))
    const r = await fetch(`/api/albums/${collabModal.albumId}/join-requests/${reqId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    if (r.ok && action === 'accept') {
      const r2 = await fetch(`/api/albums/${collabModal.albumId}/collaborators`)
      if (r2.ok) setCollaborators(await r2.json())
    }
    await refreshNotifications()
  }

  const handleInviteCollab = async () => {
    if (!collabModal || !collabInput.trim()) return
    setCollabLoading(true)
    setCollabError('')
    const r = await fetch(`/api/albums/${collabModal.albumId}/collaborators`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discord_tag: collabInput.trim() }),
    })
    const d = await r.json()
    setCollabLoading(false)
    if (!r.ok) { setCollabError(d.error || 'Erreur'); return }
    setCollaborators(prev => [...prev, d])
    setCollabInput('')
    toast.success('Co-éditeur invité')
  }

  const handleRemoveCollab = async (id: number) => {
    if (!collabModal) return
    setCollaborators(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/albums/${collabModal.albumId}/collaborators/${id}`, { method: 'DELETE' })
    toast.success('Co-éditeur retiré')
  }

  const handleDiscoverSearch = async () => {
    if (!discoverQuery.trim()) return
    setDiscoverLoading(true)
    setDiscoverError('')
    setDiscoverUser(null)
    setDiscoverAlbums([])
    const r = await fetch(`/api/albums/discover?username=${encodeURIComponent(discoverQuery.trim())}`)
    const d = await r.json()
    setDiscoverLoading(false)
    if (!r.ok) { setDiscoverError(d.error || 'Erreur'); return }
    setDiscoverUser(d.user)
    setDiscoverAlbums(d.albums)
  }

  const handleRequestJoin = async (albumId: number) => {
    setDiscoverAlbums(prev => prev.map(a => a.id === albumId ? { ...a, access: 'pending' } : a))
    const r = await fetch(`/api/albums/${albumId}/join-requests`, { method: 'POST' })
    if (!r.ok) {
      const d = await r.json().catch(() => null)
      setDiscoverError(d?.error || 'Erreur lors de la demande')
      setDiscoverAlbums(prev => prev.map(a => a.id === albumId ? { ...a, access: null } : a))
    } else {
      toast.success('Demande envoyée')
    }
  }

  const cur = lightbox !== null ? visiblePhotos[lightbox] : null

  const videoStatusLabel = (p: Photo) => p.processing_status === 'failed' ? 'Échec du traitement' : 'Traitement en cours…'

  // Rendu de la vignette dans la grille : image inchangée, vidéo avec poster + overlay ▶
  // (ou statut de traitement tant que la version compressée n'est pas prête), texte/archive
  // avec une icône générique. thumbUrl d'une vidéo n'est fiable qu'une fois processing_status === 'ready'.
  const renderThumb = (p: Photo) => {
    if (p.file_type === 'image') {
      return (
        <img
          src={p.thumbUrl} alt={p.caption || ''} loading="lazy"
          style={p.nsfw && !revealed.has(p.id) ? { filter: 'blur(24px)', transition: 'filter 0.2s' } : undefined}
        />
      )
    }
    if (p.file_type === 'video') {
      const ready = p.processing_status === 'ready'
      return (
        <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-elevated)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {ready
            ? <img src={p.thumbUrl} alt={p.caption || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <IconVideo size={28} style={{ color: 'var(--text-faint)' }} />}
          {ready ? (
            <div style={{ position: 'absolute', width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '11px solid #fff', marginLeft: 3 }} />
            </div>
          ) : (
            <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, textAlign: 'center', fontSize: 10.5, fontWeight: 600, padding: '4px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.55)', color: p.processing_status === 'failed' ? 'var(--danger)' : '#ddd' }}>
              {videoStatusLabel(p)}
            </div>
          )}
        </div>
      )
    }
    return (
      <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 }}>
        {p.file_type === 'text' ? <IconFileText size={26} style={{ color: 'var(--text-faint)' }} /> : <IconArchive size={26} style={{ color: 'var(--text-faint)' }} />}
        <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{p.original_name}</span>
      </div>
    )
  }

  const S = {
    btn: (active = true): React.CSSProperties => ({ background: active ? 'var(--accent)' : 'var(--bg-elevated)', color: active ? '#0a0a0b' : 'var(--text-faint)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }),
    btnGhost: (danger = false): React.CSSProperties => ({ background: danger ? 'rgba(240,88,107,0.12)' : 'var(--bg-elevated)', color: danger ? 'var(--danger)' : 'var(--text-dim)', border: '1px solid ' + (danger ? 'rgba(240,88,107,0.25)' : 'var(--border)'), borderRadius: 'var(--radius-sm)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }),
    input: { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
    modal: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 } as React.CSSProperties,
    card: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 26, width: '100%', maxWidth: 420, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' } as React.CSSProperties,
    iconBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ddd', cursor: 'pointer', textDecoration: 'none' } as React.CSSProperties,
  }

  return (
    <>
      {/* Header */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,11,0.75)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={22} />
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>Picture</span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· Privé</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isAdmin && (
            <a href="/admin" title="Panel admin" style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>
              <IconShield size={14} />
            </a>
          )}
          <a href="/" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>Galerie publique</a>
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifs(v => !v)} title="Notifications" style={{ position: 'relative', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 4 }}>
              <IconBell size={17} />
              {(notifInvites.length > 0 || notifJoinRequests.length > 0) && (
                <span style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
              )}
            </button>
            {showNotifs && (
              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 32, right: 0, width: 300, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 200, maxHeight: 360, overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>Notifications</div>
                {notifInvites.length === 0 && notifJoinRequests.length === 0 ? (
                  <p style={{ padding: 14, fontSize: 12, color: 'var(--text-faint)' }}>Rien de nouveau.</p>
                ) : (
                  <>
                    {notifJoinRequests.map(req => (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        {req.discord_avatar
                          ? <img src={req.discord_avatar} alt="" style={{ width: 20, height: 20, borderRadius: '50%', marginTop: 2, flexShrink: 0 }} />
                          : <IconUsers size={14} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, color: 'var(--text)' }}>{req.discord_name} veut rejoindre <strong>{req.album_name}</strong></p>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button onClick={() => respondNotifJoinRequest(req.album_id, req.id, 'accept')} style={{ background: 'rgba(91,141,239,0.14)', border: 'none', borderRadius: 5, padding: '4px 9px', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Accepter</button>
                            <button onClick={() => respondNotifJoinRequest(req.album_id, req.id, 'refuse')} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: 5, padding: '4px 9px', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}>Refuser</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {notifInvites.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <IconUsers size={14} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, color: 'var(--text)' }}>{inv.owner_name} t'a invité à co-éditer <strong>{inv.album_name}</strong></p>
                          <button onClick={() => { setSelectedAlbum(inv.album_id); dismissInvite(inv.id); setShowNotifs(false) }} style={{ marginTop: 6, background: 'var(--bg-elevated)', border: 'none', borderRadius: 5, padding: '4px 9px', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}>Voir l'album</button>
                        </div>
                        <button onClick={() => dismissInvite(inv.id)} title="Ignorer" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><IconClose size={12} /></button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button onClick={openProfile} title="Mon profil" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}>
            {user.discord_avatar
              ? <img src={user.discord_avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
              : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0b', fontSize: 11, fontWeight: 700 }}>{user.discord_name[0]?.toUpperCase()}</div>}
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{user.discord_name}</span>
          </button>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>Déconnexion</button>
          </form>
        </div>
      </header>

      <div style={{ display: 'flex', paddingTop: 60, minHeight: '100vh', background: 'var(--bg)' }}>
        {/* Sidebar */}
        <aside style={{ width: 224, flexShrink: 0, borderRight: '1px solid var(--border)', padding: 16, height: 'calc(100vh - 60px)', position: 'sticky', top: 60, overflowY: 'auto' }}>
          <button onClick={() => setSelectedAlbum(null)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, background: selectedAlbum === null ? 'rgba(91,141,239,0.12)' : 'transparent', color: selectedAlbum === null ? 'var(--accent)' : 'var(--text-dim)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 4 }}>
            <IconGrid size={14} /> Tous les médias <span style={{ color: 'var(--text-faint)', fontWeight: 400, marginLeft: 'auto' }}>{photos.length}</span>
          </button>

          <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '18px 0 6px 10px' }}>Albums</div>
          {(ownedTree.get(null) || []).map(a => renderAlbumNode(a, ownedTree, false))}

          <button onClick={() => { setShowNewAlbum(true); setNewAlbumAtRoot(false) }} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}>+ Nouvel album</button>
          <button onClick={() => { setShowDiscover(true); setDiscoverQuery(''); setDiscoverUser(null); setDiscoverAlbums([]); setDiscoverError('') }} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', color: 'var(--text-faint)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 12.5, cursor: 'pointer' }}><IconSearch size={12} /> Rechercher un album</button>

          {sharedAlbums.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '18px 0 6px 10px' }}>Partagés avec moi</div>
              {(sharedTree.get(null) || []).map(a => renderAlbumNode(a, sharedTree, true))}
            </>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: 24, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <a href="/a-propos" style={{ fontSize: 10.5, color: 'var(--text-faint)', textDecoration: 'none' }}>À propos</a>
            <a href="/confidentialite" style={{ fontSize: 10.5, color: 'var(--text-faint)', textDecoration: 'none' }}>Confidentialité</a>
            <a href="/conditions-utilisation" style={{ fontSize: 10.5, color: 'var(--text-faint)', textDecoration: 'none' }}>CGU</a>
            <a href="/mentions-legales" style={{ fontSize: 10.5, color: 'var(--text-faint)', textDecoration: 'none' }}>Mentions légales</a>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, padding: 24, minWidth: 0 }}>
          {albumPath.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10, fontSize: 12 }}>
              <button onClick={() => setSelectedAlbum(null)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '2px 4px' }}>Racine</button>
              {albumPath.map(a => (
                <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconChevronRight size={11} style={{ color: 'var(--text-faint)' }} />
                  <button onClick={() => setSelectedAlbum(a.id)} style={{ background: 'none', border: 'none', color: a.id === selectedAlbum ? 'var(--text)' : 'var(--text-faint)', fontWeight: a.id === selectedAlbum ? 600 : 400, cursor: 'pointer', padding: '2px 4px' }}>{a.name}</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h1 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>
                {selectedAlbum === null ? 'Tous les médias' : selectedAlbumObj?.name}
              </h1>
              {selectedAlbumObj?.role === 'collaborator' && selectedAlbumObj.owner_name && (
                <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 2 }}>Partagé par {selectedAlbumObj.owner_name} · tu es co-éditeur</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectMode ? (
                <>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', marginRight: 4 }}>{selectedIds.size} sélectionnée(s)</span>
                  <button onClick={openBulkMove} disabled={!selectedIds.size} style={{ ...S.btnGhost(), opacity: selectedIds.size ? 1 : 0.5, cursor: selectedIds.size ? 'pointer' : 'not-allowed' }}><IconFolder size={13} /> Déplacer</button>
                  <button onClick={openBulkNsfw} disabled={!selectedIds.size} style={{ ...S.btnGhost(), opacity: selectedIds.size ? 1 : 0.5, cursor: selectedIds.size ? 'pointer' : 'not-allowed' }}><IconEyeOff size={13} /> Marquer sensible</button>
                  <button onClick={openBulkDelete} disabled={!selectedIds.size} style={{ ...S.btnGhost(true), opacity: selectedIds.size ? 1 : 0.5, cursor: selectedIds.size ? 'pointer' : 'not-allowed' }}><IconTrash size={13} /> Supprimer</button>
                  <button onClick={exitSelectMode} style={S.btnGhost()}>Terminé</button>
                </>
              ) : (
                <>
                  {!(selectedAlbum === null && mediaView === 'albums') && (
                    <div style={{ position: 'relative', marginRight: 4 }}>
                      <IconSearch size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher…"
                        style={{ width: 160, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 10px 7px 28px', color: 'var(--text)', fontSize: 12.5, outline: 'none' }}
                      />
                    </div>
                  )}
                  {selectedAlbum === null && (
                    <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 3, gap: 2, marginRight: 4 }}>
                      <button onClick={() => changeMediaView('photos')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: mediaView === 'photos' ? 'var(--accent)' : 'transparent', color: mediaView === 'photos' ? '#0a0a0b' : 'var(--text-faint)', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><IconImage size={13} /> Photos</button>
                      <button onClick={() => changeMediaView('albums')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: mediaView === 'albums' ? 'var(--accent)' : 'transparent', color: mediaView === 'albums' ? '#0a0a0b' : 'var(--text-faint)', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><IconFolder size={13} /> Albums</button>
                    </div>
                  )}
                  {selectedAlbum !== null && (
                    <a href={`/api/private-photos/export?album_id=${selectedAlbum}`} title="Télécharger cet album en .zip" style={{ ...S.btnGhost(), textDecoration: 'none' }}><IconDownload size={13} /> Exporter</a>
                  )}
                  {selectedAlbum !== null && selectedAlbumObj?.role === 'owner' && (
                    <>
                      <button onClick={() => selectedAlbumObj && handleToggleUnlisted(selectedAlbumObj)} title={selectedAlbumObj?.unlisted ? "Cet album n'apparaît pas dans la recherche" : 'Cet album est visible dans la recherche par pseudo'} style={S.btnGhost()}><IconLock size={13} /> {selectedAlbumObj?.unlisted ? 'Non listé' : 'Listé'}</button>
                      <button onClick={() => openCollab(selectedAlbum, selectedAlbumObj?.name || '')} style={S.btnGhost()}><IconUsers size={13} /> Collaborateurs</button>
                      <button onClick={() => openShare('album', selectedAlbum, selectedAlbumObj?.name || '')} style={S.btnGhost()}><IconLink size={13} /> Partager l'album</button>
                      <button onClick={() => setDeleteModal({ type: 'album', id: selectedAlbum, name: selectedAlbumObj?.name || '' })} style={S.btnGhost(true)}><IconTrash size={13} /> Supprimer</button>
                    </>
                  )}
                  {!(selectedAlbum === null && mediaView === 'albums') && visiblePhotos.length > 0 && <button onClick={() => setSelectMode(true)} style={S.btnGhost()}><IconCheck size={13} /> Sélectionner</button>}
                  <button onClick={() => setShowUpload(true)} style={S.btn()}><IconUpload size={13} /> Ajouter des photos</button>
                </>
              )}
            </div>
          </div>

          {selectedAlbum === null && mediaView === 'albums' ? (
            albums.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 14 }}>
                <IconFolder size={36} style={{ color: 'var(--text-faint)' }} />
                <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Aucun album pour le moment</p>
                <button onClick={() => setShowNewAlbum(true)} style={S.btn()}>Nouvel album</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                {rootAlbums.map((a, idx) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx, 12) * 0.03 }}
                    onClick={() => openAlbumFromGrid(a.id)} style={{ cursor: 'pointer', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  >
                    <div style={{ aspectRatio: '1 / 1', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {albumCover(a.id)
                        ? <img src={albumCover(a.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <IconFolder size={28} style={{ color: 'var(--text-faint)' }} />}
                    </div>
                    <div style={{ padding: '9px 11px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{a.photo_count} photo{a.photo_count !== 1 ? 's' : ''}{a.role === 'collaborator' && a.owner_name ? ` · ${a.owner_name}` : ''}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            <>
              {selectedAlbum !== null && subAlbums.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Sous-dossiers</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                    {subAlbums.map(a => (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAlbum(a.id)}
                        style={{ cursor: 'pointer', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                      >
                        <div style={{ aspectRatio: '1 / 1', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {albumCover(a.id)
                            ? <img src={albumCover(a.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <IconFolder size={28} style={{ color: 'var(--text-faint)' }} />}
                        </div>
                        <div style={{ padding: '9px 11px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{a.photo_count} photo{a.photo_count !== 1 ? 's' : ''}{a.role === 'collaborator' && a.owner_name ? ` · ${a.owner_name}` : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {visiblePhotos.length === 0 ? (
                selectedAlbum !== null && subAlbums.length > 0 ? (
                  <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Aucune photo directement dans ce dossier.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 14 }}>
                    <IconImage size={36} style={{ color: 'var(--text-faint)' }} />
                    {searchQuery.trim() && basePhotos.length > 0 ? (
                      <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Aucun résultat pour « {searchQuery.trim()} »</p>
                    ) : (
                      <>
                        <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Aucune photo ici</p>
                        <button onClick={() => setShowUpload(true)} style={S.btn()}>Ajouter des photos</button>
                      </>
                    )}
                  </div>
                )
              ) : (
            <div className="masonry">
              {visiblePhotos.map((p, idx) => (
                <div key={p.id} className="masonry-item">
                  <div onClick={e => handlePhotoClick(e, idx, p.id)}>{renderThumb(p)}</div>
                  {p.file_type === 'image' && !!p.nsfw && !revealed.has(p.id) && (
                    <div
                      onClick={e => { e.stopPropagation(); revealPhoto(p.id) }}
                      style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(0,0,0,0.4)', cursor: 'pointer', textAlign: 'center', padding: 10 }}
                    >
                      <IconEyeOff size={22} style={{ color: '#fff' }} />
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Contenu sensible</span>
                      <span style={{ fontSize: 10, color: '#ddd' }}>Cliquer pour afficher</span>
                    </div>
                  )}
                  {selectMode && (
                    <div onClick={e => { e.stopPropagation(); handlePhotoClick(e, idx, p.id) }} style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', background: selectedIds.has(p.id) ? 'var(--accent)' : 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
                      {selectedIds.has(p.id) && <IconCheck size={12} style={{ color: '#0a0a0b' }} />}
                    </div>
                  )}
                  {p.uploader_name && (
                    <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '3px 9px 3px 3px', zIndex: 1 }}>
                      {p.uploader_avatar
                        ? <img src={p.uploader_avatar} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                        : <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#0a0a0b' }}>{p.uploader_name[0]?.toUpperCase()}</div>}
                      <span style={{ fontSize: 10, color: '#eee', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{p.uploader_name}</span>
                    </div>
                  )}
                  {!selectMode && (
                    <div className="masonry-overlay" onClick={e => handlePhotoClick(e, idx, p.id)} style={{ opacity: 1, background: 'linear-gradient(transparent 60%, rgba(0,0,0,0.8) 100%)', alignItems: 'flex-end', justifyContent: 'space-between', flexDirection: 'column', padding: 8, cursor: 'pointer' }}>
                      <div onClick={e => e.stopPropagation()} style={{ alignSelf: 'flex-end', display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditCaption({ id: p.id, value: p.caption || '' })} title="Légende" style={S.iconBtn}><IconEdit size={13} /></button>
                        <button onClick={() => setMoveModal({ ids: [p.id], albumId: p.album_id })} title="Déplacer" style={S.iconBtn}><IconFolder size={13} /></button>
                        <a href={p.url} download={p.original_name || undefined} title="Télécharger" style={S.iconBtn}><IconDownload size={13} /></a>
                        {canSharePhoto(p) && <button onClick={() => handleToggleNsfw(p)} title={p.nsfw ? 'Retirer le marquage sensible' : 'Marquer comme sensible'} style={{ ...S.iconBtn, color: p.nsfw ? 'var(--accent)' : S.iconBtn.color }}><IconEyeOff size={13} /></button>}
                        {canSharePhoto(p) && <button onClick={() => openShare('photo', p.id, p.original_name || 'photo', p.filename)} title="Partager" style={S.iconBtn}><IconLink size={13} /></button>}
                        <button onClick={() => setDeleteModal({ type: 'photo', id: p.id, name: p.original_name || 'cette photo' })} title="Supprimer" style={{ ...S.iconBtn, color: 'var(--danger)' }}><IconTrash size={13} /></button>
                      </div>
                      {p.caption && <span style={{ fontSize: 11, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{p.caption}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {cur && lightbox !== null && (
        <motion.div {...overlayMotion} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}><IconClose size={16} /></button>
          <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '3px 12px', fontSize: 11, color: '#888', zIndex: 2 }}>{lightbox + 1} / {visiblePhotos.length}</div>
          {lightbox > 0 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1) }} style={{ position: 'absolute', left: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}><IconChevronLeft size={22} /></button>}
          {lightbox < visiblePhotos.length - 1 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1) }} style={{ position: 'absolute', right: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}><IconChevronRight size={22} /></button>}
          {cur.file_type === 'image' && (
            <motion.img
              key={cur.id}
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15 }}
              src={cur.url} alt={cur.caption || ''} onClick={e => e.stopPropagation()}
              style={{
                maxWidth: 'calc(100vw - 110px)', maxHeight: 'calc(100vh - 110px)', objectFit: 'contain', borderRadius: 4,
                ...(cur.nsfw && !revealed.has(cur.id) ? { filter: 'blur(40px)', transition: 'filter 0.2s' } : {}),
              }}
            />
          )}
          {cur.file_type === 'video' && (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <video
                key={cur.id} controls src={cur.url}
                style={{ maxWidth: 'calc(100vw - 110px)', maxHeight: 'calc(100vh - 160px)', borderRadius: 4, background: '#000' }}
              />
              {cur.processing_status !== 'ready' && (
                <span style={{ fontSize: 12, color: cur.processing_status === 'failed' ? 'var(--danger)' : '#ccc', background: 'rgba(255,255,255,0.08)', padding: '5px 12px', borderRadius: 20 }}>
                  {cur.processing_status === 'failed' ? "Échec de l'optimisation — la vidéo originale reste lisible" : 'Version optimisée en cours de génération…'}
                </span>
              )}
            </div>
          )}
          {(cur.file_type === 'text' || cur.file_type === 'archive') && (
            <div onClick={e => e.stopPropagation()} style={{ width: 'min(640px, calc(100vw - 110px))', maxHeight: 'calc(100vh - 160px)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                {cur.file_type === 'text' ? <IconFileText size={16} /> : <IconArchive size={16} />}
                {cur.original_name}
              </div>
              {previewLoading ? (
                <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Chargement…</p>
              ) : cur.file_type === 'text' && preview?.type === 'text' ? (
                <>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, maxHeight: 420, overflowY: 'auto' }}>{preview.content}</pre>
                  {preview.truncated && <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>Contenu tronqué — télécharge le fichier pour le voir en entier.</p>}
                </>
              ) : cur.file_type === 'archive' && preview?.type === 'archive' ? (
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  {preview.entries.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', padding: 14 }}>Archive vide.</p>
                  ) : preview.entries.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 12px', borderBottom: i < preview.entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{fmt(entry.size)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--danger)' }}>Impossible de charger l'aperçu.</p>
              )}
              {cur.file_type === 'archive' && (
                <a href={cur.url} download={cur.original_name || undefined} style={{ ...S.btn(), justifyContent: 'center', textDecoration: 'none' }}><IconDownload size={13} /> Télécharger l'archive</a>
              )}
            </div>
          )}
          {cur.file_type === 'image' && !!cur.nsfw && !revealed.has(cur.id) && (
            <div
              onClick={e => { e.stopPropagation(); revealPhoto(cur.id) }}
              style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}
            >
              <IconEyeOff size={34} style={{ color: '#fff' }} />
              <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>Contenu sensible</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>Cliquer pour afficher</span>
            </div>
          )}
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{cur.caption || cur.original_name}</div>
              <div style={{ color: '#666', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                {fmt(cur.size)}
                {cur.uploader_name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    · ajouté par
                    {cur.uploader_avatar
                      ? <img src={cur.uploader_avatar} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                      : null}
                    <span style={{ color: '#999' }}>{cur.uploader_name}</span>
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={cur.url} download={cur.original_name || undefined} onClick={e => e.stopPropagation()} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: '7px 13px', color: '#ccc', fontSize: 12, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><IconDownload size={12} /> Télécharger</a>
              {canSharePhoto(cur) && <button onClick={() => handleToggleNsfw(cur)} style={{ background: cur.nsfw ? 'rgba(91,141,239,0.18)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: '7px 13px', color: cur.nsfw ? 'var(--accent)' : '#ccc', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><IconEyeOff size={12} /> {cur.nsfw ? 'Sensible' : 'Marquer sensible'}</button>}
              {canSharePhoto(cur) && <button onClick={() => openShare('photo', cur.id, cur.original_name || 'photo', cur.filename)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: '7px 13px', color: '#ccc', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><IconLink size={12} /> Partager</button>}
              <button onClick={() => { setDeleteModal({ type: 'photo', id: cur.id, name: cur.original_name || 'cette photo' }); setLightbox(null) }} style={{ background: 'rgba(240,88,107,0.15)', border: '1px solid rgba(240,88,107,0.25)', borderRadius: 6, padding: '7px 13px', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><IconTrash size={12} /> Supprimer</button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => { if (!uploading) { setShowUpload(false); setUploadFiles([]) } }}>
          <motion.div {...cardMotion} style={S.card} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>Ajouter des photos</h2>
              <button onClick={() => { setShowUpload(false); setUploadFiles([]) }} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex' }}><IconClose size={18} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
              {selectedAlbum === null ? 'Les photos seront ajoutées sans album.' : `Les photos seront ajoutées à l'album « ${selectedAlbumObj?.name} ».`}
            </p>
            <div
              onDrop={e => { e.preventDefault(); setDragOver(false); setUploadFiles(prev => [...prev, ...Array.from(e.dataTransfer.files).filter(isAcceptedUploadFile)]) }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{ border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(91,141,239,0.06)' : 'var(--bg)', marginBottom: 14 }}
            >
              <IconUpload size={26} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>{uploadFiles.length > 0 ? `${uploadFiles.length} fichier(s) sélectionné(s)` : 'Glisse tes fichiers ici, clique, ou Ctrl+V pour coller des images'}</p>
              <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 4 }}>Images, vidéos, texte (.txt) et archives (.rar)</p>
              <input ref={fileRef} type="file" accept="image/*,video/*,.mp4,.mov,.webm,.mkv,.avi,.txt,.rar" multiple onChange={e => setUploadFiles(prev => [...prev, ...Array.from(e.target.files || []).filter(isAcceptedUploadFile)])} style={{ display: 'none' }} />
            </div>
            {uploadError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{uploadError}</p>}
            <button onClick={() => handleUpload()} disabled={!uploadFiles.length || uploading} style={{ ...S.btn(!!uploadFiles.length && !uploading), width: '100%', justifyContent: 'center', padding: '11px' }}>{uploading ? 'Envoi…' : 'Envoyer'}</button>
          </motion.div>
        </motion.div>
      )}

      {/* Duplicate photos confirmation modal */}
      {duplicateModal && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => { if (!uploading) setDuplicateModal(null) }}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {duplicateModal.duplicates.length > 1 ? `${duplicateModal.duplicates.length} photos déjà présentes` : 'Photo déjà présente'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
              {duplicateModal.duplicates.length > 1 ? 'Ces fichiers sont identiques à des photos déjà dans ta galerie :' : 'Ce fichier est identique à une photo déjà dans ta galerie :'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
              {duplicateModal.duplicates.map((d, i) => (
                <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>déjà ajoutée le {new Date(d.existingCreatedAt.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              ))}
            </div>
            {uploadError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{uploadError}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {duplicateModal.newCount > 0 && (
                <button onClick={handleSkipDuplicates} disabled={uploading} style={{ ...S.btn(!uploading), width: '100%', justifyContent: 'center' }}>
                  {uploading ? 'Envoi…' : `Ignorer ${duplicateModal.duplicates.length > 1 ? 'les doublons' : 'le doublon'} et envoyer le${duplicateModal.newCount > 1 ? 's' : ''} ${duplicateModal.newCount} autre${duplicateModal.newCount > 1 ? 's' : ''}`}
                </button>
              )}
              <button onClick={handleUploadAnyway} disabled={uploading} style={{ ...S.btnGhost(), width: '100%', justifyContent: 'center' }}>{uploading ? 'Envoi…' : 'Envoyer quand même'}</button>
              <button onClick={() => setDuplicateModal(null)} disabled={uploading} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', padding: '4px' }}>Annuler</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* New album modal */}
      {showNewAlbum && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setShowNewAlbum(false)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Nouvel album</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
              {selectedAlbum === null || newAlbumAtRoot ? 'Sera créé à la racine.' : `Sera créé dans « ${selectedAlbumObj?.name} ».`}
            </p>
            <input value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateAlbum()} placeholder="Nom de l'album" style={{ ...S.input, marginBottom: 14 }} autoFocus />
            {selectedAlbum !== null && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={newAlbumAtRoot} onChange={e => setNewAlbumAtRoot(e.target.checked)} />
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Créer à la racine plutôt que dans le dossier actuel</span>
              </label>
            )}
            <button onClick={handleCreateAlbum} disabled={!newAlbumName.trim()} style={{ ...S.btn(!!newAlbumName.trim()), width: '100%', justifyContent: 'center' }}>Créer</button>
          </motion.div>
        </motion.div>
      )}

      {/* Discover album modal */}
      {showDiscover && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setShowDiscover(false)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>Rechercher un album</h2>
              <button onClick={() => setShowDiscover(false)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex' }}><IconClose size={18} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={discoverQuery} onChange={e => setDiscoverQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleDiscoverSearch()}
                placeholder="Pseudo Discord du propriétaire" style={S.input}
              />
              <button onClick={handleDiscoverSearch} disabled={!discoverQuery.trim() || discoverLoading} style={S.btn(!!discoverQuery.trim() && !discoverLoading)}><IconSearch size={13} /></button>
            </div>
            {discoverError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{discoverError}</p>}
            {discoverUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {discoverUser.discord_avatar
                  ? <img src={discoverUser.discord_avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                  : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)' }} />}
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{discoverUser.discord_name}</span>
              </div>
            )}
            {discoverUser && discoverAlbums.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Aucun album.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {discoverAlbums.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  <IconFolder size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{a.photoCount} photo(s)</div>
                  </div>
                  {a.access === 'owner' || a.access === 'collaborator' ? (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Déjà accès</span>
                  ) : a.access === 'pending' ? (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Demande envoyée</span>
                  ) : (
                    <button onClick={() => handleRequestJoin(a.id)} style={{ flexShrink: 0, background: 'var(--bg-elevated)', border: 'none', borderRadius: 5, padding: '5px 10px', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Demander l'accès</button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Profile modal */}
      {showProfile && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setShowProfile(false)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>Mon profil</h2>
              <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex' }}><IconClose size={18} /></button>
            </div>
            {!profile ? (
              <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Chargement…</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  {profile.discord_avatar
                    ? <img src={profile.discord_avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                    : <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0b', fontSize: 18, fontWeight: 700 }}>{profile.discord_name[0]?.toUpperCase()}</div>}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{profile.discord_name}</div>
                    {profile.discord_username && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>@{profile.discord_username}</div>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{profile.photo_count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>photo{profile.photo_count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmt(profile.total_size)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>stockés</div>
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{profile.album_count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>album{profile.album_count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{profile.collab_album_count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>co-éditeur{profile.collab_album_count !== 1 ? 's' : ''} invité{profile.collab_album_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>
                    <span>Envoyé cette heure</span>
                    <span>{fmt(profile.uploaded_this_hour)} / {fmt(profile.upload_hour_limit)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (profile.uploaded_this_hour / profile.upload_hour_limit) * 100)}%`, background: 'var(--accent)', borderRadius: 3 }} />
                  </div>
                </div>

                {profile.photo_count > 0 && (
                  <a href="/api/private-photos/export" style={{ ...S.btnGhost(), width: '100%', justifyContent: 'center', textDecoration: 'none', marginTop: 16 }}>
                    <IconDownload size={13} /> Télécharger toutes mes photos (.zip)
                  </a>
                )}

                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Sessions actives</span>
                    {sessions && sessions.filter(s => !s.current).length > 0 && (
                      <button onClick={handleLogoutOthers} disabled={sessionsBusy} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', padding: 0 }}>Déconnecter les autres</button>
                    )}
                  </div>
                  {!sessions ? (
                    <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Chargement…</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {sessions.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {describeUA(s.user_agent)}
                              {s.current && <span style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(91,141,239,0.14)', borderRadius: 4, padding: '1px 6px' }}>cet appareil</span>}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>
                              Connecté le {new Date(s.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          {!s.current && (
                            <button onClick={() => handleDeleteSession(s.id)} title="Déconnecter" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 4 }}><IconClose size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 16 }}>
                  Membre depuis le {new Date(profile.member_since.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Rename album modal */}
      {renameAlbum && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setRenameAlbum(null)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Renommer l'album</h2>
            <input value={renameAlbum.name} onChange={e => setRenameAlbum({ ...renameAlbum, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleRenameAlbum()} style={{ ...S.input, marginBottom: 14 }} autoFocus />
            <button onClick={handleRenameAlbum} disabled={!renameAlbum.name.trim()} style={{ ...S.btn(!!renameAlbum.name.trim()), width: '100%', justifyContent: 'center' }}>Enregistrer</button>
          </motion.div>
        </motion.div>
      )}

      {/* Edit caption modal */}
      {editCaption && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setEditCaption(null)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Légende</h2>
            <input value={editCaption.value} onChange={e => setEditCaption({ ...editCaption, value: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleSaveCaption()} placeholder="Légende de la photo" style={{ ...S.input, marginBottom: 14 }} autoFocus />
            <button onClick={handleSaveCaption} style={{ ...S.btn(), width: '100%', justifyContent: 'center' }}>Enregistrer</button>
          </motion.div>
        </motion.div>
      )}

      {/* Move modal */}
      {moveModal && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setMoveModal(null)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Déplacer {moveModal.ids.length > 1 ? `${moveModal.ids.length} photos` : 'vers'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
              <button onClick={() => handleMove(null)} style={{ textAlign: 'left', background: moveModal.albumId === null ? 'rgba(91,141,239,0.12)' : 'transparent', color: moveModal.albumId === null ? 'var(--accent)' : 'var(--text-dim)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>Sans album</button>
              {albums.map(a => (
                <button key={a.id} onClick={() => handleMove(a.id)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, background: moveModal.albumId === a.id ? 'rgba(91,141,239,0.12)' : 'transparent', color: moveModal.albumId === a.id ? 'var(--accent)' : 'var(--text-dim)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}><IconFolder size={13} /> {a.name}</button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Move album modal (déplacer un dossier lui-même, pas son contenu) */}
      {moveAlbumModal && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setMoveAlbumModal(null)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Déplacer l'album</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>« {moveAlbumModal.name} » — choisis son nouveau dossier parent.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
              <button onClick={() => handleMoveAlbum(null)} style={{ textAlign: 'left', background: 'transparent', color: 'var(--text-dim)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Racine</button>
              {flattenOwnedForMove(new Set([moveAlbumModal.id, ...Array.from(getDescendantIds(moveAlbumModal.id))])).map(({ album: a, depth }) => (
                <button
                  key={a.id}
                  onClick={() => handleMoveAlbum(a.id)}
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--text-dim)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 12px', paddingLeft: 12 + depth * 16, fontSize: 13, cursor: 'pointer' }}
                >
                  <IconFolder size={13} /> {a.name}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Share modal */}
      {shareModal && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setShareModal(null)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Partager {shareModal.type === 'album' ? "l'album" : 'la photo'}</h2>
            <p style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 16 }}>{shareModal.name}</p>

            {shareData === null ? (
              <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Chargement…</p>
            ) : (
              <>
                {shareData.shared && shareData.url && (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-hover)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareData.url}</span>
                    <button onClick={copyShareLink} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: 5, padding: '5px 10px', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>Copier</button>
                  </div>
                )}

                {shareData.shared && shareData.token && shareModal.type === 'photo' && shareModal.filename && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>
                      Lien direct (hotlink / intégration){shareData.hasPassword ? ' — incompatible avec le mot de passe' : ''}
                    </p>
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-hover)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {`https://picture.iodev.fr/i/${shareData.token}.${shareModal.filename.split('.').pop()}`}
                      </span>
                      <button onClick={() => copyHotlink(`https://picture.iodev.fr/i/${shareData.token}.${shareModal.filename!.split('.').pop()}`)} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: 5, padding: '5px 10px', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>Copier</button>
                    </div>
                  </div>
                )}

                <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>Expiration du lien</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {EXPIRY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setShareExpiry(opt.value)}
                      style={{
                        flex: '1 1 auto', minWidth: 62, background: shareExpiry === opt.value ? 'rgba(91,141,239,0.14)' : 'var(--bg)',
                        border: `1px solid ${shareExpiry === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                        color: shareExpiry === opt.value ? 'var(--accent)' : 'var(--text-dim)',
                        borderRadius: 'var(--radius-sm)', padding: '7px 8px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {shareData.shared && (
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconClock size={11} /> Actuellement : {fmtExpiry(shareData.expiresAt ?? null)}
                  </p>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={shareUsePwd} onChange={e => setShareUsePwd(e.target.checked)} />
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Protéger par mot de passe</span>
                </label>
                {shareUsePwd && (
                  <input type="text" value={sharePwd} onChange={e => setSharePwd(e.target.value)} placeholder={shareData.hasPassword ? '••••••• (laisser vide pour garder)' : 'Mot de passe'} style={{ ...S.input, marginBottom: 14 }} />
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={handleCreateShare} disabled={shareLoading} style={{ ...S.btn(!shareLoading), flex: 1, justifyContent: 'center' }}>{shareData.shared ? 'Mettre à jour' : 'Créer le lien'}</button>
                  {shareData.shared && (
                    <button onClick={handleRevokeShare} disabled={shareLoading} style={{ flex: 1, justifyContent: 'center', ...S.btnGhost(true) }}>Révoquer</button>
                  )}
                </div>
                {typeof shareData.viewCount === 'number' && (
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 12 }}>{shareData.viewCount} vue(s)</p>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Collaborators modal */}
      {collabModal && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => setCollabModal(null)}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>Co-éditeurs</h2>
              <button onClick={() => setCollabModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex' }}><IconClose size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 16 }}>{collabModal.name}</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={collabInput} onChange={e => setCollabInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInviteCollab()}
                placeholder="Pseudo Discord (ex: jean.dupont)" style={S.input}
              />
              <button onClick={handleInviteCollab} disabled={!collabInput.trim() || collabLoading} style={S.btn(!!collabInput.trim() && !collabLoading)}>Inviter</button>
            </div>
            {collabError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{collabError}</p>}
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}>Un co-éditeur peut ajouter, légender, déplacer et supprimer des photos dans cet album. Il ne peut pas le renommer, le supprimer ni le partager publiquement.</p>

            {collabJoinRequests.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Demandes d'accès</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {collabJoinRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                      {req.discord_avatar
                        ? <img src={req.discord_avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                        : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)' }} />}
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.discord_name}</span>
                      <button onClick={() => handleJoinRequest(req.id, 'accept')} title="Accepter" style={{ background: 'rgba(91,141,239,0.14)', border: 'none', borderRadius: 5, padding: 5, color: 'var(--accent)', cursor: 'pointer', display: 'flex' }}><IconCheck size={13} /></button>
                      <button onClick={() => handleJoinRequest(req.id, 'refuse')} title="Refuser" style={{ background: 'rgba(240,88,107,0.12)', border: 'none', borderRadius: 5, padding: 5, color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}><IconClose size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {collaborators.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Aucun co-éditeur pour le moment.</p>}
              {collaborators.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  {c.discord_avatar
                    ? <img src={c.discord_avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 10 }}><IconUsers size={12} /></div>}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.discord_name || c.invited_name}</div>
                    {!c.user_id && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>En attente de connexion</div>}
                  </div>
                  <button onClick={() => handleRemoveCollab(c.id)} title="Retirer" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 4 }}><IconClose size={14} /></button>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <motion.div {...overlayMotion} style={S.modal} onClick={() => { if (!deleting) setDeleteModal(null) }}>
          <motion.div {...cardMotion} style={{ ...S.card, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(240,88,107,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--danger)' }}>
                {deleteModal.type === 'leave-album' ? <IconLogout size={20} /> : <IconTrash size={20} />}
              </div>
              <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                {deleteModal.type === 'leave-album' ? "Quitter l'album" : `Supprimer ${deleteModal.type === 'album' ? "l'album" : deleteModal.type === 'photos' ? `${deleteModal.ids?.length} photos` : 'cette photo'}`} ?
              </h3>
              <p style={{ color: 'var(--text-faint)', fontSize: 11, wordBreak: 'break-all' }}>{deleteModal.name}</p>
              {deleteModal.type === 'album' && <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>Les photos qu'il contient seront conservées sans album.</p>}
              {deleteModal.type === 'leave-album' && <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>Tu perdras l'accès à cet album. Le propriétaire pourra te réinviter plus tard.</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteModal(null)} style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, background: 'var(--danger)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{deleting ? '…' : deleteModal.type === 'leave-album' ? 'Quitter' : 'Supprimer'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}
