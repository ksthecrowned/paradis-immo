import { LandingFooter, LandingLogo } from '@/components/landing';
import type { Metadata } from 'next';
import Link from 'next/link';
import '../landing.css';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Paradis Immo',
  description:
    'Comment Paradis Immo collecte, utilise et protège vos données personnelles.',
};

const UPDATED_AT = '15 septembre 2026';

export default function PrivacyPage(): React.JSX.Element {
  return (
    <div className="landing min-h-screen antialiased">
      <header className="border-b border-[var(--lp-border)] bg-[var(--lp-surface)]">
        <div className="landing-container flex h-[72px] items-center justify-between md:h-20">
          <LandingLogo />
          <Link
            href="/"
            className="text-[15px] font-semibold text-[var(--lp-primary)] transition-colors hover:text-[var(--lp-primary-hover)]"
          >
            Retour à l’accueil
          </Link>
        </div>
      </header>

      <main className="landing-container py-12 md:py-16">
        <p className="text-sm font-medium text-[var(--lp-primary)]">
          Mentions légales
        </p>
        <h1 className="mt-2 text-[32px] font-bold tracking-tight text-[var(--lp-ink)] md:text-[44px]">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-[15px] text-[var(--lp-muted)]">
          Dernière mise à jour : {UPDATED_AT}
        </p>

        <div className="prose-privacy mt-10 max-w-3xl space-y-10 text-[15px] leading-relaxed text-[var(--lp-ink)]">
          <section className="space-y-3">
            <h2 className="text-xl font-bold">1. Qui sommes-nous ?</h2>
            <p className="text-[var(--lp-muted)]">
              La présente politique décrit le traitement des données
              personnelles réalisé dans le cadre de la plateforme{' '}
              <strong className="font-semibold text-[var(--lp-ink)]">
                Paradis Immo
              </strong>
              , service immobilier hybride (location longue, courte durée et
              vente) destiné notamment au Congo (CG).
            </p>
            <p className="text-[var(--lp-muted)]">
              Pour toute question relative à vos données :{' '}
              <a
                href="mailto:privacy@paradis-immo.com"
                className="font-medium text-[var(--lp-primary)] hover:underline"
              >
                privacy@paradis-immo.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">2. Données que nous collectons</h2>
            <p className="text-[var(--lp-muted)]">
              Selon l’usage de la plateforme (site web, application mobile,
              espace propriétaire / agent / admin), nous pouvons collecter :
            </p>
            <ul className="list-disc space-y-2 ps-5 text-[var(--lp-muted)]">
              <li>
                <strong className="font-semibold text-[var(--lp-ink)]">
                  Identité et contact
                </strong>{' '}
                : nom, numéro de téléphone, adresse e-mail (le cas échéant).
              </li>
              <li>
                <strong className="font-semibold text-[var(--lp-ink)]">
                  Authentification
                </strong>{' '}
                : codes OTP SMS, sessions de connexion, et si vous l’utilisez,
                données liées à la connexion Google.
              </li>
              <li>
                <strong className="font-semibold text-[var(--lp-ink)]">
                  Données immobilières
                </strong>{' '}
                : annonces, photos, disponibilités, demandes de visite,
                mandats, baux, dossiers de vente, tickets de maintenance.
              </li>
              <li>
                <strong className="font-semibold text-[var(--lp-ink)]">
                  Paiements
                </strong>{' '}
                : informations nécessaires au suivi des loyers et preuves de
                paiement (montants, statuts, pièces justificatives). Nous ne
                stockons pas les numéros complets de cartes bancaires.
              </li>
              <li>
                <strong className="font-semibold text-[var(--lp-ink)]">
                  Données techniques
                </strong>{' '}
                : journaux techniques, type d’appareil / navigateur, adresses IP
                approximatives, cookies ou équivalents nécessaires au
                fonctionnement du service.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">3. Finalités</h2>
            <p className="text-[var(--lp-muted)]">Nous utilisons vos données pour :</p>
            <ul className="list-disc space-y-2 ps-5 text-[var(--lp-muted)]">
              <li>créer et gérer votre compte ;</li>
              <li>fournir les fonctionnalités de la plateforme (annonces, visites, locations, ventes, maintenance) ;</li>
              <li>sécuriser l’accès (OTP, sessions, prévention des abus) ;</li>
              <li>traiter et suivre les paiements liés aux biens ;</li>
              <li>vous envoyer des notifications opérationnelles (SMS, e-mails, notifications in-app) ;</li>
              <li>améliorer le service, diagnostiquer les incidents et respecter nos obligations légales.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">4. Bases du traitement</h2>
            <p className="text-[var(--lp-muted)]">
              Les traitements reposent principalement sur l’exécution du
              contrat (fourniture du service), votre consentement lorsque
              requis (ex. certaines communications), et notre intérêt légitime
              à sécuriser et améliorer la plateforme, dans le respect des
              droits des utilisateurs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">5. Destinataires et sous-traitants</h2>
            <p className="text-[var(--lp-muted)]">
              Vos données sont accessibles aux équipes Paradis Immo habilitées
              et, selon le contexte, aux propriétaires, agents ou locataires /
              acheteurs concernés par une transaction.
            </p>
            <p className="text-[var(--lp-muted)]">
              Nous pouvons faire appel à des prestataires techniques (hébergement,
              envoi de SMS OTP, stockage de fichiers, authentification),
              uniquement pour les besoins du service et sous des obligations de
              confidentialité appropriées.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">6. Conservation</h2>
            <p className="text-[var(--lp-muted)]">
              Les données sont conservées pendant la durée nécessaire aux
              finalités ci-dessus, puis archivées ou supprimées. Les données
              liées à un compte sont en principe conservées tant que le compte
              est actif, puis pendant une durée raisonnable après clôture pour
              sécurité, litiges éventuels et obligations légales.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">7. Sécurité</h2>
            <p className="text-[var(--lp-muted)]">
              Nous mettons en œuvre des mesures techniques et organisationnelles
              raisonnables (contrôle d’accès, sessions authentifiées, chiffrement
              en transit via HTTPS, séparation des environnements) pour protéger
              vos données. Aucun système n’étant infaillible, nous vous
              encourageons à protéger également votre appareil et vos codes OTP.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">8. Vos droits</h2>
            <p className="text-[var(--lp-muted)]">
              Selon la réglementation applicable, vous pouvez demander l’accès,
              la rectification, la mise à jour ou la suppression de vos données,
              ainsi que la limitation de certains traitements, dans la mesure
              compatible avec nos obligations légales et contractuelles.
            </p>
            <p className="text-[var(--lp-muted)]">
              Pour exercer ces droits, contactez{' '}
              <a
                href="mailto:privacy@paradis-immo.com"
                className="font-medium text-[var(--lp-primary)] hover:underline"
              >
                privacy@paradis-immo.com
              </a>{' '}
              en précisant votre numéro de téléphone ou e-mail de compte.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">9. Cookies et sessions</h2>
            <p className="text-[var(--lp-muted)]">
              Le site utilise des cookies ou mécanismes équivalents nécessaires
              à l’authentification, à la sécurité de la session et au
              fonctionnement de l’interface (par exemple le thème clair / sombre).
              Ces éléments ne sont pas destinés à de la publicité tierce.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">10. Mineurs</h2>
            <p className="text-[var(--lp-muted)]">
              Le service s’adresse à des utilisateurs majeurs capables de
              contracter. Si vous pensez qu’un mineur nous a communiqué des
              données, contactez-nous pour que nous puissions les supprimer.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">11. Modifications</h2>
            <p className="text-[var(--lp-muted)]">
              Cette politique peut évoluer. La date de mise à jour figurant en
              tête de page fait foi. En cas de changement important, nous
              pourrons vous en informer via l’application ou le site.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
