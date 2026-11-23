L'écran mobile Pronostics montre le verrouillage imminent, un match en direct, une question Pick'em et la barre d'onglets.

- Gouttière `space-4`, cartes `oc-card`, une action principale large (`oc-btn--lg`, 48 dp) en bas de contenu.
- Barre d'onglets `oc-tabbar` à trois entrées (Tournois, Pronostics, Groupes) : icône et mot, 48 dp, onglet actif marqué par `aria-current="page"`, un liseré `brand` et la couleur `brand`.
- Le bandeau de verrouillage est un `role="status"` : les lecteurs d'écran l'annoncent sans prendre le focus.
- Les tailles de texte suivent le réglage du système (VoiceOver, TalkBack, taille de police dynamique) ; la mise en page doit rester complète quand le texte grandit.
- Les tokens se portent tels quels dans React Native ou Flutter, un pixel valant un dp. Suis le thème du système : clair par défaut, sombre quand il est actif.
- Le consommateur fournit le tournoi suivi, l'heure de verrouillage, les équipes et les questions Pick'em ouvertes.
