# Design system Oracup

Export du design system Oracup. Les règles d'usage sont dans la charte, [`docs/CHARTE.md`](../CHARTE.md) ; ce dossier garde les sources exactes.

| Fichier | Contenu |
| --- | --- |
| `tokens.json`, `tokens.css` | Jetons de couleur (thèmes clair et sombre), typographie, espacements, rayons et traits. |
| `api/tokens.md` | Les mêmes jetons, documentés un par un. |
| `components/bundle.css` | Styles des composants (`oc-btn`, `oc-field`, `oc-badge`, `oc-card`, `oc-table`…), indépendants du framework. |
| `components/*/README.md`, `api/components/*.md` | Règles de chaque composant. |
| `components/*/preview.html` | Aperçus à ouvrir dans un navigateur. |
| `assets/Logos`, `assets/Icons` | Symbole, icône d'application et icônes de statut en SVG. |
| `manifest.json` | Index de l'export. |

Le web en utilise une copie dans `apps/web/src/styles/` (voir la section « Dans le code » de la charte). Pour une nouvelle version du design system, remplace ce dossier par l'export, puis reporte `tokens.css` et `bundle.css` dans le web.
