# pixel
Retrogaming Frontend

## Configuration JSON

Un fichier `config.json` est stocké dans le dossier `userData` d'Electron (ex: `%APPDATA%/pixel/config.json`).

APIs dispo côté renderer via `window.config` (exposées par `preload`):

- `await window.config.get()` → lit la configuration
- `await window.config.set(cfg)` → écrit la configuration

Exemple d'usage (renderer):

```ts
const cfg = await window.config.get();
await window.config.set({ ...cfg, theme: 'dark' });
```
