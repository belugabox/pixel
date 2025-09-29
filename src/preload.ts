import { contextBridge, ipcRenderer } from "electron";

type UserConfig = {
  romsRoot: string;
  emulatorsRoot: string;
  toolsRoot?: string;
  updatesBeta?: boolean;
  scrapers?: {
    screenscraper?: {
      ssid?: string;
      sspassword?: string;
    };
  };
};

type Emulator = {
  id: string;
  name: string;
  path: string;
  args?: string[];
  coresPath?: string;
};

type Tool = {
  id: string;
  name: string;
  path: string;
  args?: string[];
};

type System = {
  id: string;
  name: string;
  extensions: string[];
  emulator: string;
  core: string;
  exclude?: string[];
  tool?: string;
};

type Catalog = {
  emulators: Emulator[];
  tools?: Tool[];
  systems: System[];
};

type GameMetadata = {
  id: string;
  name: string;
  description?: string;
  releaseDate?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
  players?: string;
  rating?: string;
  images: {
    cover?: string;
    screenshot?: string;
    title?: string;
  };
};

type RomResultItem = {
  fileName: string;
  status: "created" | "skipped" | "failed";
  metadata?: GameMetadata | null;
};
type SystemDownloadResult = {
  systemId: string;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  items: RomResultItem[];
};
type AllDownloadResult = {
  totals: { processed: number; created: number; skipped: number; failed: number };
  systems: SystemDownloadResult[];
};

contextBridge.exposeInMainWorld("config", {
  get: async (): Promise<UserConfig> => ipcRenderer.invoke("config:get"),
  set: async (cfg: UserConfig): Promise<UserConfig> =>
    ipcRenderer.invoke("config:set", cfg),
});

contextBridge.exposeInMainWorld("catalog", {
  get: async (): Promise<Catalog> => ipcRenderer.invoke("catalog:get"),
});

contextBridge.exposeInMainWorld("roms", {
  list: async (): Promise<string[]> => ipcRenderer.invoke("roms:list"),
  listFiles: async (systemFolder: string): Promise<string[]> =>
    ipcRenderer.invoke("roms:listFiles", systemFolder),
  launch: async (
    systemId: string,
    romFileName: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke("roms:launch", systemId, romFileName),
  killActive: async (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("roms:killActive"),
  onEmulatorTerminated: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on("emulator:terminated", listener);
    return () => ipcRenderer.removeListener("emulator:terminated", listener);
  },
});

contextBridge.exposeInMainWorld("gamepad", {
  onGlobalCombo: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on("gamepad:combo", listener);
    return () => ipcRenderer.removeListener("gamepad:combo", listener);
  },
  isGlobalActive: async (): Promise<boolean> =>
    ipcRenderer.invoke("gamepad:isGlobalActive"),
});

contextBridge.exposeInMainWorld("dialog", {
  selectDirectory: async (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectDirectory"),
});

contextBridge.exposeInMainWorld("app", {
  quit: async (): Promise<void> => ipcRenderer.invoke("app:quit"),
  version: async (): Promise<string> => ipcRenderer.invoke("app:version"),
});

contextBridge.exposeInMainWorld("logs", {
  get: async (limit?: number): Promise<Array<{ ts: number; level: 'log' | 'warn' | 'error'; args: unknown[] }>> =>
    ipcRenderer.invoke('logs:get', { limit }),
  clear: async (): Promise<{ ok: true }> => ipcRenderer.invoke('logs:clear'),
  onAppend: (handler: (entry: { ts: number; level: 'log' | 'warn' | 'error'; args: unknown[] }) => void): (() => void) => {
    const listener = (_: unknown, entry: { ts: number; level: 'log' | 'warn' | 'error'; args: unknown[] }) => handler(entry);
    ipcRenderer.on('logs:append', listener);
    return () => ipcRenderer.removeListener('logs:append', listener);
  }
});

contextBridge.exposeInMainWorld("updates", {
  check: async (opts?: { beta?: boolean }) =>
    ipcRenderer.invoke("updates:check", opts) as Promise<
      | { ok: true; update: null }
      | { ok: true; update: { version: string; notes: string; url: string } }
      | { ok: false; error: string }
    >,
  download: async () =>
    ipcRenderer.invoke("updates:download") as Promise<{
      ok: boolean;
      error?: string;
    }>,
  install: async () =>
    ipcRenderer.invoke("updates:install") as Promise<{
      ok: boolean;
      error?: string;
    }>,
  onAvailable: (handler: (info: unknown) => void) => {
    const listener = (_: unknown, info: unknown) => handler(info);
    ipcRenderer.on("updates:auto:available", listener);
    return () => ipcRenderer.removeListener("updates:auto:available", listener);
  },
  onNotAvailable: (handler: (info: unknown) => void) => {
    const listener = (_: unknown, info: unknown) => handler(info);
    ipcRenderer.on("updates:auto:not-available", listener);
    return () =>
      ipcRenderer.removeListener("updates:auto:not-available", listener);
  },
  onProgress: (handler: (p: unknown) => void) => {
    const listener = (_: unknown, p: unknown) => handler(p);
    ipcRenderer.on("updates:auto:progress", listener);
    return () => ipcRenderer.removeListener("updates:auto:progress", listener);
  },
  onDownloaded: (handler: (info: unknown) => void) => {
    const listener = (_: unknown, info: unknown) => handler(info);
    ipcRenderer.on("updates:auto:downloaded", listener);
    return () =>
      ipcRenderer.removeListener("updates:auto:downloaded", listener);
  },
  onError: (handler: (msg: string) => void) => {
    const listener = (_: unknown, msg: string) => handler(msg);
    ipcRenderer.on("updates:auto:error", listener);
    return () => ipcRenderer.removeListener("updates:auto:error", listener);
  },
});

contextBridge.exposeInMainWorld("metadata", {
  get: async (
    romFileName: string,
    systemId: string,
  ): Promise<GameMetadata | null> =>
    ipcRenderer.invoke("metadata:get", romFileName, systemId),
  download: async (
    romFileName: string,
    systemId: string,
  ): Promise<GameMetadata | null> =>
    ipcRenderer.invoke("metadata:download", romFileName, systemId),
  has: async (romFileName: string, systemId: string): Promise<boolean> =>
    ipcRenderer.invoke("metadata:has", romFileName, systemId),
  downloadSystem: async (systemId: string): Promise<SystemDownloadResult | null> =>
    ipcRenderer.invoke("metadata:downloadSystem", systemId) as Promise<SystemDownloadResult | null>,
  downloadAll: async (opts?: { force?: boolean }): Promise<AllDownloadResult> =>
    ipcRenderer.invoke("metadata:downloadAll", opts) as Promise<AllDownloadResult>,
  onProgress: (
    handler: (payload: {
      systemId: string;
      current: number;
      total: number;
      fileName: string;
    }) => void,
  ): (() => void) => {
    const listener = (
      _evt: unknown,
      payload: {
        systemId: string;
        current: number;
        total: number;
        fileName: string;
      },
    ) => handler(payload);
    ipcRenderer.on("metadata:progress", listener);
    return () => ipcRenderer.removeListener("metadata:progress", listener);
  },
});

contextBridge.exposeInMainWorld("image", {
  load: async (absPath: string): Promise<string | null> =>
    ipcRenderer.invoke("image:load", absPath),
});

contextBridge.exposeInMainWorld("favorites", {
  list: async (): Promise<Array<{ systemId: string; fileName: string }>> =>
    ipcRenderer.invoke("favorites:list"),
  is: async (systemId: string, fileName: string): Promise<boolean> =>
    ipcRenderer.invoke("favorites:is", systemId, fileName),
  toggle: async (
    systemId: string,
    fileName: string,
  ): Promise<{ ok: true; favored: boolean }> =>
    ipcRenderer.invoke("favorites:toggle", systemId, fileName),
  onChanged: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on("favorites:changed", listener);
    return () => ipcRenderer.removeListener("favorites:changed", listener);
  },
});

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
