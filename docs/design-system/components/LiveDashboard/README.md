Le dashboard en direct se projette en plein écran dans une salle de LAN, en thème sombre, avec le match en cours, la répartition du public et le classement.

- Utilise toujours le thème sombre (`data-theme="dark"`), `dash-body` (32px) pour le texte, `display` ou `dash-title` pour les noms et `dash-score` (112px, chiffres tabulaires) pour le score.
- Aucune information ne dépend d'une interaction : tout se lit sans cliquer. Contraste d'au moins 7:1 pour le texte courant sur `surface` et `surface-raised`.
- Le badge En direct est le seul élément jaune. Les pourcentages du public sont écrits en toutes lettres à côté de la jauge.
- Les changements de score et de classement s'annoncent dans une zone `aria-live="polite"`. Les mises à jour ne déclenchent aucune animation si `prefers-reduced-motion` est actif.
- Le consommateur fournit le match en cours, le match suivant, la répartition du public et les points des pronostiqueurs. La mise en page est prévue pour 1280 × 720 et s'adapte à 1920 × 1080 en conservant les proportions.
