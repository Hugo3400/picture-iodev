import type { Metadata } from 'next'
import LegalLayout, { legalStyles } from '@/components/LegalLayout'

export const metadata: Metadata = { title: 'Politique de confidentialité — Picture' }

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="12 août 2026">
      <p>
        Cette page explique quelles données Picture collecte, pourquoi, et quels sont tes droits. Picture est un projet
        personnel, pas une entreprise : les données ne sont ni vendues ni partagées à des fins commerciales ou
        publicitaires.
      </p>

      <h2 style={legalStyles.h2}>Données collectées</h2>
      <ul style={legalStyles.ul}>
        <li>
          <strong>Identifiants de connexion</strong> — si tu te connectes via Discord : ton identifiant Discord, ton pseudo
          et ton avatar. Si tu crées un compte par email : ton adresse email et un hash de ton mot de passe (le mot de
          passe en clair n'est jamais stocké, ni consultable par l'éditeur du site).
        </li>
        <li>
          <strong>Les fichiers que tu uploades</strong> — les photos elles-mêmes, ainsi que leurs métadonnées (nom
          d'origine, taille, légende éventuelle, date d'ajout).
        </li>
        <li>
          <strong>Adresses IP</strong> — enregistrées à chaque connexion à ton compte (quelle que soit la méthode) et à
          chaque envoi de fichier, que ce soit sur l'hébergeur d'images public (sans compte) ou dans ton espace privé,
          ainsi que lors de tentatives de connexion, de création de compte, ou de déverrouillage d'un lien protégé par mot
          de passe. Les adresses IP liées à ton activité normale (connexions, uploads) permettent notamment de répondre à
          une éventuelle réquisition légale visant un compte ou un contenu précis — voir « Communication aux autorités »
          ci-dessous.
        </li>
        <li>
          <strong>Cookie de session</strong> — un unique cookie (<code>pic_session</code>), technique et strictement
          nécessaire pour rester connecté à ton compte. Il n'y a pas de cookie publicitaire ni de traceur tiers sur ce
          site.
        </li>
      </ul>

      <h2 style={legalStyles.h2}>Pourquoi ces données</h2>
      <ul style={legalStyles.ul}>
        <li>faire fonctionner le service (connexion, affichage de tes photos et albums, partage) ;</li>
        <li>
          sécurité et lutte contre les abus (limiter les tentatives de connexion ou d'inscription en rafale, limiter le
          spam sur l'hébergeur public d'images, détecter des tentatives de forcer un lien protégé par mot de passe) ;
        </li>
        <li>
          modération (permettre à l'administrateur du site de retirer un contenu illégal ou de suspendre un compte
          abusif) ;
        </li>
        <li>répondre à une obligation légale, si une autorité compétente en fait la demande.</li>
      </ul>

      <h2 style={legalStyles.h2}>Durée de conservation</h2>
      <p>
        Les données de compte et les fichiers sont conservés tant que le compte existe. Les images de l'hébergeur public
        (sans compte) sont supprimées automatiquement à la date d'expiration choisie au moment de l'envoi. Les adresses IP
        liées à la sécurité (tentatives de connexion, d'inscription, de déverrouillage de lien) sont conservées pour une
        durée limitée, le temps nécessaire à la détection d'abus. Les adresses IP liées aux connexions et aux envois de
        fichiers d'un compte sont conservées tant que le compte existe, pour les mêmes finalités de sécurité et de réponse
        à une éventuelle obligation légale.
      </p>

      <h2 style={legalStyles.h2}>Communication aux autorités</h2>
      <p>
        Les adresses IP et autres métadonnées techniques peuvent être communiquées aux autorités compétentes si la loi
        l'exige, notamment dans le cadre d'une réquisition judiciaire.
      </p>

      <h2 style={legalStyles.h2}>Scan antivirus</h2>
      <p>
        Chaque fichier envoyé (public ou privé) est automatiquement analysé par un antivirus avant d'être stocké, afin de
        détecter des fichiers malveillants.
      </p>

      <h2 style={legalStyles.h2}>Tes droits</h2>
      <p>
        Conformément au RGPD, tu disposes d'un droit d'accès, de rectification, de suppression et de portabilité de tes
        données. Tu peux exercer la plupart de ces droits directement depuis ton espace privé (suppression de photos,
        d'albums ou du compte entier). Pour toute autre demande, tu peux contacter{' '}
        <span style={legalStyles.placeholder}>[À COMPLÉTER — email de contact]</span>.
      </p>

      <h2 style={legalStyles.h2}>Hébergement des données</h2>
      <p>
        Les données sont hébergées chez <span style={legalStyles.placeholder}>[À COMPLÉTER — hébergeur]</span>. Voir aussi
        les <a href="/mentions-legales" style={{ color: 'var(--accent)' }}>mentions légales</a>.
      </p>
    </LegalLayout>
  )
}
