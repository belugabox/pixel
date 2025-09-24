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
      const h3 = document.createElement('h3');
      h3.textContent = name;
      tile.appendChild(h3);
      systemsEl.appendChild(tile);
    }
  } catch (e) {
    console.error('Impossible de lister les systèmes', e);
  }
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
        } else {
          void loadSettingsForm();
          openSettingsModal();
        }
      }
    });

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
      if (isOpen) {
        closeSettingsModal();
      } else {
        void loadSettingsForm();
        openSettingsModal();
      }
    }
  });

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

console.log(
  '👋 This message is being logged by "renderer.ts", included via Vite',
);
