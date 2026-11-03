# Oracup : charte graphique

> Nom de travail à valider par le groupe. Document à placer dans `docs/CHARTE.md`. Les sections jusqu'à « Règles d'or du sujet » forment la mini charte demandée (environ deux pages) ; les annexes donnent les valeurs exactes pour les développeurs.

Oracup organise des tournois, importe ceux de la communauté et fait pronostiquer le public en direct. L'identité est sobre, lisible de loin et accessible d'abord : une coupe dessinée comme un arbre de tournoi, un vert profond, et un jaune « signal » réservé au direct et à la pastille du pronostic.

## Contenu et ton

- Tutoie. Phrases courtes, verbes d'action : « Valide ton pronostic », « Rejoindre le groupe », « Voir l'arbre ».
- Écris en casse de phrase : « Mes pronostics », jamais « MES PRONOSTICS ». Les capitales ne servent qu'au sigle de statut EN DIRECT (style `overline`).
- Parle de points, de badges et de titres. N'écris jamais mise, gain, cote, pari ni lot : la plateforme n'a aucun jeu d'argent.
- Annonce un résultat par un mot, jamais par la couleur seule : « Juste », « Faux », « Verrouillé », « En direct ».
- Un message d'erreur dit ce qui s'est passé et comment corriger : « Le score doit être un nombre entre 0 et 99 », pas « Entrée invalide ».
- Pas d'emoji. Les icônes sont les SVG du groupe Icons.
- Les données de démonstration sont fictives : équipes, pseudos et tournois inventés, jamais de vrai joueur ni de vrai tournoi.

## Couleur

- Fond de page `surface`, cartes et champs `surface-raised`, zones en creux ou sélectionnées `surface-strong`. Texte courant `ink`, texte secondaire `ink-soft`.
- `brand` est la seule couleur d'action : boutons principaux (texte `on-brand`), liens, état Juste, choix sélectionné, onglet actif.
- `signal` (jaune) sert uniquement au direct et à la pastille du pronostic, toujours en fond avec `on-signal` dessus. Ne l'emploie jamais en texte ni en trait sur fond clair (1,5:1).
- `loss` marque les erreurs, l'état Faux et les actions destructives, toujours avec une icône et un mot.
- Contours de champs, de choix et d'arbre : `border-ui` (3:1). `line` reste décoratif et ne délimite jamais seul un contrôle.
- Le thème clair est le défaut du web et du mobile, le thème sombre suit le réglage du système. Le dashboard en direct projeté utilise toujours le thème sombre.
- Chaque paire texte et fond de la palette est contrôlée à 4,5:1 minimum dans les deux thèmes, les contours et l'anneau de focus à 3:1.

## Typographie

- Titres, noms d'équipes et scores : Archivo, `font-stretch: 125%`, poids 700 ou 800, styles `display-xl`, `display`, `title`, `heading`, `score`.
- Texte et interface : Atkinson Hyperlegible, dessinée pour les personnes malvoyantes, styles `body-lg`, `body`, `body-sm`, `label`, `overline`.
- Aucun texte sous 14px. Les scores et les points utilisent des chiffres tabulaires pour que les colonnes restent alignées.
- Sur mobile, les tailles suivent le réglage de taille de texte du système : n'en fixe aucune en pixels absolus.
- Le dashboard projeté utilise les styles `dash-body`, `dash-title` et `dash-score`, prévus pour être lus à 10 mètres.

## Espacement, formes et traits

- Échelle d'espacement `space-1` à `space-12`. Marge intérieure d'une carte `space-4`, écart entre cartes `space-6`.
- Rayons : `radius-sm` pour les champs, `radius-md` pour les boutons, cartes et choix, `radius-lg` pour les feuilles, `radius-pill` pour les badges.
- Pas d'ombre portée : la hiérarchie se fait par `surface`, `surface-raised` et un contour `line` d'1px.
- Zones cliquables : `target-web` (44px) sur le web, `target-mobile` (48px) sur mobile.
- Anneau de focus : trait plein `stroke-focus` (3px) couleur `focus`, décalé de 2px, visible sur tous les contrôles.

## Logo

- Le symbole est une coupe dessinée comme un départ d'arbre : deux anses qui sont les premières lignes d'un tableau, une cuvette qui les réunit, et le point jaune du pronostic dedans. Le nom Oracup se compose à droite en Archivo, `font-stretch: 125%`, poids 800.
- Fichiers du groupe Logos : `oracup-mark.svg` sur fond clair, `oracup-mark-dark.svg` sur fond sombre, `oracup-app-icon.svg` pour l'icône d'application mobile et le favicon.
- Zone de protection : un diamètre du point jaune de chaque côté. Taille minimale : symbole 24px, symbole avec nom 96px de large.
- N'incline, n'étire, ne recolore ni n'ajoute d'effet. Ne remplace jamais le point jaune par une autre couleur.
- Le nom en texte dépend de la police : pour un export statique (PDF, affiche), convertis-le en contours.

## Icônes

- Jeu de quatre icônes de statut : `icon-check` (Juste), `icon-close` (Faux), `icon-lock` (Verrouillé), `icon-live` (En direct). Trait de 2px, extrémités arrondies, grille de 24px.
- Elles accompagnent toujours un mot et ne le remplacent jamais, sauf sur une zone tactile qui porte un nom accessible (`aria-label`).
- Ajoute de nouvelles icônes dans le même style : 24px, trait de 2px, extrémités et jointures arrondies, une seule encre.

## Mouvement

- Un seul mouvement : la pulsation du point du badge En direct.
- Respecte `prefers-reduced-motion` : sans préférence de réduction seulement, l'animation joue. Sinon le point reste fixe.
- Les mises à jour en direct d'un score ou d'un classement s'annoncent aux lecteurs d'écran par une zone `aria-live="polite"`, sans submerger.

## Accessibilité

- Cible : WCAG 2.2 niveau AA (RGAA) sur le web et sur mobile.
- Toute l'interface se pilote au clavier, y compris la saisie d'un arbre complet de pronostics, avec un ordre logique et le focus toujours visible.
- Un arbre graphique est toujours accompagné d'une vue tableau équivalente (composant Bracket).
- Aucune information ne repose sur la couleur seule : victoire, défaite, pronostic juste ou faux portent un mot et une icône (composant StatusBadge).
- Chaque champ a un libellé. Une erreur est liée à son champ (`aria-describedby`, `aria-invalid`) et propose une correction.
- Le contenu reste complet à 200 % de zoom et sur petit écran.
- Sur mobile : compatibilité VoiceOver et TalkBack, tailles de texte dynamiques, zones tactiles de 48 dp.

## Web, mobile, dashboard

- Web : mise en page fluide, cartes `oc-card`, contrôles de `components/bundle.css`.
- Mobile : gouttière `space-4`, barre de trois onglets (Tournois, Pronostics, Groupes) avec icône et mot, zones de 48 dp. Les tokens se portent tels quels dans React Native ou Flutter, un pixel valant un dp.
- Dashboard en direct : thème sombre, texte `dash-body` et plus, pas d'élément interactif nécessaire pour lire, score en `dash-score`.

## Règles d'or du sujet

- Aucune reprise du nom, du logo, des couleurs ou de l'interface de start.gg, de Riot Games, de League of Legends ou d'Epitech.
- Aucun visuel ni vocabulaire de jeu d'argent.
- Tout visuel, icône ou texte généré ou récupéré respecte sa licence ; l'usage de l'IA est déclaré dans le README du dépôt.

---

## Annexe A : couleurs

Les jetons sont nommés pour leur rôle. Chaque couleur a une valeur par thème ; le thème clair est le défaut.

| Jeton | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| `surface` | `#f3f6f4` | `#0c1716` | Fond de page. Porte `ink`, `ink-soft`, `brand` (liens) et `loss` à 4,5:1 minimum dans les deux thèmes. Le dashboard en direct utilise toujours le thème sombre. |
| `surface-raised` | `#ffffff` | `#142423` | Cartes, champs de saisie, feuilles et barre d'onglets. Porte `ink`, `ink-soft`, `brand`, `loss` et `signal` (thème sombre seulement) à 4,5:1 minimum. |
| `surface-strong` | `#e4ebe8` | `#1c3231` | Zones en creux, survol, choix sélectionné, éléments verrouillés, piste des jauges. Porte `ink`, `ink-soft`, `brand` et `loss` à 4,5:1 minimum. |
| `ink` | `#11201f` | `#eef5f2` | Texte courant sur `surface`, `surface-raised` et `surface-strong`. Trait du logo sur fond clair ou sombre. |
| `ink-soft` | `#3f5350` | `#a9bdb8` | Texte secondaire (aides, métadonnées, onglets inactifs) sur `surface`, `surface-raised` et `surface-strong`. Jamais en dessous de 14px. |
| `line` | `#c9d6d2` | `#2e4745` | Séparateurs et contour de carte, purement décoratifs. Ne délimite jamais seul un champ, un bouton ou un choix : utiliser `border-ui`. |
| `border-ui` | `#6b817d` | `#7c9893` | Contour des champs, boutons secondaires, choix non sélectionnés et traits d'arbre. 3:1 minimum sur `surface`, `surface-raised` et `surface-strong`. |
| `brand` | `#0c5c57` | `#5ed3c6` | Couleur de marque : fond des actions principales (texte `on-brand`), liens, état Juste, choix sélectionné, onglet actif. Elle s'éclaircit en thème sombre. |
| `brand-hover` | `#094744` | `#8fe3d9` | Survol et appui des actions principales. Texte `on-brand` dessus. |
| `on-brand` | `#ffffff` | `#0c1716` | Texte et icônes posés sur `brand` et `brand-hover`. Blanc en thème clair, sombre en thème sombre : jamais de blanc littéral. |
| `signal` | `#ffc83d` | `#ffc83d` | Jaune d'attention réservé au direct et à la pastille du pronostic. Toujours un fond avec `on-signal` dessus. Seul sur fond clair il n'atteint que 1,5:1 : ne jamais l'utiliser en texte ni en trait clair. |
| `on-signal` | `#11201f` | `#0c1716` | Texte et icônes posés sur `signal` (10,9:1 en clair, 11,8:1 en sombre). |
| `loss` | `#b3263e` | `#ff8da0` | Erreurs de saisie, état Faux, actions destructives. Toujours accompagné d'une icône et d'un mot, jamais seul. En thème sombre il s'éclaircit. |
| `on-loss` | `#ffffff` | `#0c1716` | Texte posé sur un fond `loss`. |
| `focus` | `{ink}` | `#ffc83d` | Anneau de focus : trait plein de 3px décalé de 2px (`stroke-focus`). 3:1 minimum sur toutes les surfaces, dans les deux thèmes. |

## Annexe B : typographie

- Famille d'affichage `--font-display` : "Archivo", "Helvetica Neue", Arial, sans-serif (`font-stretch: 125%`).
- Famille de texte `--font-body` : "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif.
- Les deux sont chargées depuis Google Fonts : `Archivo:wdth,wght@62..125,100..900` et `Atkinson+Hyperlegible:wght@400;700`.

| Style | Taille / interligne | Poids | Usage |
| --- | --- | --- | --- |
| `display-xl` | 56px / 60px | 800 | Titre d'une page d'accueil de tournoi. Archivo en largeur 125 (`font-stretch: 125%`). |
| `display` | 40px / 44px | 800 | Titre de page. |
| `title` | 28px / 34px | 700 | Titre de section ou d'écran mobile. |
| `heading` | 22px / 28px | 700 | Titre de carte. |
| `score` | 40px / 40px | 800 | Scores et points. Chiffres tabulaires. |
| `body-lg` | 18px / 28px | 400 | Texte d'introduction. |
| `body` | 16px / 24px | 400 | Texte courant, valeur des champs, boutons (en 700). |
| `body-sm` | 14px / 20px | 400 | Aides, métadonnées. Taille minimale du produit. |
| `label` | 14px / 20px | 700 | Libellés de champ, badges, onglets. |
| `overline` | 14px / 20px | 700 | Sigle de statut en capitales (EN DIRECT). Seul usage des capitales. |
| `dash-body` | 32px / 44px | 400 | Texte courant du dashboard projeté, lisible à 10 m. |
| `dash-title` | 56px / 60px | 800 | Titre du tournoi et noms d'équipes. |
| `dash-score` | 112px / 112px | 800 | Score du match en cours. Chiffres tabulaires. |

## Annexe C : espacements, rayons et traits

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `space-1` | 4px | Entre un libellé et son aide, entre une icône et son mot. |
| `space-2` | 8px | Entre éléments liés (icône et texte, badges). |
| `space-3` | 12px | Marge intérieure d'un champ ou d'un choix. |
| `space-4` | 16px | Marge intérieure d'une carte, gouttière mobile. |
| `space-6` | 24px | Entre cartes, entre groupes de champs. |
| `space-8` | 32px | Entre sections. |
| `space-12` | 48px | Marge d'une page web ou d'un écran projeté. |
| `target-web` | 44px | Hauteur minimale d'un bouton, d'un champ ou d'un lien isolé sur le web. |
| `target-mobile` | 48px | Zone tactile minimale sur mobile (48 dp Android, au-delà des 44 pt iOS). |
| `radius-sm` | 6px | Champs de saisie, cases d'arbre. |
| `radius-md` | 12px | Boutons, cartes, choix de pronostic. |
| `radius-lg` | 16px | Feuilles, grands blocs, écran mobile. |
| `radius-pill` | 999px | Badges de statut. |
| `stroke-hairline` | 1px | Séparateurs et contour de carte (couleur `line`). |
| `stroke-control` | 2px | Contour des champs, boutons secondaires, badges, icônes (couleur `border-ui`). |
| `stroke-focus` | 3px | Anneau de focus (couleur `focus`, décalé de 2px). |

## Annexe D : contrastes vérifiés

Ratios calculés avec la formule WCAG 2.x, le pire cas sur `surface`, `surface-raised` et `surface-strong`. Seuils : 4,5:1 pour le texte, 3:1 pour les contours et l'anneau de focus, 7:1 pour le dashboard projeté.

| Paire | Clair | Sombre | Seuil |
| --- | --- | --- | --- |
| `ink` sur les surfaces | 13.88 | 12.24 | 4,5 |
| `ink-soft` sur les surfaces | 6.76 | 6.88 | 4,5 |
| `brand` sur les surfaces | 6.46 | 7.49 | 4,5 |
| `loss` sur les surfaces | 5.32 | 6.17 | 4,5 |
| `border-ui` sur les surfaces | 3.43 | 4.37 | 3 |
| `focus` sur les surfaces | 13.88 | 8.76 | 3 |
| `on-brand` sur `brand` | 7.82 | 10.10 | 4,5 |
| `on-brand` sur `brand-hover` | 10.52 | 12.31 | 4,5 |
| `on-signal` sur `signal` | 10.86 | 11.81 | 4,5 |
| `on-loss` sur `loss` | 6.43 | 8.32 | 4,5 |
| `signal` seul sur `surface-raised` (interdit en texte) | 1.55 | 10.40 | à ne pas utiliser en clair |

## Annexe E : composants

Le détail visuel de chaque composant (aperçus interactifs et feuille de style `bundle.css`) est dans le design system publié. Règles d'usage :

### Logo

Le logo Oracup associe le symbole de la coupe et le nom composé en texte, sur fond clair, sombre ou de marque.

- Sur fond clair, utilise le symbole `oracup-mark.svg` avec `ink`. Sur fond sombre, `oracup-mark-dark.svg`. Sur `brand`, symbole et nom en `on-brand`, point jaune sans cercle.
- Compose le nom à droite du symbole, séparé de 12px pour un symbole de 56px (un cinquième de sa hauteur plus un demi-point). Police Archivo, `font-stretch: 125%`, poids 800, interlettrage -0,01em.
- Zone de protection : un diamètre du point jaune de chaque côté. Taille minimale : symbole 24px, symbole avec nom 96px de large.
- Utilise `oracup-app-icon.svg` pour l'icône mobile et le favicon : carré arrondi `brand`, symbole clair.

À ne pas faire : incliner ou étirer le logo, changer la couleur du point jaune, ajouter un effet, poser le logo sur un fond dont le contraste avec le trait est inférieur à 3:1.

Le nom en texte dépend de la police : pour un export statique, convertis-le en contours.

### Controls

Les boutons et champs de saisie Oracup, avec leurs états par défaut, de focus, désactivé et d'erreur.

- Classes : `oc-btn` avec `oc-btn--primary`, `oc-btn--secondary` ou `oc-btn--danger`, plus `oc-btn--lg` pour le mobile ; `oc-field`, `oc-field__label`, `oc-field__hint`, `oc-field__input`, `oc-field__error`. Elles viennent de `components/bundle.css`.
- Le bouton principal est unique par écran : fond `brand`, texte `on-brand`. Les actions secondaires utilisent le contour `border-ui`.
- Hauteur minimale 44px sur le web (`target-web`), 48px sur mobile (`target-mobile`). L'anneau de focus est toujours visible : 3px, `focus`, décalé de 2px.
- Un bouton désactivé reste lisible : fond `surface-strong`, contour en tirets, et un mot qui explique pourquoi (« Pronostic verrouillé »).
- Tout champ a un `<label>`. Une erreur s'écrit avec `aria-invalid="true"` sur le champ, un message lié par `aria-describedby`, une icône et un texte qui dit comment corriger. Ne signale jamais une erreur par la seule couleur du contour.
- Le consommateur fournit le libellé, la valeur, le texte d'aide et le message d'erreur.

### StatusBadge

Le badge de statut annonce un état (Juste, Faux, En direct, Verrouillé, À venir) par une icône et un mot, jamais par la couleur seule.

- Classes : `oc-badge` avec `oc-badge--win`, `--loss`, `--live`, `--locked` ou `--soon`. Le point du badge En direct est `oc-live__dot`.
- Le consommateur fournit l'icône (`icon-check`, `icon-close`, `icon-lock`, `icon-live`, ou une horloge pour À venir) et le mot. Une icône sans mot n'est acceptable que sur une zone qui porte un `aria-label`.
- Le badge En direct est le seul à utiliser `signal` : fond jaune, texte `on-signal`, mot en capitales (`overline`). La pulsation du point s'arrête si l'utilisateur demande moins d'animations.
- Juste utilise `brand`, Faux utilise `loss` : ne les distingue jamais par la teinte seule, l'icône et le mot sont obligatoires.
- Quand un statut change en direct, annonce-le dans une zone `aria-live="polite"`.

À ne pas faire : ajouter un statut sans icône, écrire le mot en capitales hors du badge En direct, ou utiliser `signal` pour autre chose que le direct.

### MatchCard

La carte de match permet de pronostiquer un vainqueur, puis affiche le pronostic verrouillé et son résultat.

- Structure : `oc-card` contenant `oc-match__head` (phase du tournoi et badge d'état), un titre, puis un `<fieldset class="oc-picks">` dont la `<legend>` est la question. Chaque choix est un `<label class="oc-pick">` avec un vrai `<input type="radio">` : le clavier et les lecteurs d'écran fonctionnent sans code en plus.
- Le choix sélectionné change de contour et de fond (`brand`, `surface-strong`) et affiche « Ton choix » avec une icône : la sélection ne repose pas sur la couleur.
- La répartition du public s'écrit en pourcentage dans le texte ; la jauge `oc-meter` est décorative (`aria-hidden`).
- Après verrouillage, désactive le `<fieldset>` et affiche le badge Verrouillé. Une fois le match joué, remplace la carte par le résultat et un badge Juste ou Faux avec les points gagnés.
- Le consommateur fournit les deux équipes, leur tête de série, la part du public, l'heure de fermeture et l'état du pronostic. Le verrouillage est décidé par l'horloge du serveur, jamais par celle du navigateur.
- Zone tactile d'au moins 48px par choix.

### Bracket

L'arbre de tournoi se dessine en SVG, toujours accompagné d'une vue tableau équivalente.

- Dessin : classes `oc-bracket__line` (traits, `border-ui`, 3:1), `oc-bracket__box` (case de participant), `oc-bracket__text`, `oc-bracket__mark` et `oc-bracket__tick` (pastille Vainqueur). Le SVG porte `role="img"` avec un `<title>` et un `<desc>` qui résument les résultats.
- Le vainqueur d'un match est en gras avec une pastille `brand` et une coche : jamais la couleur seule.
- La vue tableau (`oc-table`) liste tour, match, résultat et vainqueur. Elle est obligatoire et affiche exactement la même information que le dessin ; propose un bouton pour passer de l'une à l'autre.
- L'arbre peut dépasser l'écran : place-le dans un conteneur `overflow-x: auto`, jamais sur la page entière. Il reste complet à 200 % de zoom.
- Le consommateur fournit les rounds, les participants, les scores et le vainqueur de chaque match, et gère les exempts (case vide libellée « Exempt »).

### MobileApp

L'écran mobile Pronostics montre le verrouillage imminent, un match en direct, une question Pick'em et la barre d'onglets.

- Gouttière `space-4`, cartes `oc-card`, une action principale large (`oc-btn--lg`, 48 dp) en bas de contenu.
- Barre d'onglets `oc-tabbar` à trois entrées (Tournois, Pronostics, Groupes) : icône et mot, 48 dp, onglet actif marqué par `aria-current="page"`, un liseré `brand` et la couleur `brand`.
- Le bandeau de verrouillage est un `role="status"` : les lecteurs d'écran l'annoncent sans prendre le focus.
- Les tailles de texte suivent le réglage du système (VoiceOver, TalkBack, taille de police dynamique) ; la mise en page doit rester complète quand le texte grandit.
- Les tokens se portent tels quels dans React Native ou Flutter, un pixel valant un dp. Suis le thème du système : clair par défaut, sombre quand il est actif.
- Le consommateur fournit le tournoi suivi, l'heure de verrouillage, les équipes et les questions Pick'em ouvertes.

### LiveDashboard

Le dashboard en direct se projette en plein écran dans une salle de LAN, en thème sombre, avec le match en cours, la répartition du public et le classement.

- Utilise toujours le thème sombre (`data-theme="dark"`), `dash-body` (32px) pour le texte, `display` ou `dash-title` pour les noms et `dash-score` (112px, chiffres tabulaires) pour le score.
- Aucune information ne dépend d'une interaction : tout se lit sans cliquer. Contraste d'au moins 7:1 pour le texte courant sur `surface` et `surface-raised`.
- Le badge En direct est le seul élément jaune. Les pourcentages du public sont écrits en toutes lettres à côté de la jauge.
- Les changements de score et de classement s'annoncent dans une zone `aria-live="polite"`. Les mises à jour ne déclenchent aucune animation si `prefers-reduced-motion` est actif.
- Le consommateur fournit le match en cours, le match suivant, la répartition du public et les points des pronostiqueurs. La mise en page est prévue pour 1280 × 720 et s'adapte à 1920 × 1080 en conservant les proportions.

## Annexe F : symbole en SVG

Symbole pour fond clair (`oracup-mark.svg`) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Oracup">
  <path d="M7 11H19V34H45V11H57M32 34V50M21 55H43" fill="none" stroke="#11201F" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="23" r="6" fill="#FFC83D" stroke="#11201F" stroke-width="2.5"/>
</svg>
```

Symbole pour fond sombre (`oracup-mark-dark.svg`) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Oracup">
  <path d="M7 11H19V34H45V11H57M32 34V50M21 55H43" fill="none" stroke="#EEF5F2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="23" r="6" fill="#FFC83D"/>
</svg>
```
