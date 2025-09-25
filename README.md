# pixel

Retrogaming Frontend

## Instructions importantes pour les contributeurs

⚠️ **ATTENTION** : Ce projet utilise exclusivement le français pour toute la documentation, les commentaires, et les communications. Consultez [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) pour les directives complètes destinées aux développeurs et aux intelligences artificielles.

## Configuration JSON

Un fichier `config.json` est stocké dans le dossier `userData` d'Electron (ex: `%APPDATA%/pixel/config.json`).

APIs dispo côté renderer via `window.config` (exposées par `preload`):

- `await window.config.get()` → lit la configuration
- `await window.config.set(cfg)` → écrit la configuration

Exemple d'usage (renderer):

```ts
const cfg = await window.config.get();
await window.config.set({ ...cfg, theme: "dark" });
```

## Addon natif XInput (détection globale Start+Select)

La détection globale (même fenêtre hors focus) s'appuie désormais exclusivement sur un addon N-API minimal dans `native/xinput`. L'ancien chemin basé sur `ffi-napi` / `ref-napi` a été totalement retiré.

### Prérequis build (Windows)

1. Node 20 LTS (voir `.nvmrc`).
2. Python 3.11+ (dans le PATH).
3. Microsoft Build Tools 2022 (C++ workload + Windows 10/11 SDK).
4. Redémarrez le terminal après installation.

Validation rapide manuelle :

```cmd
node -v
python --version
where MSBuild.exe
```

### Compilation de l'addon

```cmd
npm run build:native   # compile puis copie automatique du binaire dans dist-native
```

Test rapide (interaction):

```cmd
npm run test:xinput   # attend 10s un combo Start+Back et affiche le résultat
```

Le binaire attendu : `native/xinput/build/Release/xinput_native.node`.

Chargement dynamique géré par `src/services/xinput-native-addon.ts`; utilisation dans `src/services/xinput-global.ts`.

### Vérifier l'activation

Dans la console (process principal ou renderer selon l'intégration), appeler `isGlobalWatcherActive()` après démarrage. Si `false`, l'addon n'a pas été chargé (aucune détection globale ne sera effectuée – il n'existe plus de fallback FFI).

### Avantages

- Surface native réduite (moins de dépendances fragiles)
- Pas de libffi ni toolchain exotique
- Chemins XInput résolus dynamiquement (1_4 -> 1_3 -> 9_1_0)

### Migration (historique)

Les versions précédentes utilisaient `ffi-napi` + `ref-napi`. Des problèmes de compilation (notamment l'erreur libffi `call "call"`) sur certains environnements ont motivé l'écriture d'un binding dédié. Toute la logique de fallback FFI a été supprimée; si vous voyez encore des références FFI dans un fork local, rebasez sur `main`.

Le script historique `rebuild:natives` a été retiré (il n'apportait qu'un message). Utilisez uniquement `npm run build:native`.

### Prochaines étapes possibles

- Prébuilds CI (Windows x64) pour éviter la toolchain locale
- Ajout d'un test automatisé simulant une séquence Start+Select
