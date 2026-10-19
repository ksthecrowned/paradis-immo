import { LandingFooter, LandingLogo } from '@/components/landing';
import type { Metadata } from 'next';
import Link from 'next/link';
import '../../landing.css';

export const metadata: Metadata = {
  title: 'Supprimer votre compte — Paradis Immo',
  description:
    'Comment demander la suppression de votre compte Paradis Immo et de vos données personnelles, avec ou sans l’application mobile.',
};

/** Public URL declared in the store listings (Google Play data safety). */
export const ACCOUNT_DELETION_URL_PATH = '/account/delete';

const SUPPORT_EMAIL = 'privacy@paradis-immo.com';

export default function AccountDeletionPage(): React.JSX.Element {
  return (
    <div className="landing min-h-screen antialiased">
      <header className="border-b border-(--lp-border) bg-(--lp-surface)">
        <div className="landing-container flex h-18 items-center justify-between md:h-20">
          <LandingLogo />
          <Link
            href="/"
            className="text-[15px] font-semibold text-(--lp-primary) transition-colors hover:text-(--lp-primary-hover)"
          >
            Retour à l’accueil
          </Link>
        </div>
      </header>

      <main className="landing-container py-12 md:py-16">
        <p className="text-sm font-medium text-(--lp-primary)">
          Compte et données personnelles
        </p>
        <h1 className="mt-2 text-[32px] font-bold tracking-tight text-(--lp-ink) md:text-[44px]">
          Supprimer votre compte
        </h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-(--lp-muted)">
          Cette page vous permet de demander la suppression de votre compte
          Paradis Immo et des données associées, sans avoir à réinstaller
          l’application mobile. La demande est ouverte à tout titulaire de
          compte.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-(--lp-primary) px-5 py-3 text-[15px] font-semibold text-(--lp-on-primary) transition-colors hover:bg-(--lp-primary-hover)"
          >
            Se connecter pour supprimer mon compte
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Demande%20de%20suppression%20de%20compte`}
            className="inline-flex items-center justify-center rounded-xl border border-(--lp-border) px-5 py-3 text-[15px] font-semibold text-(--lp-ink) transition-colors hover:bg-(--lp-surface)"
          >
            Demander par e-mail
          </a>
        </div>

        <div className="prose-privacy mt-12 max-w-3xl space-y-10 text-[15px] leading-relaxed text-(--lp-ink)">
          <section className="space-y-3">
            <h2 className="text-xl font-bold">1. Comment demander la suppression</h2>
            <ol className="list-decimal space-y-3 ps-5 text-(--lp-muted)">
              <li>
                <strong className="font-semibold text-(--lp-ink)">
                  Depuis l’application mobile
                </strong>{' '}
                : ouvrez <span className="font-medium">Profil</span> →{' '}
                <span className="font-medium">Réglages</span> →{' '}
                <span className="font-medium">Compte</span> →{' '}
                <span className="font-medium">Supprimer mon compte</span>, puis
                confirmez la demande.
              </li>
              <li>
                <strong className="font-semibold text-(--lp-ink)">
                  Depuis un navigateur, sans l’application
                </strong>{' '}
                : connectez-vous avec le numéro de téléphone du compte sur{' '}
                <Link
                  href="/login"
                  className="font-medium text-(--lp-primary) hover:underline"
                >
                  la page de connexion
                </Link>
                , puis ouvrez{' '}
                <span className="font-medium">Profil → Sécurité</span> et
                utilisez le bouton{' '}
                <span className="font-medium">Supprimer le compte</span>.
              </li>
              <li>
                <strong className="font-semibold text-(--lp-ink)">
                  Si vous n’avez plus accès à ce numéro
                </strong>{' '}
                : écrivez à{' '}
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=Demande%20de%20suppression%20de%20compte`}
                  className="font-medium text-(--lp-primary) hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>{' '}
                en précisant le numéro de téléphone du compte et, si possible,
                une pièce permettant de vérifier que vous en êtes le titulaire.
                Nous ne supprimons pas un compte sur simple demande anonyme.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">2. Quand la suppression prend effet</h2>
            <ul className="list-disc space-y-2 ps-5 text-(--lp-muted)">
              <li>
                <strong className="font-semibold text-(--lp-ink)">
                  Immédiatement
                </strong>{' '}
                : le compte est désactivé, vos annonces et accès sont retirés et
                toutes vos sessions sont fermées.
              </li>
              <li>
                <strong className="font-semibold text-(--lp-ink)">
                  Pendant 30 jours
                </strong>{' '}
                : la suppression est en attente et peut encore être annulée en
                vous reconnectant avec votre numéro, dans l’application ou sur ce
                site (l’annulation est alors proposée à la connexion).
              </li>
              <li>
                <strong className="font-semibold text-(--lp-ink)">
                  Au bout de 30 jours
                </strong>{' '}
                : vos données personnelles sont effacées ou anonymisées de
                manière irréversible, et l’annulation n’est plus possible.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">3. Ce qui peut empêcher une suppression immédiate</h2>
            <p className="text-(--lp-muted)">
              Un compte engagé dans une opération en cours ne peut pas être
              supprimé tant que l’engagement existe. La demande est alors
              refusée avec la liste des éléments concernés, à traiter d’abord :
            </p>
            <ul className="list-disc space-y-2 ps-5 text-(--lp-muted)">
              <li>un bail de location toujours actif ;</li>
              <li>un séjour ou une réservation à venir ;</li>
              <li>un dossier de vente en cours ;</li>
              <li>un solde de loyer encore dû.</li>
            </ul>
            <p className="text-(--lp-muted)">
              Ces contrôles sont réalisés par nos serveurs, jamais par
              l’interface : la demande est refusée tant qu’un blocage subsiste.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">4. Données conservées après la suppression</h2>
            <p className="text-(--lp-muted)">
              Nous supprimons ou anonymisons les données d’identification
              (nom, e-mail, photo, préférences, appareils de notification,
              codes et sessions). Certaines données sont conservées sous une
              forme limitée lorsque la loi ou la défense de nos droits
              l’impose : écritures comptables, paiements, baux et pièces liés à
              une opération déjà engagée. Ces éléments ne sont plus rattachés à
              votre identité après anonymisation et ne sont pas réutilisés à des
              fins commerciales.
            </p>
            <p className="text-(--lp-muted)">
              Les obligations contractuelles et comptables peuvent donc
              survivre en partie à la suppression du compte, conformément à{' '}
              <Link
                href="/privacy"
                className="font-medium text-(--lp-primary) hover:underline"
              >
                notre politique de confidentialité
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">5. Contact</h2>
            <p className="text-(--lp-muted)">
              Pour toute question sur cette procédure ou pour suivre une demande
              en cours, écrivez à{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-(--lp-primary) hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
