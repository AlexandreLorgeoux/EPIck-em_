Le badge de statut annonce un état (Juste, Faux, En direct, Verrouillé, À venir) par une icône et un mot, jamais par la couleur seule.

- Classes : `oc-badge` avec `oc-badge--win`, `--loss`, `--live`, `--locked` ou `--soon`. Le point du badge En direct est `oc-live__dot`.
- Le consommateur fournit l'icône (`icon-check`, `icon-close`, `icon-lock`, `icon-live`, ou une horloge pour À venir) et le mot. Une icône sans mot n'est acceptable que sur une zone qui porte un `aria-label`.
- Le badge En direct est le seul à utiliser `signal` : fond jaune, texte `on-signal`, mot en capitales (`overline`). La pulsation du point s'arrête si l'utilisateur demande moins d'animations.
- Juste utilise `brand`, Faux utilise `loss` : ne les distingue jamais par la teinte seule, l'icône et le mot sont obligatoires.
- Quand un statut change en direct, annonce-le dans une zone `aria-live="polite"`.

À ne pas faire : ajouter un statut sans icône, écrire le mot en capitales hors du badge En direct, ou utiliser `signal` pour autre chose que le direct.
