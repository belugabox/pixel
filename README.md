# Pixel

**Pixel** est un frontend de retrogaming élégant et minimaliste, conçu pour organiser et lancer vos jeux rétro préférés avec une interface simple et navigable à la manette.

<!-- Suggestion : Ajoutez une capture d'écran de l'application ici -->
<!-- ![Aperçu de Pixel](lien_vers_votre_screenshot.png) -->

## Fonctionnalités

*   **Navigation intuitive** : Conçu pour être utilisé principalement à la manette.
*   **Organisation par système** : Vos jeux sont groupés par console ou système d'origine.
*   **Scraping de métadonnées** : Récupération automatique des informations et jaquettes de vos jeux (via ScreenScraper).
*   **Personnalisation** : Thèmes et autres options configurables.
*   **Détection globale de raccourcis** : Quittez un émulateur ou revenez au menu principal grâce à un raccourci manette (Start + Select), même si l'application n'est pas en focus.

## Installation

Pour faire tourner Pixel en local, suivez ces étapes :

1.  **Clonez le dépôt :**
    ```bash
    git clone https://github.com/belugabox/pixel.git
    cd pixel
    ```

2.  **Installez les dépendances :**
    Ce projet utilise Node.js v20. Si vous utilisez `nvm`, lancez `nvm use`.
    ```bash
    npm install
    ```

3.  **Compilez l'addon natif (pour Windows) :**
    Pour que la détection des raccourcis manette fonctionne, vous devez compiler le module natif. Consultez la section [Prérequis pour la compilation](#prérequis-pour-la-compilation-windows) ci-dessous.
    ```bash
    npm run build:native
    ```

## Utilisation

Une fois l'installation terminée, lancez l'application en mode développement :

```bash
npm start
```

## Pour les développeurs

Cette section contient des informations techniques pour ceux qui souhaitent contribuer au projet.

### Instructions importantes pour les contributeurs

⚠️ **ATTENTION** : Ce projet utilise exclusivement le français pour toute la documentation, les commentaires, et les communications. Consultez [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) pour les directives complètes.

### Configuration JSON

Un fichier `config.json` est stocké dans le dossier `userData` d'Electron (ex: `%APPDATA%/pixel/config.json`).

Des APIs sont disponibles dans le processus *renderer* via l'objet `window.config` (exposé par `src/preload.ts`) :

*   `await window.config.get()` : Lit la configuration actuelle.
*   `await window.config.set(cfg)` : Écrit une nouvelle configuration.

**Exemple d'usage (côté renderer) :**
```ts
const cfg = await window.config.get();
await window.config.set({ ...cfg, theme: "dark" });
```

### Addon natif XInput (détection globale Start+Select)

La détection globale des raccourcis manette (même lorsque la fenêtre est hors focus) s'appuie sur un addon N-API minimal situé dans `native/xinput`.

#### Prérequis pour la compilation (Windows)

1.  **Node.js v20 LTS** (voir le fichier `.nvmrc`).
2.  **Python 3.11+** (disponible dans le PATH).
3.  **Microsoft Build Tools 2022** (avec la charge de travail "Développement Desktop en C++" et le SDK Windows 10/11).
4.  Redémarrez votre terminal après ces installations.

Vous pouvez valider votre environnement avec :
```cmd
node -v
python --version
where MSBuild.exe
```

#### Compilation de l'addon

La commande suivante compile l'addon et copie le binaire (`.node`) dans le dossier `dist-native` pour qu'il soit accessible par l'application.

```cmd
npm run build:native
```

Pour tester rapidement que l'addon fonctionne, branchez une manette XInput et lancez :
```cmd
npm run test:xinput
```
Ce script attend pendant 10 secondes que vous pressiez le combo **Start + Back** (ou équivalent).

Le chargement de l'addon est géré dynamiquement par `src/services/xinput-native-addon.ts`.