La carte de match permet de pronostiquer un vainqueur, puis affiche le pronostic verrouillé et son résultat.

- Structure : `oc-card` contenant `oc-match__head` (phase du tournoi et badge d'état), un titre, puis un `<fieldset class="oc-picks">` dont la `<legend>` est la question. Chaque choix est un `<label class="oc-pick">` avec un vrai `<input type="radio">` : le clavier et les lecteurs d'écran fonctionnent sans code en plus.
- Le choix sélectionné change de contour et de fond (`brand`, `surface-strong`) et affiche « Ton choix » avec une icône : la sélection ne repose pas sur la couleur.
- La répartition du public s'écrit en pourcentage dans le texte ; la jauge `oc-meter` est décorative (`aria-hidden`).
- Après verrouillage, désactive le `<fieldset>` et affiche le badge Verrouillé. Une fois le match joué, remplace la carte par le résultat et un badge Juste ou Faux avec les points gagnés.
- Le consommateur fournit les deux équipes, leur tête de série, la part du public, l'heure de fermeture et l'état du pronostic. Le verrouillage est décidé par l'horloge du serveur, jamais par celle du navigateur.
- Zone tactile d'au moins 48px par choix.
