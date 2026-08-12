import Link from 'next/link'

const links = [
  { href: '/a-propos', label: 'À propos' },
  { href: '/conditions-utilisation', label: "Conditions d'utilisation" },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/mentions-legales', label: 'Mentions légales' },
]

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        padding: '20px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px 20px',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: 'var(--text-faint)',
      }}
    >
      {links.map(l => (
        <Link key={l.href} href={l.href} style={{ color: 'var(--text-faint)', textDecoration: 'none' }}>
          {l.label}
        </Link>
      ))}
    </footer>
  )
}
