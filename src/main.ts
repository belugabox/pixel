import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { MetadataService } from "./services/metadata-service";
import { promises as fs } from "node:fs";
import path from "node:path";
import started from "electron-squirrel-startup";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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

  ipcMain.handle("config:set", async (_evt, cfg: UserConfig) => {
    await saveConfig(userData, cfg);
    return cfg;
  });

  ipcMain.handle("catalog:get", async () => {
    return getCatalog();
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

  ipcMain.handle("roms:listFiles", async (_evt, systemFolder: string) => {
    try {
      const cfg = await ensureConfig(userData);
      const dir = path.join(cfg.romsRoot, systemFolder);
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // Filtrage par extensions du catalogue (on suppose que systemFolder == id du système)
      const catalog = getCatalog();
      const sys = catalog.systems.find(
        (s) => s.id.toLowerCase() === String(systemFolder).toLowerCase(),
      );
      const allowed = sys?.extensions?.map((e) => e.toLowerCase()) ?? null;

      const files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((name) => {
          if (!allowed) return true; // si inconnu, on n'exclut rien
          const ext = path.extname(name).toLowerCase();
          return allowed.includes(ext);
        })
        .sort();

      return files;
    } catch {
      return [];
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
    async (_evt, romFileName: string, systemId: string) => {
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
    async (_evt, romFileName: string, systemId: string) => {
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
    async (_evt, romFileName: string, systemId: string) => {
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
    async (
      _evt,
      systemId: string,
      onProgress?: (current: number, total: number, fileName: string) => void,
    ) => {
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
          onProgress,
        );
      } catch (error) {
        console.error("Error downloading system metadata:", error);
      }
    },
  );
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
