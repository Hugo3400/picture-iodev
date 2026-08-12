import type { Metadata } from 'next'
import LegalLayout, { legalStyles } from '@/components/LegalLayout'

export const metadata: Metadata = { title: 'Mentions légales — Picture' }

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales">
      <p style={{ fontSize: 12.5, color: 'var(--danger)', background: 'rgba(240,88,107,0.08)', border: '1px solid rgba(240,88,107,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
        Cette page contient des champs à compléter par le propriétaire du site (marqués{' '}
        <span style={legalStyles.placeholder}>[À COMPLÉTER]</span>). Tant qu'ils ne sont pas remplis, cette page ne
        constitue pas des mentions légales juridiquement valables.
      </p>

      <h2 style={legalStyles.h2}>Éditeur du site</h2>
      <p>
        Le site Picture est édité par : <span style={legalStyles.placeholder}>[À COMPLÉTER PAR LE PROPRIÉTAIRE — nom complet]</span>.
      </p>
      <p>
        Adresse : <span style={legalStyles.placeholder}>[À COMPLÉTER — adresse]</span>
      </p>
      <p>
        Contact : <span style={legalStyles.placeholder}>[À COMPLÉTER — email de contact]</span>
      </p>
      <p>
        Statut : particulier / projet personnel, non exploité à titre commercial.
      </p>

      <h2 style={legalStyles.h2}>Hébergement</h2>
      <p>
        Le site et ses données sont hébergés par : <span style={legalStyles.placeholder}>[À COMPLÉTER — hébergeur]</span>.
      </p>
      <p>
        Adresse de l'hébergeur : <span style={legalStyles.placeholder}>[À COMPLÉTER — adresse de l'hébergeur]</span>
      </p>

      <h2 style={legalStyles.h2}>Propriété intellectuelle</h2>
      <p>
        La structure et le code du site sont la propriété de l'éditeur mentionné ci-dessus. Les photos et fichiers
        hébergés restent la propriété de leurs auteurs respectifs (les utilisateurs qui les uploadent) ; l'éditeur du
        site n'en revendique aucun droit, hormis ce qui est nécessaire au fonctionnement technique du service
        (stockage, affichage, partage tel que configuré par l'utilisateur).
      </p>

      <h2 style={legalStyles.h2}>Contact</h2>
      <p>
        Pour toute question relative au site, aux présentes mentions légales, ou pour signaler un contenu, tu peux
        écrire à : <span style={legalStyles.placeholder}>[À COMPLÉTER — email de contact]</span>.
      </p>
    </LegalLayout>
  )
}
