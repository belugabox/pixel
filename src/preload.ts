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

type System = {
  id: string;
  name: string;
  extensions: string[];
  emulator: string;
  core: string;
};

type Catalog = {
  emulators: Emulator[];
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
});

contextBridge.exposeInMainWorld("dialog", {
  selectDirectory: async (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:selectDirectory"),
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
});

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
