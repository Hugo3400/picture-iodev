export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin } from '@/lib/admin'
import PrivateGallery from '@/components/PrivateGallery'
import { Logo, IconLock, IconDiscord } from '@/components/icons'

export default async function PrivePage() {
  const user = await getSession()

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 380, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px 32px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Logo size={30} />
          </div>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(91,141,239,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}><IconLock size={20} /></div>
          <h1 style={{ color: 'var(--text)', fontSize: 19, fontWeight: 600, marginBottom: 8 }}>Espace privé</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 26, lineHeight: 1.6 }}>Connecte-toi avec Discord pour accéder à tes albums privés et partager tes photos.</p>
          <a href="/api/auth/discord" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#5865F2', color: '#fff', textDecoration: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 22px', fontSize: 14, fontWeight: 600 }}>
            <IconDiscord size={17} /> Se connecter avec Discord
          </a>
          <div style={{ marginTop: 22 }}>
            <a href="/" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>← Retour à la galerie publique</a>
          </div>
        </div>
      </div>
    )
  }

  const db = getDb()
  const ownedAlbums = db.prepare(
    `SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count, 'owner' AS role
     FROM albums a WHERE a.user_id = ? ORDER BY a.created_at DESC`
  ).all(user.id)
  const sharedAlbums = db.prepare(
    `SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count, 'collaborator' AS role,
            u.discord_name AS owner_name
     FROM albums a
     JOIN album_collaborators c ON c.album_id = a.id
     JOIN users u ON u.id = a.user_id
     WHERE c.user_id = ? ORDER BY a.created_at DESC`
  ).all(user.id)
  const photos = (db.prepare(
    `SELECT p.*, u.discord_name AS uploader_name, u.discord_avatar AS uploader_avatar
     FROM photos p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? ORDER BY p.created_at DESC`
  ).all(user.id) as any[]).map(p => ({
    ...p,
    url: `/api/file/${p.id}`,
    thumbUrl: p.thumb_filename ? `/api/file/${p.id}?thumb=1` : `/api/file/${p.id}`,
  }))

  return <PrivateGallery user={user} isAdmin={isAdmin(user)} initialAlbums={[...ownedAlbums, ...sharedAlbums] as any} initialPhotos={photos} />
}
