export type InputMode = "mouse" | "keyboard" | "gamepad";

let currentMode: InputMode = "mouse";

export function setInputMode(mode: InputMode) {
  if (currentMode === mode) return;
  currentMode = mode;
  try {
    document.body.setAttribute("data-input", mode);
  } catch {
    /* ignore */
  }
}

export function getInputMode(): InputMode {
  return currentMode;
}

// Initialize attribute at module load
try {
  if (!document.body.getAttribute("data-input")) {
    document.body.setAttribute("data-input", currentMode);
  }
} catch {
  /* ignore */
}
