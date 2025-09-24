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
    let title = document.getElementById('user-config-title');
    if (!title) {
      title = document.createElement('h2');
      title.id = 'user-config-title';
      title.textContent = 'Configuration utilisateur';
      app.appendChild(title);
    }

    // Affichage JSON (idempotent)
    let pre = document.getElementById('user-config') as HTMLPreElement | null;
    if (!pre) {
      pre = document.createElement('pre');
      pre.id = 'user-config';
      pre.style.whiteSpace = 'pre-wrap';
      app.appendChild(pre);
    }
    pre.textContent = JSON.stringify(cfg, null, 2);
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
      tile.tabIndex = 0;
      const h3 = document.createElement('h3');
      h3.textContent = name;
      tile.appendChild(h3);
      tile.addEventListener('click', () => openRomsScreen(name));
      tile.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openRomsScreen(name);
        } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          moveFocusHorizontal(tile, ev.key === 'ArrowRight');
        }
      });
      systemsEl.appendChild(tile);
    }
  } catch (e) {
    console.error('Impossible de lister les systèmes', e);
  }
}

async function renderRoms(systemFolder: string) {
  try {
    const romsEl = document.getElementById('roms');
    if (!romsEl) return;
    const files: string[] = await (window as any).roms?.listFiles?.(systemFolder)
      ?? await (window as any).electron?.invoke?.('roms:listFiles', systemFolder)
      ?? [];
    romsEl.innerHTML = '';
    const title = document.getElementById('roms-title');
    if (title) title.textContent = `ROMs - ${systemFolder} (${files.length})`;
    if (files.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Aucune ROM trouvée pour ce système.';
      romsEl.appendChild(empty);
    } else {
      for (const file of files) {
        const tile = document.createElement('div');
        tile.className = 'system-tile';
        tile.tabIndex = 0;
        const h3 = document.createElement('h3');
        h3.textContent = file;
        tile.appendChild(h3);
        tile.addEventListener('keydown', (ev: KeyboardEvent) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            // futur: lancer la ROM
          } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
            ev.preventDefault();
            moveFocusHorizontal(tile, ev.key === 'ArrowRight');
          }
        });
        romsEl.appendChild(tile);
      }
    }
  } catch (e) {
    console.error('Impossible de lister les ROMs', e);
  }
}

function openRomsScreen(systemFolder: string) {
  const sysScreen = document.getElementById('systems-screen');
  const romsScreen = document.getElementById('roms-screen');
  const title = document.getElementById('roms-title');
  if (sysScreen && romsScreen) {
    sysScreen.style.display = 'none';
    romsScreen.style.display = '';
  }
  if (title) title.textContent = `ROMs - ${systemFolder}`;
  void renderRoms(systemFolder);
}

function backToSystemsScreen() {
  const sysScreen = document.getElementById('systems-screen');
  const romsScreen = document.getElementById('roms-screen');
  if (sysScreen && romsScreen) {
    romsScreen.style.display = 'none';
    sysScreen.style.display = '';
  }
}

function moveFocusHorizontal(current: HTMLElement, forward: boolean) {
  const container = current.parentElement;
  if (!container) return;
  const tiles = Array.from(container.querySelectorAll<HTMLElement>('.system-tile'));
  const idx = tiles.indexOf(current);
  if (idx === -1) return;
  const nextIdx = forward ? Math.min(idx + 1, tiles.length - 1) : Math.max(idx - 1, 0);
  if (nextIdx !== idx) tiles[nextIdx].focus();
}

// ------------ Paramètres (modal) ------------
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

async function loadSettingsForm() {
  const cfg = await (window as any).config.get();
  (document.getElementById('roms-root') as HTMLInputElement | null)!.value = cfg.romsRoot ?? '';
  (document.getElementById('emulators-root') as HTMLInputElement | null)!.value = cfg.emulatorsRoot ?? '';
  (document.getElementById('tools-root') as HTMLInputElement | null)!.value = cfg.toolsRoot ?? '';
}

async function saveSettingsForm(ev: SubmitEvent) {
  ev.preventDefault();
  const romsRoot = (document.getElementById('roms-root') as HTMLInputElement | null)!.value;
  const emulatorsRoot = (document.getElementById('emulators-root') as HTMLInputElement | null)!.value;
  const toolsRoot = (document.getElementById('tools-root') as HTMLInputElement | null)!.value || undefined;

  const newCfg = { romsRoot, emulatorsRoot, toolsRoot };
  try {
    await (window as any).config.set(newCfg);
    await renderUserConfig();
    await renderSystems();
    closeSettingsModal();
  } catch (e) {
    console.error('Erreur lors de l\'enregistrement de la configuration', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hidePreloader();
    void renderUserConfig();
    void renderSystems();

    // Wiring settings UI
    const btn = document.getElementById('settings-btn');
    btn?.addEventListener('click', async () => {
      await loadSettingsForm();
      openSettingsModal();
    });

    const form = document.getElementById('settings-form');
    form?.addEventListener('submit', saveSettingsForm as any);

    const cancel = document.getElementById('settings-cancel');
    cancel?.addEventListener('click', () => closeSettingsModal());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('settings-modal');
        const isOpen = modal && modal.style.display !== 'none';
        if (isOpen) {
          closeSettingsModal();
          return;
        }
        const romsScreen = document.getElementById('roms-screen');
        const romsVisible = romsScreen && romsScreen.style.display !== 'none';
        if (romsVisible) {
          backToSystemsScreen();
          return;
        }
        void loadSettingsForm();
        openSettingsModal();
      }
    });

    // Bouton retour
    document.getElementById('back-btn')?.addEventListener('click', () => backToSystemsScreen());

    // Parcourir… handlers
    document.getElementById('browse-roms')?.addEventListener('click', async () => {
      const dir = await (window as any).dialog?.selectDirectory?.();
      if (dir) {
        const input = document.getElementById('roms-root') as HTMLInputElement | null;
        if (input) { input.value = dir; input.focus(); }
      }
    });
    document.getElementById('browse-emulators')?.addEventListener('click', async () => {
      const dir = await (window as any).dialog?.selectDirectory?.();
      if (dir) {
        const input = document.getElementById('emulators-root') as HTMLInputElement | null;
        if (input) { input.value = dir; input.focus(); }
      }
    });
    document.getElementById('browse-tools')?.addEventListener('click', async () => {
      const dir = await (window as any).dialog?.selectDirectory?.();
      if (dir) {
        const input = document.getElementById('tools-root') as HTMLInputElement | null;
        if (input) { input.value = dir; input.focus(); }
      }
    });
  });
} else {
  hidePreloader();
  void renderUserConfig();
  void renderSystems();

  // Wiring settings UI (in case readyState is already complete)
  const btn = document.getElementById('settings-btn');
  btn?.addEventListener('click', async () => {
    await loadSettingsForm();
    openSettingsModal();
  });

  const form = document.getElementById('settings-form');
  form?.addEventListener('submit', saveSettingsForm as any);

  const cancel = document.getElementById('settings-cancel');
  cancel?.addEventListener('click', () => closeSettingsModal());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('settings-modal');
      const isOpen = modal && modal.style.display !== 'none';
      if (isOpen) { closeSettingsModal(); return; }
      const romsScreen = document.getElementById('roms-screen');
      const romsVisible = romsScreen && romsScreen.style.display !== 'none';
      if (romsVisible) { backToSystemsScreen(); return; }
      void loadSettingsForm();
      openSettingsModal();
    }
  });

  // Bouton retour
  document.getElementById('back-btn')?.addEventListener('click', () => backToSystemsScreen());

  // Parcourir… handlers (fallback if DOM already loaded)
  document.getElementById('browse-roms')?.addEventListener('click', async () => {
    const dir = await (window as any).dialog?.selectDirectory?.();
    if (dir) {
      const input = document.getElementById('roms-root') as HTMLInputElement | null;
      if (input) { input.value = dir; input.focus(); }
    }
  });
  document.getElementById('browse-emulators')?.addEventListener('click', async () => {
    const dir = await (window as any).dialog?.selectDirectory?.();
    if (dir) {
      const input = document.getElementById('emulators-root') as HTMLInputElement | null;
      if (input) { input.value = dir; input.focus(); }
    }
  });
  document.getElementById('browse-tools')?.addEventListener('click', async () => {
    const dir = await (window as any).dialog?.selectDirectory?.();
    if (dir) {
      const input = document.getElementById('tools-root') as HTMLInputElement | null;
      if (input) { input.value = dir; input.focus(); }
    }
  });
}
