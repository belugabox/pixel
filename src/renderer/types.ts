export type UserConfig = {
  romsRoot: string;
  emulatorsRoot: string;
  toolsRoot?: string;
  theme?: "retro" | "abstract";
  updatesBeta?: boolean;
  scrapers?: {
    default?: "igdb" | "screenscraper";
    screenscraper?: {
      ssid?: string;
      sspassword?: string;
      devid?: string;
      devpassword?: string;
      softname?: string;
    };
    igdb?: {
      clientId?: string;
      clientSecret?: string;
    };
  };
};

export type View = { name: "systems" } | { name: "roms"; system: string };

export type GameMetadata = {
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

export type RomResultItem = {
  fileName: string;
  status: "created" | "skipped" | "failed";
  metadata?: GameMetadata | null;
};

export type SystemDownloadResult = {
  systemId: string;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  items: RomResultItem[];
};

export type AllDownloadResult = {
  totals: { processed: number; created: number; skipped: number; failed: number };
  systems: SystemDownloadResult[];
};

export type Catalog = {
  emulators: Array<{
    id: string;
    name: string;
    path: string;
    args?: string[];
    coresPath?: string;
  }>;
  tools?: Array<{
    id: string;
    name: string;
    path: string;
    args?: string[];
  }>;
  systems: Array<{
    id: string;
    name: string;
    extensions: string[];
    emulator: string;
    core: string;
    exclude?: string[];
    tool?: string;
  }>;
};

// Window API types
declare global {
  interface Window {
    config: {
      get(): Promise<UserConfig>;
      set(cfg: UserConfig): Promise<UserConfig>;
    };
    catalog: {
      get(): Promise<Catalog>;
    };
    roms: {
      list(): Promise<string[]>;
      listFiles(systemFolder: string): Promise<string[]>;
      launch(
        systemId: string,
        romFileName: string,
      ): Promise<{ ok: true } | { ok: false; error: string }>;
      killActive(): Promise<{ ok: boolean; error?: string }>;
      onEmulatorTerminated(handler: () => void): () => void;
    };
    dialog: {
      selectDirectory(): Promise<string | null>;
    };
    metadata: {
      get(romFileName: string, systemId: string): Promise<GameMetadata | null>;
      download(
        romFileName: string,
        systemId: string,
      ): Promise<GameMetadata | null>;
      has(romFileName: string, systemId: string): Promise<boolean>;
      downloadSystem(systemId: string): Promise<SystemDownloadResult | null>;
      downloadAll(opts?: { force?: boolean }): Promise<AllDownloadResult>;
      onProgress(
        handler: (payload: {
          systemId: string;
          current: number;
          total: number;
          fileName: string;
        }) => void,
      ): () => void;
    };
    image: {
      load(absPath: string): Promise<string | null>;
    };
    favorites: {
      list(): Promise<Array<{ systemId: string; fileName: string }>>;
      is(systemId: string, fileName: string): Promise<boolean>;
      toggle(
        systemId: string,
        fileName: string,
      ): Promise<{ ok: true; favored: boolean }>;
      onChanged(handler: () => void): () => void;
    };
    app: {
      quit(): Promise<void>;
      version(): Promise<string>;
    };
    gamepad: {
      onGlobalCombo(handler: () => void): () => void;
      isGlobalActive(): Promise<boolean>;
    };
    updates: {
      check(opts?: {
        beta?: boolean;
      }): Promise<
        | { ok: true; update: null }
        | { ok: true; update: { version: string; notes: string; url: string } }
        | { ok: false; error: string }
      >;
      download(): Promise<{ ok: boolean; error?: string }>;
      install(): Promise<{ ok: boolean; error?: string }>;
      onAvailable(handler: (info: unknown) => void): () => void;
      onNotAvailable(handler: (info: unknown) => void): () => void;
      onProgress(handler: (p: unknown) => void): () => void;
      onDownloaded(handler: (info: unknown) => void): () => void;
      onError(handler: (msg: string) => void): () => void;
    };
  }
}
