// Type definitions pour l'addon natif xinput_native
// Généré manuellement.

export interface NativeWatcher {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export interface WatcherConstructor {
  new (callback: () => void): NativeWatcher;
}

export const Watcher: WatcherConstructor;
