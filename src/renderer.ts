/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

function hidePreloader() {
  const pre = document.getElementById('preloader');
  const app = document.getElementById('app');
  if (pre) pre.style.display = 'none';
  if (app) app.style.display = '';
}

async function renderUserConfig() {
  try {
    // Accès via l'API exposée par preload
    const cfg = await (window as any).config.get();
    const app = document.getElementById('app');
    if (!app) return;

    // Titre
    const h2 = document.createElement('h2');
    h2.textContent = 'Configuration utilisateur';
    app.appendChild(h2);

    // Affichage JSON
    const pre = document.createElement('pre');
    pre.id = 'user-config';
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = JSON.stringify(cfg, null, 2);
    app.appendChild(pre);
  } catch (e) {
    console.error('Impossible de charger la configuration', e);
  }
}

async function renderSystems() {
  try {
    const systemsEl = document.getElementById('systems');
    if (!systemsEl) return;
    const folders: string[] = await (window as any).electron?.invoke?.('roms:list')
      ?? await (window as any).roms?.list?.()
      ?? await (window as any).config?.get().then(async (cfg: any) => {
        // fallback if no IPC wrapper: ask main via a known channel
        return await (window as any).electron?.invoke?.('roms:list') ?? [];
      });

    systemsEl.innerHTML = '';
    for (const name of folders) {
      const tile = document.createElement('div');
      tile.className = 'system-tile';
      const h3 = document.createElement('h3');
      h3.textContent = name;
      tile.appendChild(h3);
      systemsEl.appendChild(tile);
    }
  } catch (e) {
    console.error('Impossible de lister les systèmes', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hidePreloader();
    void renderUserConfig();
    void renderSystems();
  });
} else {
  hidePreloader();
  void renderUserConfig();
  void renderSystems();
}

console.log(
  '👋 This message is being logged by "renderer.ts", included via Vite',
);
