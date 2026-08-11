'use client'

import { useState, useEffect } from 'react'
import { Logo, IconLock, IconChevronLeft, IconChevronRight, IconClose, IconEyeOff } from './icons'

interface SharedPhoto { id: number; caption: string | null; url: string; nsfw: boolean }

export default function ShareView({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [error, setError] = useState('')
  const [type, setType] = useState<'photo' | 'album' | null>(null)
  const [albumInfo, setAlbumInfo] = useState<{ name: string; description: string | null } | null>(null)
  const [photos, setPhotos] = useState<SharedPhoto[]>([])
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [viewerAccess, setViewerAccess] = useState<'owner' | 'collaborator' | 'pending' | null | 'anonymous'>('anonymous')
  const [requestState, setRequestState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [requestError, setRequestError] = useState('')

  // Comme dans la galerie privée : la révélation d'une photo sensible n'est qu'un état
  // d'affichage local, elle ne persiste pas entre les rechargements.
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const revealPhoto = (id: number) => setRevealed(prev => new Set(prev).add(id))

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/share/${token}`)
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error || 'Erreur'); return }
    if (d.requiresPassword) { setNeedsPassword(true); return }
    setNeedsPassword(false)
    setType(d.type)
    if (d.type === 'album') { setAlbumInfo(d.album); setViewerAccess(d.viewerAccess ?? 'anonymous') }
    setPhotos(d.photos)
  }

  const requestJoin = async () => {
    setRequestState('sending')
    setRequestError('')
    const r = await fetch(`/api/share/${token}/join-request`, { method: 'POST' })
    const d = await r.json().catch(() => null)
    if (!r.ok) { setRequestState('error'); setRequestError(d?.error || 'Erreur'); return }
    setRequestState('idle')
    setViewerAccess('pending')
  }

  useEffect(() => { load() }, [token])

  const submitPassword = async () => {
    setPwdError('')
    const r = await fetch(`/api/share/${token}/unlock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }),
    })
    const d = await r.json()
    if (!r.ok) { setPwdError(d.error || 'Erreur'); return }
    await load()
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>Chargement…</span>
    </div>
  }

  if (error) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <IconLock size={34} style={{ color: 'var(--text-faint)' }} />
      <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>{error}</p>
    </div>
  }

  if (needsPassword) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 30, width: '100%', maxWidth: 360, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(91,141,239,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}><IconLock size={20} /></div>
          <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Ce contenu est protégé</h2>
          <input
            type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Mot de passe"
            onKeyDown={e => e.key === 'Enter' && submitPassword()}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
          />
          {pwdError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{pwdError}</p>}
          <button onClick={submitPassword} style={{ width: '100%', background: 'var(--accent)', color: '#0a0a0b', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Déverrouiller</button>
        </div>
      </div>
    )
  }

  const cur = lightbox !== null ? photos[lightbox] : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ padding: '22px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: type === 'album' ? 6 : 18 }}>
          <Logo size={19} />
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Picture</span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· partage</span>
        </div>
        {albumInfo && (
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ color: 'var(--text)', fontSize: 19, fontWeight: 600 }}>{albumInfo.name}</h1>
            {albumInfo.description && <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>{albumInfo.description}</p>}
            <div style={{ marginTop: 10 }}>
              {viewerAccess === 'anonymous' && (
                <a href={`/api/auth/discord?redirect=${encodeURIComponent(`/partage/${token}`)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', textDecoration: 'none', background: 'rgba(91,141,239,0.12)', borderRadius: 'var(--radius-sm)', padding: '7px 12px' }}>
                  Se connecter avec Discord pour demander à co-éditer
                </a>
              )}
              {viewerAccess === null && (
                <button onClick={requestJoin} disabled={requestState === 'sending'} style={{ fontSize: 12, color: '#0a0a0b', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '7px 12px', cursor: 'pointer', fontWeight: 600 }}>
                  {requestState === 'sending' ? 'Envoi…' : "Demander l'accès en co-édition"}
                </button>
              )}
              {viewerAccess === 'pending' && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Demande envoyée, en attente de réponse</span>
              )}
              {(viewerAccess === 'owner' || viewerAccess === 'collaborator') && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Tu as déjà accès à cet album · <a href="/prive" style={{ color: 'var(--accent)' }}>l'ouvrir</a></span>
              )}
              {requestError && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>{requestError}</p>}
            </div>
          </div>
        )}
      </header>

      {photos.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Aucune photo</p>
        </div>
      ) : (
        <div className="masonry">
          {photos.map((p, idx) => (
            <div key={p.id} className="masonry-item" onClick={() => setLightbox(idx)}>
              <img
                src={p.url} alt={p.caption || ''} loading="lazy"
                style={p.nsfw && !revealed.has(p.id) ? { filter: 'blur(24px)', transition: 'filter 0.2s' } : undefined}
              />
              {p.nsfw && !revealed.has(p.id) && (
                <div
                  onClick={e => { e.stopPropagation(); revealPhoto(p.id) }}
                  style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(0,0,0,0.4)', cursor: 'pointer', textAlign: 'center', padding: 10 }}
                >
                  <IconEyeOff size={22} style={{ color: '#fff' }} />
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Contenu sensible</span>
                  <span style={{ fontSize: 10, color: '#ddd' }}>Cliquer pour afficher</span>
                </div>
              )}
              {p.caption && (
                <div className="masonry-overlay">
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{p.caption}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cur && lightbox !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClose size={16} /></button>
          {lightbox > 0 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1) }} style={{ position: 'absolute', left: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconChevronLeft size={22} /></button>}
          {lightbox < photos.length - 1 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1) }} style={{ position: 'absolute', right: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconChevronRight size={22} /></button>}
          <img
            src={cur.url} alt={cur.caption || ''} onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 'calc(100vw - 110px)', maxHeight: 'calc(100vh - 110px)', objectFit: 'contain', borderRadius: 4,
              ...(cur.nsfw && !revealed.has(cur.id) ? { filter: 'blur(40px)', transition: 'filter 0.2s' } : {}),
            }}
          />
          {cur.nsfw && !revealed.has(cur.id) && (
            <div
              onClick={e => { e.stopPropagation(); revealPhoto(cur.id) }}
              style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}
            >
              <IconEyeOff size={34} style={{ color: '#fff' }} />
              <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>Contenu sensible</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>Cliquer pour afficher</span>
            </div>
          )}
          {cur.caption && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
              <div style={{ color: '#fff', fontSize: 13 }}>{cur.caption}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
