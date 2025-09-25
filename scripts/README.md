# Scripts

Aperçu des scripts utilitaires disponibles.

| Script NPM           | But                                                                                | Détails                                                     |
| -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `build:native`       | Compile l'addon XInput natif et copie le binaire dans `dist-native/`               | Utilise node-gyp dans `native/xinput`.                      |
| `copy:native`        | Copie manuellement le binaire natif depuis le dossier de build vers `dist-native/` | Normalement appelé par `build:native`.                      |
| `test:xinput`        | Auto‑test de l'addon natif : attend un combo Start+Back 10s                        | Retour codes: 0 (event), 2 (timeout), 1 (échec chargement). |
| `test:screenscraper` | Lance un test manuel d'appel à l'API ScreenScraper                                 | Nécessite config/credentials si requis.                     |

## Notes

- Le script historique `rebuild:natives` a été retiré; la recompilation passe uniquement par `npm run build:native`.
- Les modules natifs externes (ffi-napi, etc.) ont été supprimés.
