// Wrapper de chargement pour l'addon natif xinput_native.node
// Version étendue: essaie un ensemble élargi de chemins (dev, build, package) et fournit
// un diagnostic clair si le binaire est manquant avec la commande à exécuter.

import path from "node:path";
import fs from "node:fs";

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
    console.log(
      `[xinput-native] Failed to require "${path}":`,
      e.message || String(e),
    );
    return null;
  }
}

export function loadAddon() {
  if (loaded || loadError) return loaded;
  console.log("[xinput-native] Attempting to load XInput native addon...");

  function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
  }

  let appPath: string | undefined;
  let resourcesPath: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require("electron") as typeof import("electron");
    if (app?.getAppPath) appPath = app.getAppPath();
    const proc = process as NodeJS.Process & {
      resourcesPath?: unknown;
    };
    if (typeof proc.resourcesPath === "string") {
      resourcesPath = proc.resourcesPath;
    }
  } catch {
    // Pas en contexte Electron (tests script) – ignorer
  }

  const cwd = process.cwd();
  const absCandidates: string[] = [];
  // Dev copy target
  absCandidates.push(path.join(cwd, "dist-native", "xinput_native.node"));
  // node-gyp direct output si copy pas encore fait
  absCandidates.push(
    path.join(
      cwd,
      "native",
      "xinput",
      "build",
      "Release",
      "xinput_native.node",
    ),
  );
  // Packaged app (app.asar.unpacked scenario)
  if (appPath) {
    absCandidates.push(path.join(appPath, "dist-native", "xinput_native.node"));
  }
  if (resourcesPath) {
    absCandidates.push(
      path.join(resourcesPath, "app", "dist-native", "xinput_native.node"),
    );
    absCandidates.push(
      path.join(resourcesPath, "dist-native", "xinput_native.node"),
    );
  }

  const legacyRel = [
    "../../native/xinput/build/Release/xinput_native.node",
    "./xinput_native.node",
    "./dist-native/xinput_native.node",
  ];

  const candidates = uniq([...absCandidates, ...legacyRel]);
  const tried: string[] = [];
  for (const c of candidates) {
    tried.push(c);
    const mod = tryRequire(c);
    if (mod && mod.Watcher) {
      console.log(`[xinput-native] Successfully loaded addon from: ${c}`);
      loaded = mod;
      return loaded;
    } else if (fs.existsSync(c)) {
      console.log(`[xinput-native] File exists but invalid module shape: ${c}`);
    }
  }

  // Direct require fallback (NODE_PATH / global install)
  try {
    console.log("[xinput-native] Trying direct require('xinput_native')...");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const direct = require("xinput_native");
    if (direct?.Watcher) {
      console.log("[xinput-native] Successfully loaded addon via module name");
      loaded = direct;
      return loaded;
    }
  } catch (e) {
    console.warn("[xinput-native] Direct require failed:", e?.message || e);
    loadError = e;
  }

  console.warn(
    "[xinput-native] Échec chargement addon. Chemins testés:\n" +
      tried.map((p) => `  - ${p}`).join("\n") +
      "\nConstruire le binaire avec: npm run build:native",
  );
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
