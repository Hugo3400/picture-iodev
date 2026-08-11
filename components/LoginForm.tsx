'use client'

import { useState } from 'react'

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--text)', marginBottom: 10,
}

export default function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue')
        setLoading(false)
        return
      }
      window.location.href = '/prive'
    } catch {
      setError('Une erreur est survenue, réessaie')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ textAlign: 'left', marginTop: 6 }}>
      {mode === 'register' && (
        <input style={inputStyle} type="text" placeholder="Nom" value={name} onChange={e => setName(e.target.value)} required />
      )}
      <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input style={inputStyle} type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />

      {error && <p style={{ color: '#e5484d', fontSize: 12, marginBottom: 10 }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%', background: 'var(--accent)', color: '#0a0a0b', border: 'none', textDecoration: 'none',
          borderRadius: 'var(--radius-sm)', padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Patiente…' : mode === 'login' ? 'Se connecter' : "Créer mon compte"}
      </button>

      <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', marginTop: 14 }}>
        {mode === 'login' ? "Pas encore de compte ? " : 'Déjà un compte ? '}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}
        >
          {mode === 'login' ? "S'inscrire" : 'Se connecter'}
        </button>
      </p>
    </form>
  )
}
