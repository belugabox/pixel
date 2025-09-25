// Wrapper de chargement pour l'addon natif xinput_native.node
// Essaie différentes localisations (build/Release via node-gyp). Fournit une API minimale.

export type NativeWatcher = {
  start: () => void;
  stop: () => void;
  running: boolean;
};

let loaded: { Watcher: new (cb: () => void) => NativeWatcher } | null = null;
let loadError: unknown = null;

function tryRequire(path: string) {
  try {
    return require(path);
  } catch {
    return null;
  }
}

export function loadAddon() {
  if (loaded || loadError) return loaded;
  const candidates = [
    // node-gyp default output when run inside native/xinput
    "../../native/xinput/build/Release/xinput_native.node",
    // When packaged (may be auto-unpacked by forge plugin) - attempt relative to dist
    "./xinput_native.node",
  ];
  for (const c of candidates) {
    const mod = tryRequire(c);
    if (mod && mod.Watcher) {
      loaded = mod;
      return loaded;
    }
  }
  // Also try direct require if node resolves it somehow
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const direct = require("xinput_native");
    if (direct?.Watcher) {
      loaded = direct;
      return loaded;
    }
  } catch (e) {
    loadError = e;
  }
  return null;
}

export function createWatcher(callback: () => void): NativeWatcher | null {
  const mod = loadAddon();
  if (!mod) return null;
  try {
    return new mod.Watcher(callback);
  } catch (e) {
    loadError = e;
    return null;
  }
}

export function getLoadError() {
  return loadError;
}
