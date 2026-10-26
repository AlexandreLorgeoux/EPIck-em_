# Connecteur start.gg — champs disponibles via l'API publique

> Ticket 6 — Sprint 1. Résultat du test du token et de l'exploration de
> l'API GraphQL publique de start.gg (`https://api.start.gg/gql/alpha`).

## Authentification

- Token personnel généré sur [start.gg/admin/profile/developer](https://start.gg/admin/profile/developer).
- Transmis en header HTTP : `Authorization: Bearer <token>`.
- Stocké uniquement dans `.env` (variable `STARTGG_API_TOKEN`), jamais commité.
- Validé avec une requête `currentUser { id name }` → réponse OK (`id` non
  nul), confirmant que le token est valide et actif.

## Requête de test réussie

Tournoi réel interrogé : `tournament/genesis-cup-46` (Tekken 8, terminé,
24 participants), via l'event `T8 Genesis Cup` (id `1736808`).

```graphql
query {
  event(id: 1736808) {
    id
    name
    sets(perPage: 5) {
      nodes {
        id
        fullRoundText
        round
        winnerId
        displayScore
        slots {
          seed { seedNum }
          entrant { id name }
          standing { stats { score { value } } }
        }
        games {
          id
          winnerId
          orderNum
          selections { entrant { id } selectionValue }
        }
      }
    }
  }
}
```

Réponse : 5 sets réels retournés (round 1, Winners), avec scores, vainqueurs,
seeds et entrants nommés. Requête GraphQL fonctionnelle de bout en bout.

## Champs réellement disponibles (notation)

| Catégorie | Champ / type GraphQL | Disponibilité constatée |
| --- | --- | --- |
| **Phases** | `Event.phases { id name }` | ✅ Disponible dès que l'organisateur a généré le bracket. **Vide** (`[]`) si le bracket n'est pas encore créé (constaté sur un tournoi à venir, `genesis-x4`). |
| **Groupes de phase** | `Phase.phaseGroups { nodes { id } }` | ✅ Disponible, un phase group par poule/bracket. |
| **Matchs (sets)** | `Event.sets`, `PhaseGroup.sets` | ✅ Disponible et riche : `fullRoundText`, `round`, `winnerId`, `displayScore`, `slots` (participants + score + seed). |
| **Manches (games)** | `Set.games { id winnerId orderNum }` | ✅ Disponible pour les sets joués ; `null` si le set n'a pas encore de détail manche par manche (ex. sets pas encore reportés en détail). |
| **Seeds** | `Slot.seed { seedNum }` | ✅ Disponible et fiable, présent sur chaque slot de chaque set. |
| **Personnages / champions joués** | `Game.selections { character { id name } }` (via `GameSelection`) | ⚠️ Champ présent dans le schéma, mais **vide en pratique** sur la plupart des tournois (`selections: null` constaté) : dépend entièrement de la saisie par l'organisateur ou d'un outil tiers (ex. tracker Melee/Slippi). Ne pas supposer la donnée disponible par défaut. |
| **Cartes / stages** | `Game.stage { id name }` | ⚠️ Même constat que les personnages : champ présent dans le schéma (confirmé par introspection), mais non renseigné sur l'exemple testé. |
| **Participants / équipes** | `Entrant { id name }`, `Entrant.participants` | ✅ Disponible, noms d'entrants réels récupérés. |
| **Classements / standings** | `Standing.stats.score.value` | ✅ Disponible par slot de set. |
| **Jeux déclarés** | `Event.videogame { id name }` | ✅ Disponible et fiable sur chaque event. |
| **Volume d'inscrits** | `Event.numEntrants`, `Tournament.numAttendees` | ✅ Disponible, fiable. |

## Conséquences pour le connecteur EPIck'em

- Le connecteur doit gérer l'**absence de personnages/cartes** comme un cas
  normal (pas une erreur) : les Pick'em basés sur ces statistiques ne doivent
  être proposés que si `selections`/`stage` sont effectivement renseignés
  pour l'event importé (cf. sujet 03-E : « le constructeur ne propose que les
  questions réellement résolubles »).
- Les phases vides (`phases: []`) signifient que le bracket n'est pas encore
  généré côté start.gg : un import à ce stade doit être traité comme un
  tournoi « à venir », sans arbre encore disponible.
- Les champs `sets`, `seeds`, `standing.stats.score` sont suffisamment
  fiables pour reconstruire l'arbre, les scores et les classements — ce sont
  les champs prioritaires pour le connecteur.

## Limites de requêtes (rate limit)

Chaque réponse inclut `extensions.queryComplexity` (coût de la requête) —
à surveiller et journaliser côté connecteur pour respecter les limites de
l'API publique start.gg (cache + synchronisation périodique, cf. sujet 02-D).
