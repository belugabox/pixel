import electron = require("electron");
const { app, BrowserWindow, screen } = electron;

import { promises as fs } from "node:fs";
import path from "node:path";

// Global splash window reference
let splashWindow: electron.BrowserWindow | null = null;

// Global emulator reference (will be passed from main)
let currentEmulator: import("node:child_process").ChildProcess | null = null;

export function setCurrentEmulator(
  emulator: import("node:child_process").ChildProcess | null,
) {
  currentEmulator = emulator;
}

// --- Launch splash screen ---
export async function showLaunchSplash(
  systemId: string,
  romFileName: string,
): Promise<void> {
  if (splashWindow) {
    splashWindow.close();
  }

  // Try to load wheel image
  let wheelImage: string | null = null;
  try {
    const metadataDir = path.join(
      app.getPath("userData"),
      "metadata",
      systemId,
    );
    const romName = path.parse(romFileName).name;

    // Check for different extensions
    const extensions = [".jpg", ".jpeg", ".png", ".webp"];
    for (const ext of extensions) {
      const testPath = path.join(metadataDir, `${romName}_wheel${ext}`);
      try {
        await fs.access(testPath);
        const data = await fs.readFile(testPath);
        const mime =
          ext === ".jpg"
            ? "image/jpeg"
            : ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".png"
                ? "image/png"
                : "image/webp";
        wheelImage = `data:${mime};base64,${data.toString("base64")}`;
        break;
      } catch {
        // Continue to next extension
      }
    }
  } catch (e) {
    console.warn("[splash] Failed to load wheel image:", e);
  }

  splashWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Get screen bounds and cover entire screen including taskbar
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
  const { width: workWidth, height: workHeight } = primaryDisplay.workArea;

  // If work area is smaller than screen, taskbar is present - cover full screen
  const coverTaskbar = workHeight < screenHeight || workWidth < screenWidth;
  const targetWidth = coverTaskbar ? screenWidth : workWidth;
  const targetHeight = coverTaskbar ? screenHeight : workHeight;

  splashWindow.setBounds({
    x: 0,
    y: 0,
    width: targetWidth,
    height: targetHeight,
  });
  splashWindow.setAlwaysOnTop(true, "screen-saver");
  splashWindow.setSkipTaskbar(true);

  // Create HTML content for splash screen
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 0;
          background: black;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: Arial, sans-serif;
          color: white;
        }
        .splash-content {
          text-align: center;
        }
        .wheel-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      </style>
    </head>
    <body>
      <div class="splash-content">
        ${wheelImage ? `<img src="${wheelImage}" alt="Game wheel" class="wheel-image" />` : ""}
      </div>
    </body>
    </html>
  `;

  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );

  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });

  // Auto-close after delay based on emulator type or when emulator exits
  // Model 2 emulator takes longer to start, so use longer timeout
  const isSlowEmulator = systemId.toLowerCase() === "model2";
  const splashTimeout = isSlowEmulator ? 8000 : 5000; // 8 seconds for Model 2, 5 for others

  const closeTimer = setTimeout(() => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
  }, splashTimeout);

  // Listen for emulator exit to close splash - check more frequently
  const checkEmulator = () => {
    if (!currentEmulator) {
      // Emulator has finished and been cleaned up
      clearTimeout(closeTimer);
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      return;
    }
    if (currentEmulator.killed) {
      // Emulator was killed
      clearTimeout(closeTimer);
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      return;
    }
    // Continue checking
    setTimeout(checkEmulator, 500);
  };
  setTimeout(checkEmulator, 500);
}
