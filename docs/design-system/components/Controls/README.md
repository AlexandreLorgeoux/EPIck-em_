Les boutons et champs de saisie Oracup, avec leurs états par défaut, de focus, désactivé et d'erreur.

- Classes : `oc-btn` avec `oc-btn--primary`, `oc-btn--secondary` ou `oc-btn--danger`, plus `oc-btn--lg` pour le mobile ; `oc-field`, `oc-field__label`, `oc-field__hint`, `oc-field__input`, `oc-field__error`. Elles viennent de `components/bundle.css`.
- Le bouton principal est unique par écran : fond `brand`, texte `on-brand`. Les actions secondaires utilisent le contour `border-ui`.
- Hauteur minimale 44px sur le web (`target-web`), 48px sur mobile (`target-mobile`). L'anneau de focus est toujours visible : 3px, `focus`, décalé de 2px.
- Un bouton désactivé reste lisible : fond `surface-strong`, contour en tirets, et un mot qui explique pourquoi (« Pronostic verrouillé »).
- Tout champ a un `<label>`. Une erreur s'écrit avec `aria-invalid="true"` sur le champ, un message lié par `aria-describedby`, une icône et un texte qui dit comment corriger. Ne signale jamais une erreur par la seule couleur du contour.
- Le consommateur fournit le libellé, la valeur, le texte d'aide et le message d'erreur.
