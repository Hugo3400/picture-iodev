export const dynamic = 'force-dynamic'

import path from 'path'
import { getSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { isAdmin, getDirSize } from '@/lib/admin'
import { UPLOADS_DIR } from '@/lib/publicUploads'
import AdminPanel from '@/components/AdminPanel'
import LoginForm from '@/components/LoginForm'
import { Logo, IconLock, IconDiscord, IconShield } from '@/components/icons'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'private')

export default async function AdminPage() {
  const user = await getSession()
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 380, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px 32px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Logo size={30} />
          </div>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(91,141,239,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}><IconLock size={20} /></div>
          <h1 style={{ color: 'var(--text)', fontSize: 19, fontWeight: 600, marginBottom: 8 }}>Panel admin</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 26, lineHeight: 1.6 }}>Connecte-toi avec Discord pour accéder à cette page.</p>
          <a href="/api/auth/discord?redirect=/admin" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box', gap: 9, background: '#5865F2', color: '#fff', textDecoration: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 22px', fontSize: 14, fontWeight: 600 }}>
            <IconDiscord size={17} /> Se connecter avec Discord
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <LoginForm />

          {telegramBotUsername && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>ou</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <script
                  async
                  src="https://telegram.org/js/telegram-widget.js?22"
                  data-telegram-login={telegramBotUsername}
                  data-size="large"
                  data-auth-url="https://picture.iodev.fr/api/auth/telegram/callback?redirect=/admin"
                  data-request-access="write"
                />
              </div>
            </>
          )}

          <div style={{ marginTop: 22 }}>
            <a href="/" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>← Retour à la galerie publique</a>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin(user)) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 380, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px 32px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(240,88,107,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--danger)' }}><IconShield size={20} /></div>
          <h1 style={{ color: 'var(--text)', fontSize: 19, fontWeight: 600, marginBottom: 8 }}>Accès refusé</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 26, lineHeight: 1.6 }}>
            Ce compte ({user.discord_name}) n'est pas autorisé à accéder au panel d'administration. Cette page est réservée au propriétaire du site.
          </p>
          <a href="/prive" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>← Retour à l'espace privé</a>
        </div>
      </div>
    )
  }

  const db = getDb()
  const nowIso = new Date().toISOString()

  const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  const photoCount = (db.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number }).n
  const albumCount = (db.prepare('SELECT COUNT(*) AS n FROM albums').get() as { n: number }).n
  const shareLinkCount = (db.prepare('SELECT COUNT(*) AS n FROM share_links').get() as { n: number }).n
  // expires_at des public_uploads est un ISOString JS (voir lib/publicUploads.ts), pas un
  // format SQLite "datetime('now')" : on compare donc avec un ISOString calculé côté JS,
  // exactement comme cleanupExpiredPublicUploads le fait déjà.
  const activeUploadCount = (db.prepare(
    'SELECT COUNT(*) AS n FROM public_uploads WHERE expires_at IS NULL OR expires_at > ?'
  ).get(nowIso) as { n: number }).n

  const [privateSize, publicSize] = await Promise.all([
    getDirSize(STORAGE_DIR),
    getDirSize(UPLOADS_DIR),
  ])

  const users = db.prepare(`
    SELECT u.id, u.discord_name, u.discord_username, u.discord_avatar, u.created_at,
      (SELECT COUNT(*) FROM photos p WHERE p.user_id = u.id) AS photo_count,
      (SELECT COUNT(*) FROM albums a WHERE a.user_id = u.id) AS album_count,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND datetime(s.expires_at) > datetime('now')) AS active_sessions
    FROM users u ORDER BY u.created_at DESC
  `).all()

  const publicUploads = db.prepare(
    'SELECT id, filename, original_name, size, expires_at, ip, created_at FROM public_uploads ORDER BY created_at DESC LIMIT 200'
  ).all()

  const abuseAttempts = db.prepare(`
    SELECT ip, token, COUNT(*) AS attempts, MAX(created_at) AS last_attempt
    FROM share_unlock_attempts
    WHERE created_at >= datetime('now', '-24 hours')
    GROUP BY ip, token
    ORDER BY attempts DESC
    LIMIT 50
  `).all()

  const shareLinks = db.prepare(`
    SELECT sl.id, sl.token, sl.type, sl.target_id, sl.view_count, sl.created_at,
      CASE WHEN sl.password_hash IS NULL THEN 0 ELSE 1 END AS has_password,
      CASE WHEN sl.type = 'photo' THEN (SELECT original_name FROM photos WHERE id = sl.target_id)
           ELSE (SELECT name FROM albums WHERE id = sl.target_id) END AS target_name,
      CASE WHEN sl.type = 'photo' THEN (SELECT u.discord_name FROM photos p JOIN users u ON u.id = p.user_id WHERE p.id = sl.target_id)
           ELSE (SELECT u.discord_name FROM albums a JOIN users u ON u.id = a.user_id WHERE a.id = sl.target_id) END AS owner_name
    FROM share_links sl ORDER BY sl.created_at DESC
  `).all()

  const stats = {
    userCount, photoCount, albumCount, shareLinkCount, activeUploadCount,
    privateSize, publicSize,
  }

  return (
    <AdminPanel
      user={user}
      stats={stats}
      initialUsers={users as any}
      initialPublicUploads={publicUploads as any}
      initialAbuseAttempts={abuseAttempts as any}
      initialShareLinks={shareLinks as any}
    />
  )
}
