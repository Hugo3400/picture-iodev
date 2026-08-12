import type { Metadata } from 'next'
import LegalLayout, { legalStyles } from '@/components/LegalLayout'

export const metadata: Metadata = { title: 'À propos — Picture' }

export default function AProposPage() {
  return (
    <LegalLayout title="À propos">
      <p>
        Picture est un petit site personnel pour héberger et partager des photos, sans chichis.
        Il n'y a pas d'entreprise ni d'équipe derrière : c'est un projet géré par un particulier, sur son temps libre.
      </p>

      <h2 style={legalStyles.h2}>Deux façons de l'utiliser</h2>

      <h3 style={legalStyles.h3}>Héberger une image rapidement</h3>
      <p>
        Sur la page d'accueil, tu peux déposer une image sans créer de compte. Elle est scannée, hébergée, et tu récupères un
        lien à partager. Tu choisis toi-même combien de temps l'image reste en ligne (de 1 heure à jamais), après quoi elle
        est supprimée automatiquement.
      </p>

      <h3 style={legalStyles.h3}>Avoir un espace privé</h3>
      <p>
        En créant un compte (via Discord ou par email et mot de passe), tu obtiens un espace privé pour organiser tes photos
        en albums. Tu peux partager un album ou une photo via un lien, éventuellement protégé par un mot de passe et/ou
        limité dans le temps. Tu peux aussi inviter d'autres personnes à co-éditer un album.
      </p>

      <h2 style={legalStyles.h2}>Sécurité</h2>
      <p>
        Chaque fichier envoyé, public ou privé, est scanné par un antivirus avant d'être stocké. Le contenu marqué comme
        sensible par son propriétaire est flouté par défaut à l'affichage.
      </p>

      <h2 style={legalStyles.h2}>Le reste</h2>
      <p>
        Pour les questions plus formelles (données personnelles, règles d'usage, identité de l'éditeur), consulte les pages
        liées en bas de ce site.
      </p>
    </LegalLayout>
  )
}
