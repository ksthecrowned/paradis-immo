# Architecture Decision Records

Les ADR consignent les décisions durables qui affectent plusieurs domaines, applications, contrats publics, sécurité, données ou exploitation. Ils expliquent le contexte et les compromis ; ils ne remplacent ni les specs métier, ni le code.

## Quand créer un ADR

Créer un ADR lorsqu'une décision :

- change un contrat API partagé ou une convention de réponse ;
- modifie l'authentification, l'autorisation, le modèle de rôles ou l'isolation multi-agences ;
- introduit ou change un modèle financier, une source de vérité ou un invariant de données ;
- impacte les migrations, stockage, architecture de déploiement ou intégration externe ;
- admet plusieurs options raisonnables avec des conséquences durables.

Un correctif local, une refonte sans changement de comportement ou un choix cosmétique ne nécessite généralement pas d'ADR.

## Cycle de vie

`Proposed → Accepted → (Deprecated | Superseded by ADR-NNNN)`

- L'ADR accepté reste la décision courante jusqu'à son remplacement explicite.
- Une décision remplacée n'est pas réécrite : créer un nouvel ADR et établir le lien.
- Une décision proposée n'est pas une convention en vigueur.

## Nommage et procédure

Nommer `NNNN-titre-court.md` avec un numéro séquentiel à quatre chiffres.

1. Copier [`template.md`](template.md).
2. Expliquer le contexte, les options envisagées, la décision et ses conséquences.
3. Lier les domaines/API/apps et tests concernés.
4. Mettre à jour le présent index après acceptation.
5. Ajouter une date de vérification si le code ou l'infrastructure évolue.

## Index

| ADR | Titre | Statut |
|---|---|---|
| Aucun enregistré | Les décisions actuellement implicites doivent être consignées au fil des changements structurants. | — |
