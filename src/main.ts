// Import electron via require to avoid TS module resolution issue in this environment
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  globalShortcut,
} = require("electron");
// Minimal event type (opaque) for IPC invoke handlers
interface IPCEventLike {
  sender: { send: (channel: string, ...args: unknown[]) => void };
}
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

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
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

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// IPC config handlers
app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  await ensureConfig(userData);

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

  ipcMain.handle("gamepad:isGlobalActive", async () => {
    return isGlobalWatcherActive();
  });

  let currentEmulator: import("node:child_process").ChildProcess | null = null;

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
        const excluded = sys?.exclude?.map((e) => e.toLowerCase()) ?? [];

        return entries
          .filter((e) => e.isFile())
          .map((e) => e.name)
          .filter((name) => {
            if (!allowed) return true;
            const ext = path.extname(name).toLowerCase();
            return allowed.includes(ext);
          })
          .filter((name) => !excluded.includes(name.toLowerCase()))
          .sort();
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
        const coreName = sys.core;
        const emuRoot = path.join(cfg.emulatorsRoot || "", emu.id);

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

        // Build args replacing tokens
        const builtArgs = (emu.args || []).map((a) =>
          a
            .replace("{rom}", romPath)
            .replace("{romName}", romName)
            .replace("{core}", corePath || coreName || ""),
        );

        // Resolve executable with fallback
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
              // keep exePath as-is to report a helpful error below
              exePath = primaryExe;
            }
          }
        }

        // Validate paths
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
          if (!corePath) {
            return { ok: false, error: `Core introuvable: ${coreName}` };
          }
        }

        // Log the command being executed for visibility
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
        // On Windows, use process.kill; detached child will receive signal
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
    const res = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  // Metadata handlers
  ipcMain.handle(
    "metadata:get",
    async (_evt: IPCEventLike, romFileName: string, systemId: string) => {
      try {
        const cfg = await ensureConfig(userData);
        if (!cfg.romsRoot) return null;
        const service = new MetadataService({
          screenscraper: cfg.scrapers?.screenscraper,
          igdb: cfg.scrapers?.igdb,
        });

        return await service.getMetadata(romFileName, systemId, cfg.romsRoot);
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

        await service.downloadSystemMetadata(
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
        );
      } catch (error) {
        console.error("Error downloading system metadata:", error);
      }
    },
  );

  ipcMain.handle(
    "metadata:downloadAll",
    async (evt: IPCEventLike, opts?: { force?: boolean }) => {
      try {
        const cfg = await ensureConfig(userData);
        if (!cfg.romsRoot) return;
        const service = new MetadataService({
          screenscraper: cfg.scrapers?.screenscraper,
          igdb: cfg.scrapers?.igdb,
        });
        const catalog = getCatalog();
        for (const sys of catalog.systems) {
          await service.downloadSystemMetadata(
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
            opts,
          );
        }
      } catch (error) {
        console.error("Error downloading all metadata:", error);
      }
    },
  );

  // Load a local image file (outside of served bundle) and return a data URI
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

  // Register a global shortcut to kill active emulator
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
  // Start native (Windows) global gamepad watcher (Option B)
  startGlobalComboWatcher();
  onXInputCombo(() => {
    // Mirror renderer combo behavior: kill active emulator
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
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import {
  ensureConfig,
  saveConfig,
  type UserConfig,
  getCatalog,
} from "./config";
