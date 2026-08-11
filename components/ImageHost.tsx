'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Logo, IconLock, IconImage, IconClose, IconUpload, IconClock, IconLink, IconTrash } from './icons'

type ExpiryChoice = '1h' | '24h' | '7d' | '30d' | 'never'

interface UploadedFile {
  filename: string
  url: string
  thumbUrl?: string
  expiresAt: string | null
}

const HISTORY_KEY = 'picture-host-history'

function loadHistory(): UploadedFile[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const items: UploadedFile[] = JSON.parse(raw)
    const now = Date.now()
    return items.filter(i => !i.expiresAt || new Date(i.expiresAt).getTime() > now)
  } catch {
    return []
  }
}

function saveHistory(items: UploadedFile[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)))
  } catch {}
}

const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: '1h', label: '1 heure' },
  { value: '24h', label: '24 heures' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'never', label: 'Jamais' },
]

const fmt = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

const fmtExpiry = (iso: string | null) => {
  if (!iso) return "N'expire jamais"
  return `Expire le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function ImageHost() {
  const [files, setFiles] = useState<File[]>([])
  const [expiry, setExpiry] = useState<ExpiryChoice>('24h')
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setResults(loadHistory())
    const saved = localStorage.getItem('picture-host-expiry')
    if (saved && EXPIRY_OPTIONS.some(o => o.value === saved)) setExpiry(saved as ExpiryChoice)
  }, [])

  const changeExpiry = (v: ExpiryChoice) => {
    setExpiry(v)
    localStorage.setItem('picture-host-expiry', v)
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.items || [])
        .filter(i => i.type.startsWith('image/'))
        .map(i => i.getAsFile())
        .filter((f): f is File => !!f)
      if (images.length) setFiles(prev => [...prev, ...images])
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const clearHistory = () => {
    setResults([])
    saveHistory([])
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))])
  }, [])

  const handleUpload = async () => {
    if (!files.length || uploading) return
    setUploading(true)
    const fd = new FormData()
    fd.append('expires_in', expiry)
    files.forEach(f => fd.append('files', f))
    const r = await fetch('/api/upload', { method: 'POST', body: fd })
    setUploading(false)
    const d = await r.json().catch(() => null)
    if (!r.ok || !d) { toast.error(d?.error || 'Erreur serveur, réessaie plus tard'); return }
    setResults(prev => {
      const next = [...d.uploaded, ...prev]
      saveHistory(next)
      return next
    })
    setFiles([])
    toast.success(d.uploaded.length > 1 ? `${d.uploaded.length} images hébergées` : 'Image hébergée')
  }

  const copyLink = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => toast.success('Lien copié'))
    }
  }

  const S = {
    btn: (active = true): React.CSSProperties => ({
      background: active ? 'var(--accent)' : 'var(--bg-elevated)',
      color: active ? '#0a0a0b' : 'var(--text-faint)',
      border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 18px',
      fontSize: 13, fontWeight: 600,
      cursor: active ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
    }),
    input: { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  }

  return (
    <>
      {/* ── Header ── */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,11,0.75)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={22} />
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.3px' }}>Picture</span>
        </div>
        <a
          href="/prive"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', transition: 'border-color 0.15s' }}
        >
          <IconLock size={13} /> Espace privé
        </a>
      </header>

      {/* ── Main ── */}
      <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 20px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28, maxWidth: 480 }}>
          <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Héberger une image</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.6 }}>Dépose une image, choisis sa durée de vie, récupère un lien direct à partager.</p>
        </div>

        <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            style={{ border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', padding: '30px 16px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(91,141,239,0.06)' : 'var(--bg)', transition: 'all 0.15s', marginBottom: 16 }}
          >
            <IconImage size={26} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 3px' }}>
              {files.length > 0 ? `${files.length} fichier(s) sélectionné(s)` : 'Glisse ton image ici'}
            </p>
            <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>ou clique pour sélectionner · ou Ctrl+V pour coller · JPG, PNG, GIF, WEBP</p>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} style={{ display: 'none' }} />
          </div>

          {files.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
              {files.map((f, i) => (
                <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px 3px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 0, display: 'flex' }}><IconClose size={11} /></button>
                </div>
              ))}
            </div>
          )}

          <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>Suppression automatique après</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {EXPIRY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => changeExpiry(opt.value)}
                style={{
                  flex: '1 1 auto', minWidth: 70, background: expiry === opt.value ? 'rgba(91,141,239,0.14)' : 'var(--bg)',
                  border: `1px solid ${expiry === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  color: expiry === opt.value ? 'var(--accent)' : 'var(--text-dim)',
                  borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button onClick={handleUpload} disabled={!files.length || uploading} style={{ ...S.btn(!!files.length && !uploading), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <IconUpload size={14} /> {uploading ? 'Envoi en cours…' : 'Héberger'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 12 }}>Max 15 Mo par image · 10 images par envoi · 20 images / heure</p>
        </div>

        {results.length > 0 && (
          <div style={{ width: '100%', maxWidth: 480, marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Historique ({results.length})</h2>
              <button onClick={clearHistory} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                <IconTrash size={12} /> Vider
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14, marginTop: -6 }}>Visible uniquement sur ce navigateur.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map(r => (
              <div key={r.filename} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                <img src={r.thumbUrl || r.url} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-hover)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{`${typeof window !== 'undefined' ? window.location.origin : ''}${r.url}`}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-faint)', fontSize: 11, marginTop: 3 }}>
                    <IconClock size={11} /> {fmtExpiry(r.expiresAt)}
                  </div>
                </div>
                <button onClick={() => copyLink(r.url)} style={{ flexShrink: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 12px', color: 'var(--text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IconLink size={12} /> Copier
                </button>
                <button
                  onClick={() => setResults(prev => { const next = prev.filter(x => x.filename !== r.filename); saveHistory(next); return next })}
                  style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <IconClose size={12} />
                </button>
              </div>
            ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
