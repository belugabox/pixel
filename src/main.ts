import electron = require("electron");
const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = electron;

import { spawn } from "node:child_process";
import { MetadataService } from "./services/metadata-service";
import { promises as fs } from "node:fs";
import path from "node:path";
import started from "electron-squirrel-startup";
import {
  startGlobalComboWatcher,
  onCombo as onXInputCombo,
  isGlobalWatcherActive,
} from "./services/xinput-global";
import {
  ensureConfig,
  saveConfig,
  type UserConfig,
  getCatalog,
} from "./config";
import type { AppUpdater } from "electron-updater";
import { filterRoms } from "./utils/exclude";
import type {
  AllDownloadResult,
  SystemDownloadResult,
} from "./services/scrapers/types";

// Minimal event type (opaque) for IPC invoke handlers
interface IPCEventLike {
  sender: { send: (channel: string, ...args: unknown[]) => void };
}

// Global emulator reference for XInput combo handling
let currentEmulator: import("node:child_process").ChildProcess | null = null;

// Auto-update (electron-updater): load lazily to avoid crashing if missing in packaged app
let autoUpdater: AppUpdater | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// --- In-memory logs buffer & console hijack ---
type LogEntry = {
  ts: number;
  level: "log" | "warn" | "error";
  args: unknown[];
};
const LOG_MAX = 2000;
const logsBuffer: LogEntry[] = [];
const pushLog = (level: LogEntry["level"], args: unknown[]) => {
  logsBuffer.push({ ts: Date.now(), level, args });
  if (logsBuffer.length > LOG_MAX)
    logsBuffer.splice(0, logsBuffer.length - LOG_MAX);
  try {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send("logs:append", { ts: Date.now(), level, args });
  } catch {
    /* ignore */
  }
};
const rawConsole = { ...console };
console.log = (...args: unknown[]) => {
  rawConsole.log(...args);
  pushLog("log", args);
};
console.warn = (...args: unknown[]) => {
  rawConsole.warn(...args);
  pushLog("warn", args);
};
console.error = (...args: unknown[]) => {
  rawConsole.error(...args);
  pushLog("error", args);
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    kiosk: true,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on("ready", () => {
  createWindow();
  try {
    startGlobalComboWatcher();
  } catch (e) {
    console.warn("[xinput] Failed to initialize global combo watcher:", e);
  }
  onXInputCombo(() => {
    try {
      if (currentEmulator && !currentEmulator.killed) {
        try {
          currentEmulator.kill();
        } catch (e) {
          console.warn("Kill failed (xinput combo):", e);
        }
        console.log("[xinput] Emulator terminated via Start+Select");
        currentEmulator = null;
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send("emulator:terminated");
        win?.webContents.send("gamepad:combo");
      } else {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send("gamepad:combo");
      }
    } catch (e) {
      console.warn("[xinput] combo handling error", e);
    }
  });
});

app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  await ensureConfig(userData);

  // Configure autoUpdater feed (GitHub provider is default for electron-updater)
  try {
    // Lazy require to avoid crashing if module missing
    const upd = require("electron-updater");
    autoUpdater = upd?.autoUpdater ?? null;
    if (autoUpdater) {
      autoUpdater.autoDownload = false; // manual download when user confirms
      autoUpdater.allowPrerelease = false; // set from config via IPC before checks
      const win = BrowserWindow.getAllWindows()[0];
      autoUpdater.on("update-available", (info: unknown) =>
        win?.webContents.send("updates:auto:available", info),
      );
      autoUpdater.on("update-not-available", (info: unknown) =>
        win?.webContents.send("updates:auto:not-available", info),
      );
      autoUpdater.on("error", (err: unknown) =>
        win?.webContents.send("updates:auto:error", String(err)),
      );
      autoUpdater.on("download-progress", (p: unknown) =>
        win?.webContents.send("updates:auto:progress", p),
      );
      autoUpdater.on("update-downloaded", (info: unknown) =>
        win?.webContents.send("updates:auto:downloaded", info),
      );
    } else {
      console.warn(
        "[updates] electron-updater non disponible (require a renvoyé null)",
      );
    }
  } catch (e) {
    console.warn(
      "[updates] electron-updater introuvable. Les mises à jour seront désactivées.",
      e,
    );
  }

  ipcMain.handle("config:get", async () => {
    return ensureConfig(userData);
  });

  ipcMain.handle("config:set", async (_evt: IPCEventLike, cfg: UserConfig) => {
    await saveConfig(userData, cfg);
    return cfg;
  });

  ipcMain.handle("catalog:get", async () => {
    return getCatalog();
  });

  ipcMain.handle("app:quit", async () => {
    app.quit();
  });

  ipcMain.handle("app:version", async () => {
    return app.getVersion();
  });

  // Logs IPC
  ipcMain.handle(
    "logs:get",
    async (_: IPCEventLike, opts?: { limit?: number }) => {
      const limit = Math.max(0, Math.min(10000, opts?.limit ?? 1000));
      const slice = logsBuffer.slice(-limit);
      return slice;
    },
  );
  ipcMain.handle("logs:clear", async () => {
    logsBuffer.splice(0, logsBuffer.length);
    return { ok: true } as const;
  });

  // Auto-update via electron-updater
  ipcMain.handle(
    "updates:check",
    async (_evt: IPCEventLike, opts?: { beta?: boolean }) => {
      try {
        if (!autoUpdater)
          return { ok: false, error: "Mises à jour non disponibles" } as const;
        autoUpdater.allowPrerelease = !!opts?.beta;
        const result = await autoUpdater.checkForUpdates();
        const info = result?.updateInfo as unknown;
        const extract = (
          i: unknown,
        ): { version?: string; notes?: string; url?: string } => {
          if (!i || typeof i !== "object") return {};
          const rec = i as Record<string, unknown>;
          const version =
            typeof rec.version === "string"
              ? rec.version
              : String(rec.version ?? "");
          let notes = "";
          const rn = rec.releaseNotes as unknown;
          if (typeof rn === "string") notes = rn;
          else if (rn && typeof rn === "object") notes = JSON.stringify(rn);
          let url = "";
          const files = rec.files as unknown;
          if (Array.isArray(files) && files.length > 0) {
            const f = files[0] as Record<string, unknown>;
            if (typeof f?.url === "string") url = f.url as string;
          }
          return { version, notes, url };
        };
        const infoLite = extract(info);
        if (infoLite.version && infoLite.version !== app.getVersion()) {
          return {
            ok: true,
            update: {
              version: infoLite.version,
              notes: infoLite.notes || "",
              url: infoLite.url || "",
            },
          } as const;
        }
        return { ok: true, update: null } as const;
      } catch (e) {
        console.error("autoUpdater check failed", e);
        return { ok: false, error: "Échec de la vérification" } as const;
      }
    },
  );

  ipcMain.handle("updates:download", async () => {
    try {
      if (!autoUpdater)
        return { ok: false, error: "Mises à jour non disponibles" } as const;
      await autoUpdater.downloadUpdate();
      return { ok: true } as const;
    } catch (e) {
      console.error("autoUpdater download failed", e);
      return { ok: false, error: "Échec du téléchargement" } as const;
    }
  });

  ipcMain.handle("updates:install", async () => {
    try {
      if (!autoUpdater)
        return { ok: false, error: "Mises à jour non disponibles" } as const;
      autoUpdater.quitAndInstall();
      return { ok: true } as const;
    } catch (e) {
      console.error("autoUpdater install failed", e);
      return { ok: false, error: "Échec de l'installation" } as const;
    }
  });

  ipcMain.handle("gamepad:isGlobalActive", async () => {
    return isGlobalWatcherActive();
  });

  ipcMain.handle("roms:list", async () => {
    try {
      const cfg = await ensureConfig(userData);
      const root = cfg.romsRoot;
      if (!root) return [];
      const entries = await fs.readdir(root, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    "roms:listFiles",
    async (_evt: IPCEventLike, systemFolder: string) => {
      try {
        const cfg = await ensureConfig(userData);
        const root = cfg.romsRoot;
        if (!root) return [];
        const dir = path.join(root, systemFolder);
        const entries = await fs.readdir(dir, { withFileTypes: true });

        const catalog = getCatalog();
        const sys = catalog.systems.find(
          (s) => s.id.toLowerCase() === String(systemFolder).toLowerCase(),
        );
        const allowed = sys?.extensions?.map((e) => e.toLowerCase()) ?? null;
        const exclude = sys?.exclude ?? [];

        const files = entries.filter((e) => e.isFile()).map((e) => e.name);
        const { kept, excluded } = filterRoms(files, {
          extensions: allowed,
          exclude,
        });
        if (excluded.length > 0) {
          console.log(
            `[roms:listFiles] Exclude applied for system '${systemFolder}': ${excluded.length} file(s) hidden ->`,
            excluded.slice(0, 10),
          );
        }
        return kept.sort();
      } catch {
        return [];
      }
    },
  );

  ipcMain.handle(
    "roms:launch",
    async (
      _evt: IPCEventLike,
      systemId: string,
      romFileName: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        const cfg = await ensureConfig(userData);
        const catalog = getCatalog();

        if (!cfg.romsRoot)
          return { ok: false, error: "romsRoot non configuré" };
        const sys = catalog.systems.find(
          (s) => s.id.toLowerCase() === String(systemId).toLowerCase(),
        );
        if (!sys) return { ok: false, error: `Système inconnu: ${systemId}` };
        const emu = catalog.emulators.find((e) => e.id === sys.emulator);
        if (!emu || !emu.path)
          return { ok: false, error: `Émulateur introuvable pour ${systemId}` };

        const romPath = path.join(cfg.romsRoot, systemId, romFileName);
        const romName = path.parse(romFileName).name;
        const romNameLower = romName.toLowerCase();
        const coreName = sys.core;
        const emuRoot = path.join(cfg.emulatorsRoot || "", emu.id);

        // Optionally start a pre-launch tool defined on the system
        try {
          const toolId: string | undefined = (sys as { tool?: string }).tool;
          const catalogTools = catalog.tools || [];
          if (toolId) {
            const tool = catalogTools.find((t) => t.id === toolId);
            if (tool && tool.path) {
              let toolExe = tool.path;
              const toolsRoot = cfg.toolsRoot || "";
              const toolRoot = path.join(toolsRoot, tool.id);
              if (!path.isAbsolute(toolExe)) {
                const primaryTool = path.join(toolRoot, toolExe);
                const fallbackTool = path.join(toolsRoot, toolExe);
                try {
                  await fs.access(primaryTool);
                  toolExe = primaryTool;
                } catch {
                  try {
                    await fs.access(fallbackTool);
                    toolExe = fallbackTool;
                  } catch {
                    toolExe = primaryTool; // for error message/log
                  }
                }
              }
              const toolArgs = (tool.args || []).map((a) =>
                a
                  .replace("{rom}", romPath)
                  .replace("{romName}", romName)
                  .replace("{romNameLower}", romNameLower)
                  .replace("{system}", systemId),
              );
              try {
                await fs.access(toolExe);
                console.log(
                  "[tool:launch]",
                  toolExe,
                  toolArgs
                    .map((a) => (a.includes(" ") ? `"${a}"` : a))
                    .join(" "),
                  "(cwd:",
                  path.dirname(toolExe) + ")",
                );
                const toolProc = spawn(toolExe, toolArgs, {
                  cwd: path.dirname(toolExe),
                  detached: true,
                  stdio: "ignore",
                });
                toolProc.unref();
              } catch (e) {
                console.warn(
                  "[tool] Échec du lancement du tool",
                  toolId,
                  "->",
                  toolExe,
                  e,
                );
              }
            } else {
              console.warn("[tool] Tool introuvable dans le catalog:", toolId);
            }
          }
        } catch (e) {
          console.warn("[tool] Erreur de configuration tool:", e);
        }

        // Resolve core path with fallback
        let corePath: string | undefined;
        if (emu.coresPath && coreName) {
          const primaryCore = path.join(
            emuRoot,
            emu.coresPath,
            `${coreName}.dll`,
          );
          const fallbackCore = path.join(
            cfg.emulatorsRoot || "",
            emu.coresPath,
            `${coreName}.dll`,
          );
          try {
            await fs.access(primaryCore);
            corePath = primaryCore;
          } catch {
            try {
              await fs.access(fallbackCore);
              corePath = fallbackCore;
            } catch {
              corePath = undefined;
            }
          }
        }

        const builtArgs = (emu.args || []).map((a) =>
          a
            .replace("{rom}", romPath)
            .replace("{romName}", romName)
            .replace("{romNameLower}", romNameLower)
            .replace("{core}", corePath || coreName || ""),
        );

        let exePath = emu.path;
        if (!path.isAbsolute(exePath)) {
          const primaryExe = path.join(emuRoot, exePath);
          const fallbackExe = path.join(cfg.emulatorsRoot || "", exePath);
          try {
            await fs.access(primaryExe);
            exePath = primaryExe;
          } catch {
            try {
              await fs.access(fallbackExe);
              exePath = fallbackExe;
            } catch {
              exePath = primaryExe;
            }
          }
        }

        try {
          await fs.access(romPath);
        } catch {
          return { ok: false, error: `ROM introuvable: ${romFileName}` };
        }
        try {
          await fs.access(exePath);
        } catch {
          return { ok: false, error: `Exécutable introuvable: ${exePath}` };
        }
        if (emu.coresPath && coreName) {
          if (!corePath)
            return { ok: false, error: `Core introuvable: ${coreName}` };
        }

        console.log(
          "[roms:launch]",
          exePath,
          builtArgs.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" "),
          "(cwd:",
          path.dirname(exePath) + ")",
        );

        const child = spawn(exePath, builtArgs, {
          cwd: path.dirname(exePath),
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        currentEmulator = child;
        child.once("exit", () => {
          if (currentEmulator === child) currentEmulator = null;
        });
        return { ok: true };
      } catch (e) {
        console.error("Failed to launch ROM:", e);
        return { ok: false, error: "Échec du lancement (voir logs)" };
      }
    },
  );

  ipcMain.handle("roms:killActive", async () => {
    try {
      if (currentEmulator && !currentEmulator.killed) {
        const pid = currentEmulator.pid;
        try {
          currentEmulator.kill();
        } catch (e) {
          console.warn("Kill failed (IPC):", e);
        }
        currentEmulator = null;
        console.log("[roms:killActive] Killed emulator pid", pid);
        return { ok: true };
      }
      return { ok: false, error: "Aucun émulateur actif" };
    } catch (e) {
      console.error("Failed to kill emulator:", e);
      return { ok: false, error: "Échec de l'arrêt" };
    }
  });

  ipcMain.handle("dialog:selectDirectory", async () => {
    const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle(
    "metadata:get",
    async (_evt: IPCEventLike, romFileName: string, systemId: string) => {
      try {
        const cfg = await ensureConfig(userData);
        const service = new MetadataService({
          screenscraper: cfg.scrapers?.screenscraper,
          igdb: cfg.scrapers?.igdb,
        });
        const defScraper = (cfg.scrapers?.default ?? "igdb") as
          | "igdb"
          | "screenscraper";
        service.setDefaultScraper(defScraper);
        // Même si romsRoot n'est pas défini, on peut lire le cache userData
        return await service.getMetadata(
          romFileName,
          systemId,
          cfg.romsRoot ?? "",
        );
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(
    "metadata:download",
    async (_evt: IPCEventLike, romFileName: string, systemId: string) => {
      try {
        const cfg = await ensureConfig(userData);
        if (!cfg.romsRoot) return null;
        const service = new MetadataService({
          screenscraper: cfg.scrapers?.screenscraper,
          igdb: cfg.scrapers?.igdb,
        });
        const defScraper = (cfg.scrapers?.default ?? "igdb") as
          | "igdb"
          | "screenscraper";
        service.setDefaultScraper(defScraper);
        return await service.downloadMetadata(
          romFileName,
          systemId,
          cfg.romsRoot,
        );
      } catch (error) {
        console.error("Error downloading metadata:", error);
        return null;
      }
    },
  );

  ipcMain.handle(
    "metadata:has",
    async (_evt: IPCEventLike, romFileName: string, systemId: string) => {
      try {
        const cfg = await ensureConfig(userData);
        if (!cfg.romsRoot) return false;
        const service = new MetadataService({
          screenscraper: cfg.scrapers?.screenscraper,
          igdb: cfg.scrapers?.igdb,
        });
        const defScraper = (cfg.scrapers?.default ?? "igdb") as
          | "igdb"
          | "screenscraper";
        service.setDefaultScraper(defScraper);
        return await service.hasMetadata(romFileName, systemId, cfg.romsRoot);
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle(
    "metadata:downloadSystem",
    async (evt: IPCEventLike, systemId: string) => {
      try {
        const cfg = await ensureConfig(userData);
        if (!cfg.romsRoot) return;
        const service = new MetadataService({
          screenscraper: cfg.scrapers?.screenscraper,
          igdb: cfg.scrapers?.igdb,
        });
        const defScraper = (cfg.scrapers?.default ?? "igdb") as
          | "igdb"
          | "screenscraper";
        service.setDefaultScraper(defScraper);

        // Récupérer exclude pour ce système
        const catalog = getCatalog();
        const sysCfg = catalog.systems.find((s) => s.id === systemId);
        const exclude = sysCfg?.exclude ?? [];
        return await service.downloadSystemMetadata(
          systemId,
          cfg.romsRoot,
          (current, total, fileName) => {
            evt.sender.send("metadata:progress", {
              systemId,
              current,
              total,
              fileName,
            });
          },
          { exclude },
        );
      } catch (error) {
        console.error("Error downloading system metadata:", error);
        return null;
      }
    },
  );

  ipcMain.handle(
    "metadata:downloadAll",
    async (evt: IPCEventLike, opts?: { force?: boolean }) => {
      try {
        const cfg = await ensureConfig(userData);
        if (!cfg.romsRoot)
          return {
            totals: { processed: 0, created: 0, skipped: 0, failed: 0 },
            systems: [],
          };
        const service = new MetadataService({
          screenscraper: cfg.scrapers?.screenscraper,
          igdb: cfg.scrapers?.igdb,
        });
        const defScraper = (cfg.scrapers?.default ?? "igdb") as
          | "igdb"
          | "screenscraper";
        service.setDefaultScraper(defScraper);
        const catalog = getCatalog();
        const totals: AllDownloadResult["totals"] = {
          processed: 0,
          created: 0,
          skipped: 0,
          failed: 0,
        };
        const systemsResults: SystemDownloadResult[] = [];
        for (const sys of catalog.systems) {
          const res = await service.downloadSystemMetadata(
            sys.id,
            cfg.romsRoot,
            (current, total, fileName) => {
              evt.sender.send("metadata:progress", {
                systemId: sys.id,
                current,
                total,
                fileName,
              });
            },
            { ...opts, exclude: sys.exclude ?? [] },
          );
          if (res) {
            systemsResults.push(res);
            totals.processed += res.processed;
            totals.created += res.created;
            totals.skipped += res.skipped;
            totals.failed += res.failed;
          }
        }
        const aggregate: AllDownloadResult = {
          systems: systemsResults,
          totals,
        };
        return aggregate;
      } catch (error) {
        console.error("Error downloading all metadata:", error);
        return {
          totals: { processed: 0, created: 0, skipped: 0, failed: 0 },
          systems: [],
        };
      }
    },
  );

  ipcMain.handle(
    "image:load",
    async (_evt: IPCEventLike, absPath: string): Promise<string | null> => {
      try {
        const data = await fs.readFile(absPath);
        const ext = path.extname(absPath).toLowerCase();
        let mime = "image/jpeg";
        if (ext === ".png") mime = "image/png";
        else if (ext === ".webp") mime = "image/webp";
        else if (ext === ".gif") mime = "image/gif";
        else if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
        return `data:${mime};base64,${data.toString("base64")}`;
      } catch (e) {
        console.error("Failed to load image:", absPath, e);
        return null;
      }
    },
  );

  ipcMain.handle(
    "video:load",
    async (_evt: IPCEventLike, absPath: string): Promise<string | null> => {
      try {
        const data = await fs.readFile(absPath);
        const ext = path.extname(absPath).toLowerCase();
        let mime = "video/mp4";
        if (ext === ".webm") mime = "video/webm";
        else if (ext === ".mp4") mime = "video/mp4";
        else if (ext === ".m4v") mime = "video/mp4";
        else if (ext === ".ogg" || ext === ".ogv") mime = "video/ogg";
        return `data:${mime};base64,${data.toString("base64")}`;
      } catch (e) {
        console.error("Failed to load video:", absPath, e);
        return null;
      }
    },
  );

  ipcMain.handle("favorites:list", async () => {
    return loadFavorites();
  });
  ipcMain.handle(
    "favorites:is",
    async (_evt: IPCEventLike, systemId: string, fileName: string) => {
      const list = await loadFavorites();
      return list.some(
        (f) => f.systemId === systemId && f.fileName === fileName,
      );
    },
  );
  ipcMain.handle(
    "favorites:toggle",
    async (_evt: IPCEventLike, systemId: string, fileName: string) => {
      const list = await loadFavorites();
      const idx = list.findIndex(
        (f) => f.systemId === systemId && f.fileName === fileName,
      );
      let favored: boolean;
      if (idx >= 0) {
        list.splice(idx, 1);
        favored = false;
      } else {
        list.push({ systemId, fileName });
        favored = true;
      }
      await saveFavorites(list);
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("favorites:changed");
      }
      return { ok: true, favored } as const;
    },
  );

  const registerShortcut = () => {
    const combo = "CommandOrControl+Shift+Q";
    if (globalShortcut.isRegistered(combo)) globalShortcut.unregister(combo);
    const ok = globalShortcut.register(combo, () => {
      if (currentEmulator && !currentEmulator.killed) {
        try {
          currentEmulator.kill();
        } catch (e) {
          console.warn("Kill failed (shortcut):", e);
        }
        console.log("[globalShortcut] Emulator terminated via shortcut");
        currentEmulator = null;
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send("emulator:terminated");
      }
    });
    if (!ok)
      console.warn("Failed to register global shortcut for emulator quit");
  };
  registerShortcut();
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- Favorites persistence ---
type FavoriteEntry = { systemId: string; fileName: string };
async function getFavoritesPath(): Promise<string> {
  const userData = app.getPath("userData");
  return path.join(userData, "favorites.json");
}
async function loadFavorites(): Promise<FavoriteEntry[]> {
  try {
    const p = await getFavoritesPath();
    const raw = await fs.readFile(p, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as FavoriteEntry[];
    return [];
  } catch {
    return [];
  }
}
async function saveFavorites(list: FavoriteEntry[]): Promise<void> {
  try {
    const p = await getFavoritesPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn("[favorites] save error", e);
  }
}
