// Windows-only global Start+Select (Back) detection using the custom N-API addon.
// The historical ffi-napi fallback has been removed (addon is now required for global detection).

import os from "node:os";
import { createWatcher } from "./xinput-native-addon";

let started = false;
let activeNative = false; // indicates native addon loaded successfully
let stopFn: (() => void) | null = null;
export type ComboListener = () => void;
const listeners = new Set<ComboListener>();

// Lazy loaded ffi objects to avoid issues on non-Windows platforms or build steps.
export function onCombo(listener: ComboListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startGlobalComboWatcher() {
  if (started) return;
  if (os.platform() !== "win32") {
    console.warn("[xinput-global] Not Windows, skipping");
    return;
  }
  started = true;

  try {
    const watcher = createWatcher(() => {
      for (const l of listeners) {
        try {
          l();
        } catch {
          /* ignore */
        }
      }
    });
    if (!watcher) {
      console.warn(
        "[xinput-global] Addon natif indisponible. La détection globale est désactivée.",
      );
      activeNative = false;
      return;
    }
    watcher.start();
    activeNative = true;
    stopFn = () => {
      watcher.stop();
    };
  } catch (e) {
    console.warn(
      "[xinput-global] Échec du chargement de l'addon natif. Détection globale désactivée.",
      e,
    );
    activeNative = false;
  }
}

export function stopGlobalComboWatcher() {
  if (stopFn) stopFn();
  stopFn = null;
  started = false;
}

export function isGlobalWatcherActive() {
  return started && activeNative;
}
