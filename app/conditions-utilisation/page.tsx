import type { Metadata } from 'next'
import LegalLayout, { legalStyles } from '@/components/LegalLayout'

export const metadata: Metadata = { title: "Conditions d'utilisation — Picture" }

export default function ConditionsUtilisationPage() {
  return (
    <LegalLayout title="Conditions d'utilisation" updated="12 août 2026">
      <p>
        En utilisant Picture (hébergement d'images public ou espace privé par compte), tu acceptes les règles ci-dessous.
        Elles sont volontairement écrites simplement : c'est un projet personnel, pas un service d'entreprise.
      </p>

      <h2 style={legalStyles.h2}>Âge minimum</h2>
      <p>
        Le service est destiné à des personnes d'au moins 15 ans. Si tu es mineur, assure-toi d'avoir l'accord d'un parent
        ou tuteur avant de créer un compte.
      </p>

      <h2 style={legalStyles.h2}>Contenu interdit</h2>
      <p>Il est strictement interdit d'héberger, stocker ou partager via Picture :</p>
      <ul style={legalStyles.ul}>
        <li>tout contenu pédopornographique ou représentant l'exploitation sexuelle de mineurs ;</li>
        <li>tout contenu dont tu n'as pas les droits (violation de droit d'auteur ou de propriété intellectuelle) ;</li>
        <li>des logiciels malveillants, virus ou fichiers destinés à nuire à des tiers ;</li>
        <li>du contenu illégal au regard de la loi française : incitation à la haine, contenu terroriste, etc. ;</li>
        <li>toute tentative de contourner les protections du site (scan antivirus, limitations d'usage, authentification).</li>
      </ul>

      <h2 style={legalStyles.h2}>Ta responsabilité</h2>
      <p>
        Tu es seul responsable du contenu que tu uploades. Le fait qu'un fichier passe le scan antivirus ne garantit pas
        qu'il soit licite — le scan détecte des menaces techniques (malwares), pas la légalité du contenu.
      </p>

      <h2 style={legalStyles.h2}>Modération et suppression</h2>
      <p>
        L'administrateur du site peut supprimer tout contenu, suspendre ou supprimer un compte, sans préavis, en cas de
        violation de ces règles ou de comportement abusif (spam, tentative de contournement des limites d'usage, etc.).
        Il peut également accéder aux fichiers d'un compte à des fins de modération ou pour répondre à une réquisition
        légale des autorités compétentes.
      </p>

      <h2 style={legalStyles.h2}>Disponibilité du service</h2>
      <p>
        Picture est un projet personnel, géré sans équipe ni astreinte. Il n'y a aucune garantie de disponibilité continue :
        le site peut être interrompu, temporairement indisponible, modifié ou arrêté à tout moment, sans préavis. Pense à
        conserver une copie de ce qui t'est important ailleurs.
      </p>

      <h2 style={legalStyles.h2}>Limitation de responsabilité</h2>
      <p>
        Dans la mesure permise par la loi, l'éditeur du site ne pourra être tenu responsable des dommages directs ou
        indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le service, y compris la perte de données
        hébergées.
      </p>

      <h2 style={legalStyles.h2}>Suppression de ton contenu</h2>
      <p>
        Tu peux à tout moment supprimer tes propres photos, albums, liens de partage ou ton compte entier depuis ton
        espace privé. La suppression d'un compte entraîne la suppression de toutes les données associées.
      </p>

      <h2 style={legalStyles.h2}>Modification de ces conditions</h2>
      <p>
        Ces conditions peuvent évoluer. La date de dernière mise à jour est indiquée en haut de cette page.
      </p>
    </LegalLayout>
  )
}
