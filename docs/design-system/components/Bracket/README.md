L'arbre de tournoi se dessine en SVG, toujours accompagné d'une vue tableau équivalente.

- Dessin : classes `oc-bracket__line` (traits, `border-ui`, 3:1), `oc-bracket__box` (case de participant), `oc-bracket__text`, `oc-bracket__mark` et `oc-bracket__tick` (pastille Vainqueur). Le SVG porte `role="img"` avec un `<title>` et un `<desc>` qui résument les résultats.
- Le vainqueur d'un match est en gras avec une pastille `brand` et une coche : jamais la couleur seule.
- La vue tableau (`oc-table`) liste tour, match, résultat et vainqueur. Elle est obligatoire et affiche exactement la même information que le dessin ; propose un bouton pour passer de l'une à l'autre.
- L'arbre peut dépasser l'écran : place-le dans un conteneur `overflow-x: auto`, jamais sur la page entière. Il reste complet à 200 % de zoom.
- Le consommateur fournit les rounds, les participants, les scores et le vainqueur de chaque match, et gère les exempts (case vide libellée « Exempt »).
