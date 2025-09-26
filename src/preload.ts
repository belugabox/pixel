import { contextBridge, ipcRenderer } from "electron";

type UserConfig = {
  romsRoot: string;
  emulatorsRoot: string;
  toolsRoot?: string;
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
  downloadSystem: async (systemId: string): Promise<void> =>
    ipcRenderer.invoke("metadata:downloadSystem", systemId),
  downloadAll: async (opts?: { force?: boolean }): Promise<void> =>
    ipcRenderer.invoke("metadata:downloadAll", opts),
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
