import Link from 'next/link'
import Footer from './Footer'
import { IconChevronLeft } from './icons'

export const legalStyles: Record<string, React.CSSProperties> = {
  h2: { fontSize: 17, fontWeight: 600, color: 'var(--text)', marginTop: 10 },
  h3: { fontSize: 14.5, fontWeight: 600, color: 'var(--text)' },
  ul: { paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  placeholder: { color: 'var(--accent)', background: 'rgba(91,141,239,0.12)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 },
}

export default function LegalLayout({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, maxWidth: 760, margin: '0 auto', padding: '48px 20px', width: '100%' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-faint)', textDecoration: 'none', fontSize: 13, marginBottom: 28 }}
        >
          <IconChevronLeft size={16} />
          Retour à l'accueil
        </Link>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{title}</h1>
        {updated && <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 32 }}>Dernière mise à jour : {updated}</p>}
        {!updated && <div style={{ marginBottom: 32 }} />}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: 'var(--text-dim)',
          }}
        >
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}
