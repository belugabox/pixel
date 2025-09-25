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
    console.log(`[xinput-native] Attempting require("${path}")`);
    return require(path);
  } catch (e) {
    console.log(`[xinput-native] Failed to require "${path}":`, e.message || String(e));
    return null;
  }
}

export function loadAddon() {
  if (loaded || loadError) return loaded;
  console.log("[xinput-native] Attempting to load XInput native addon...");
  const candidates = [
    // node-gyp default output when run inside native/xinput
    "../../native/xinput/build/Release/xinput_native.node",
    // When packaged (may be auto-unpacked by forge plugin) - attempt relative to dist
    "./xinput_native.node",
    // Also try the dist-native folder
    "./dist-native/xinput_native.node",
  ];
  for (const c of candidates) {
    console.log(`[xinput-native] Trying to load from: ${c}`);
    const mod = tryRequire(c);
    if (mod && mod.Watcher) {
      console.log(`[xinput-native] Successfully loaded addon from: ${c}`);
      loaded = mod;
      return loaded;
    }
  }
  // Also try direct require if node resolves it somehow
  try {
    console.log("[xinput-native] Trying direct require...");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const direct = require("xinput_native");
    if (direct?.Watcher) {
      console.log("[xinput-native] Successfully loaded addon via direct require");
      loaded = direct;
      return loaded;
    }
  } catch (e) {
    console.warn("[xinput-native] Direct require failed:", e);
    loadError = e;
  }
  console.warn("[xinput-native] Failed to load XInput native addon from all candidate paths");
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
