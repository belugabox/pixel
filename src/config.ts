import { promises as fs } from "node:fs";
import path from "node:path";
import defaultCfg from "./config.default.json";
import catalogDefault from "./catalog.default.json";

export interface Emulator {
  id: string;
  name: string;
  path: string;
  args?: string[];
  coresPath?: string;
}

export interface Tool {
  id: string;
  name: string;
  path: string;
  args?: string[];
}

export interface System {
  id: string;
  name: string;
  extensions: string[];
  emulator: string; // references Emulator.id
  core: string; // core identifier (ex: "fbneo_libretro")
  exclude?: string[]; // list of file names to ignore when scanning (case-insensitive)
  tool?: string; // optional tool id to run before launching the ROM
  scrapers?: {
    screenscraper?: { systemId?: string };
    igdb?: { platformId?: string };
  };
}

export interface UserConfig {
  romsRoot: string;
  emulatorsRoot: string;
  toolsRoot?: string;
  theme?: "retro" | "abstract";
  updatesBeta?: boolean; // opt-in to beta (pre-release) updates
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
}
export interface CatalogConfig {
  emulators: Emulator[];
  tools?: Tool[];
  systems: System[];
}

export const defaultConfig: UserConfig = defaultCfg as UserConfig;
export const defaultCatalog: CatalogConfig = catalogDefault as CatalogConfig;

export function getConfigPath(userDataPath: string) {
  return path.join(userDataPath, "config.json");
}

export async function ensureConfig(userDataPath: string): Promise<UserConfig> {
  const cfgPath = getConfigPath(userDataPath);
  try {
    const raw = await fs.readFile(cfgPath, "utf-8");
    try {
      const parsed = JSON.parse(raw) as Partial<UserConfig>;
      // Migration: strip obsolete IGDB token fields
      let mutated = false;
      if (parsed?.scrapers?.igdb) {
        const igdb = parsed.scrapers.igdb as Record<string, unknown>;
        if ("accessToken" in igdb) {
          delete igdb["accessToken"];
          mutated = true;
        }
        if ("accessTokenExpiresAt" in igdb) {
          delete igdb["accessTokenExpiresAt"];
          mutated = true;
        }
      }
      // Merge with defaults to ensure new fields are present
      const merged = {
        ...defaultConfig,
        ...parsed,
      } as UserConfig;
      if (mutated) {
        await saveConfig(userDataPath, merged);
      }
      return merged;
    } catch {
      // Backup invalid file then write defaults
      await fs.writeFile(cfgPath + ".bak", raw, "utf-8");
      await saveConfig(userDataPath, defaultConfig);
      return defaultConfig;
    }
  } catch (err: unknown) {
    if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      await saveConfig(userDataPath, defaultConfig);
      return defaultConfig;
    }
    // Unknown read error -> fall back to defaults without overwriting
    return defaultConfig;
  }
}

export async function saveConfig(
  userDataPath: string,
  cfg: UserConfig,
): Promise<void> {
  const cfgPath = getConfigPath(userDataPath);
  const dir = path.dirname(cfgPath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = cfgPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), "utf-8");
  await fs.rename(tmp, cfgPath);
}

export function getCatalog(): CatalogConfig {
  return defaultCatalog as CatalogConfig;
}
