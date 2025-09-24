/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./renderer/App";
import { ToastProvider } from "./renderer/components/Toast";

function hidePreloader() {
  const pre = document.getElementById("preloader");
  const app = document.getElementById("app");
  if (pre) pre.style.display = "none";
  if (app) app.style.display = "";
}

function mountReact() {
  const container = document.getElementById("app");
  if (!container) return;
  const root = createRoot(container);
  root.render(
    React.createElement(ToastProvider, null, React.createElement(App)),
  );
}

const MIN_PRELOAD_MS = 500;
const startTime = Date.now();

function bootWithMinPreloader() {
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, MIN_PRELOAD_MS - elapsed);
  setTimeout(() => {
    hidePreloader();
    mountReact();
  }, remaining);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootWithMinPreloader);
} else {
  bootWithMinPreloader();
}
