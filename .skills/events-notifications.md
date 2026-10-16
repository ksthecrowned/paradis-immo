---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: events
audience: agents, humans
---

# Événements, notifications et tâches asynchrones

## Où regarder

- Publication et types : `apps/api/src/events/`.
- Notifications, handlers et devices : `apps/api/src/notifications/`.
- Émission d'événements : domaine producteur et `EventPublisher`.
- Scheduling : `ScheduleModule` dans `app.module.ts`, puis processor/service de domaine.
- Navigation mobile : `apps/mobile/lib/notifications.ts` et map des routes inbox.
- Specs : 11 (notifications) et événements dans les domaines fonctionnels.

## Règles

- Établir le trajet complet producteur → type d'événement → handler → canal → état utilisateur avant de déclarer un événement traité.
- Les événements sont déclenchés seulement après une transition métier valide et persistée.
- Les handlers doivent tolérer les retries/doublons et ne doivent pas créer deux paiements, reçus ou actions métier.
- Isoler les erreurs de canal sans convertir une notification échouée en succès silencieux ; le statut et le retry doivent rester observables.
- Contrôler l'accès de chaque destinataire à la ressource liée avant d'inclure des données ou deep links.
- Les crons doivent être idempotents, observables, timezone-aware et testés sur les frontières de date.
- Les tokens d'appareil sont secrets opérationnels ; ne pas les journaliser en clair.

## Tests

Tester que l'événement est produit uniquement à la bonne transition, qu'il atteint les bons destinataires, qu'un replay ne duplique pas l'effet, et qu'un échec est visible/rejouable conformément au contrat.

## Références

- [Spec notifications](../docs/specs/11-notifications.md)
- [Spec lancement/exploitation](../docs/specs/16-preparation-lancement-et-exigences-transverses.md)
- [Paiements](money-flows.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
