import { useEffect, useRef } from "react";
import { setInputMode } from "../inputMode";

type Direction = "left" | "right" | "up" | "down";

export type InputNavOptions = {
  itemSelector: string;
  scopeSelector?: string;
  mode: "row" | "grid" | "list";
  wrapRow?: boolean; // allow circular navigation in row mode
  onBack?: () => void;
  onOpenSettings?: () => void;
  onQuit?: () => void;
  onToggleFavorite?: () => void; // long-press Y
  activeGuard?: () => boolean; // return true to enable handling in current context
};

export function useInputNavigation(opts: InputNavOptions) {
  const heldRef = useRef<{ [key: string]: boolean }>({});
  const lastMoveAtRef = useRef<number>(0);
  const lastActivateAtRef = useRef<number>(0);
  const ignoreActivationsBeforeRef = useRef<number>(0);
  const ACTIVATION_COOLDOWN_MS = 220; // évite double validation lors de transitions d'écran
  const INITIAL_IGNORE_MS = 250; // ignore les activations tout de suite après montage (changement d'écran)
  const Y_HOLD_MS = 1000; // ms to long-press Y to toggle favorite
  const yHoldStartRef = useRef<number | null>(null);
  const yFiredRef = useRef<boolean>(false);

  const getItems = (): HTMLElement[] => {
    const scope = opts.scopeSelector
      ? document.querySelector(opts.scopeSelector)
      : document;
    if (!scope) return [] as HTMLElement[];
    return Array.from(scope.querySelectorAll<HTMLElement>(opts.itemSelector));
  };

  const focusIndex = (idx: number) => {
    const items = getItems();
    if (items.length === 0) return;
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    const el = items[clamped];
    if (el) el.focus();
  };

  const getFocusedIndex = () => {
    const items = getItems();
    const active = document.activeElement as HTMLElement | null;
    return Math.max(
      0,
      items.findIndex((el) => el === active),
    );
  };

  const moveRow = (dir: "left" | "right") => {
    const idx = getFocusedIndex();
    const items = getItems();
    if (items.length === 0) return;
    const delta = dir === "left" ? -1 : 1;
    if (opts.wrapRow) {
      const next = (idx + delta + items.length) % items.length;
      focusIndex(next);
    } else {
      const next = Math.max(0, Math.min(idx + delta, items.length - 1));
      focusIndex(next);
    }
  };

  const moveGrid = (dir: Direction) => {
    const items = getItems();
    if (items.length === 0) return;
    const idx = getFocusedIndex();
    const current = items[idx];
    if (!current) {
      focusIndex(0);
      return;
    }
    const curRect = current.getBoundingClientRect();

    const sameRow = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return Math.abs(r.top - curRect.top) < 12; // tolerance
    };
    const isAbove = (el: HTMLElement) =>
      el.getBoundingClientRect().top < curRect.top - 6;
    const isBelow = (el: HTMLElement) =>
      el.getBoundingClientRect().top > curRect.top + 6;
    const isLeft = (el: HTMLElement) =>
      el.getBoundingClientRect().left < curRect.left - 6;
    const isRight = (el: HTMLElement) =>
      el.getBoundingClientRect().left > curRect.left + 6;

    let candidates: HTMLElement[] = [];
    if (dir === "left")
      candidates = items.filter((el) => sameRow(el) && isLeft(el));
    if (dir === "right")
      candidates = items.filter((el) => sameRow(el) && isRight(el));
    if (dir === "up") candidates = items.filter((el) => isAbove(el));
    if (dir === "down") candidates = items.filter((el) => isBelow(el));

    if (candidates.length === 0) return;

    const chooseClosest = (els: HTMLElement[]) => {
      return els.reduce(
        (best, el) => {
          const r = el.getBoundingClientRect();
          // prioritize closest horizontally for left/right, vertically for up/down
          const dx = Math.abs(r.left - curRect.left);
          const dy = Math.abs(r.top - curRect.top);
          const score =
            dir === "left" || dir === "right" ? dx * 2 + dy : dy * 2 + dx;
          if (!best) return { el, score };
          return score < best.score ? { el, score } : best;
        },
        null as null | { el: HTMLElement; score: number },
      );
    };

    const chosen = chooseClosest(candidates);
    if (chosen?.el) chosen.el.focus();
  };

  const handleMove = (dir: Direction) => {
    if (opts.mode === "row") {
      if (dir === "left" || dir === "right") moveRow(dir);
    } else if (opts.mode === "grid") {
      moveGrid(dir);
    } else if (opts.mode === "list") {
      const items = getItems();
      if (items.length === 0) return;
      const idx = getFocusedIndex();
      if (dir === "up") focusIndex(idx - 1);
      else if (dir === "down") focusIndex(idx + 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      setInputMode("keyboard");
      // Determine if this handler should be active
      let active = true;
      if (opts.activeGuard) active = !!opts.activeGuard();
      else if (opts.scopeSelector) {
        const scopeEl = document.querySelector(opts.scopeSelector);
        const target =
          (document.activeElement as HTMLElement | null) || undefined;
        if (scopeEl && target && !scopeEl.contains(target)) active = false;
      }
      if (!active) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          handleMove("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          handleMove("right");
          break;
        case "ArrowUp":
          e.preventDefault();
          handleMove("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          handleMove("down");
          break;
        case "Escape":
          if (opts.onBack) {
            e.preventDefault();
            opts.onBack();
          }
          break;
        case "Enter": {
          const idx = getFocusedIndex();
          const items = getItems();
          const el = items[idx];
          if (el) {
            e.preventDefault();
            el.click();
          }
          break;
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    opts.itemSelector,
    opts.scopeSelector,
    opts.mode,
    opts.onBack,
    opts.onOpenSettings,
    opts.onQuit,
  ]);

  useEffect(() => {
    let raf = 0;
    const repeatDelay = 150; // ms between repeat moves (for d-pad)
    const AXIS_LOW = 0.35; // hysteresis low threshold (raise to ensure reliable release)
    const AXIS_HIGH = 0.6; // activation high threshold
    // Début période d'ignorance des activations (A/Enter) pour absorber un appui maintenu
    ignoreActivationsBeforeRef.current = performance.now() + INITIAL_IGNORE_MS;

    const poll = () => {
      // Determine if this handler should be active
      let active = true;
      if (opts.activeGuard) active = !!opts.activeGuard();
      else if (opts.scopeSelector) {
        const scopeEl = document.querySelector(opts.scopeSelector);
        const target =
          (document.activeElement as HTMLElement | null) || undefined;
        if (scopeEl && target && !scopeEl.contains(target)) active = false;
      }
      if (!active) {
        raf = requestAnimationFrame(poll);
        return;
      }
      const gps = navigator.getGamepads?.() || [];
      const connectedGamepads = gps.filter(
        (g) => g && g.connected && g.mapping === "standard",
      );
      const now = performance.now();

      // Check all connected gamepads for input, use the first one with active input
      let activeGamepad: Gamepad | null = null;
      let wantUp = false,
        wantDown = false,
        wantLeft = false,
        wantRight = false;
      let axisX = 0,
        axisY = 0;
      const btnStates: { [key: number]: boolean } = {};

      // Read the first connected gamepad axes to allow releasing held axis flags
      // even when there's not enough input to mark a pad as "active" this frame.
      const firstGp = connectedGamepads[0] || null;
      const relX = firstGp ? firstGp.axes[0] || 0 : 0;
      const relY = firstGp ? firstGp.axes[1] || 0 : 0;
      const relBtn = (i: number) => !!firstGp?.buttons?.[i]?.pressed;

      for (const gp of connectedGamepads) {
        if (!gp) continue;

        const btn = (i: number) => gp.buttons[i]?.pressed || false;
        axisX = gp.axes[0] || 0;
        axisY = gp.axes[1] || 0;
        const dead = 0.4;

        const dpadUp = btn(12);
        const dpadDown = btn(13);
        const dpadLeft = btn(14);
        const dpadRight = btn(15);
        // D-Pad intent ONLY (do not mix with axis). Axis is handled separately with hysteresis below.
        const gpWantUp = dpadUp;
        const gpWantDown = dpadDown;
        const gpWantLeft = dpadLeft;
        const gpWantRight = dpadRight;

        // Check if this gamepad has any input
        const hasDirectionalInput =
          gpWantUp ||
          gpWantDown ||
          gpWantLeft ||
          gpWantRight ||
          Math.abs(axisX) > dead ||
          Math.abs(axisY) > dead;
        const hasButtonInput = btn(0) || btn(1) || btn(3) || btn(8) || btn(9); // A, B, Y, Select, Start

        if (hasDirectionalInput || hasButtonInput) {
          activeGamepad = gp;
          wantUp = gpWantUp;
          wantDown = gpWantDown;
          wantLeft = gpWantLeft;
          wantRight = gpWantRight;

          // Store button states for this active gamepad
          btnStates[0] = btn(0); // A
          btnStates[1] = btn(1); // B
          btnStates[3] = btn(3); // Y
          btnStates[8] = btn(8); // Select
          btnStates[9] = btn(9); // Start
          break; // Use the first gamepad with input
        }
      }

      // Always process axis release based on first connected pad to avoid lock-ups
      if (Math.abs(relX) < AXIS_LOW) {
        heldRef.current["AXIS_LEFT"] = false;
        heldRef.current["AXIS_RIGHT"] = false;
      }
      if (Math.abs(relY) < AXIS_LOW) {
        heldRef.current["AXIS_UP"] = false;
        heldRef.current["AXIS_DOWN"] = false;
      }
      // Also release button holds (A/B/Start/Select) when not pressed anymore
      if (!relBtn(0)) heldRef.current["A"] = false;
      if (!relBtn(1)) heldRef.current["B"] = false;
      if (!relBtn(9)) heldRef.current["Start"] = false;
      if (!relBtn(8)) heldRef.current["Select"] = false;
      // reset Y hold tracking when Y released on first pad
      if (!relBtn(3)) {
        yHoldStartRef.current = null;
        yFiredRef.current = false;
      }

      if (activeGamepad) {
        setInputMode("gamepad");
        const movedRecently = now - lastMoveAtRef.current < repeatDelay;

        let axisTriggered = false;
        if (axisY < -AXIS_HIGH && !heldRef.current["AXIS_UP"]) {
          handleMove("up");
          heldRef.current["AXIS_UP"] = true;
          heldRef.current["AXIS_DOWN"] = false;
          lastMoveAtRef.current = now;
          axisTriggered = true;
        } else if (axisY > AXIS_HIGH && !heldRef.current["AXIS_DOWN"]) {
          handleMove("down");
          heldRef.current["AXIS_DOWN"] = true;
          heldRef.current["AXIS_UP"] = false;
          lastMoveAtRef.current = now;
          axisTriggered = true;
        } else if (axisX < -AXIS_HIGH && !heldRef.current["AXIS_LEFT"]) {
          handleMove("left");
          heldRef.current["AXIS_LEFT"] = true;
          heldRef.current["AXIS_RIGHT"] = false;
          lastMoveAtRef.current = now;
          axisTriggered = true;
        } else if (axisX > AXIS_HIGH && !heldRef.current["AXIS_RIGHT"]) {
          handleMove("right");
          heldRef.current["AXIS_RIGHT"] = true;
          heldRef.current["AXIS_LEFT"] = false;
          lastMoveAtRef.current = now;
          axisTriggered = true;
        }

        // If no axis-triggered move, allow D-Pad with repeat gating
        if (!axisTriggered && !movedRecently) {
          if (wantLeft) {
            handleMove("left");
            lastMoveAtRef.current = now;
          } else if (wantRight) {
            handleMove("right");
            lastMoveAtRef.current = now;
          } else if (wantUp) {
            handleMove("up");
            lastMoveAtRef.current = now;
          } else if (wantDown) {
            handleMove("down");
            lastMoveAtRef.current = now;
          }
        }

        if (btnStates[0]) {
          // Bouton A (validation)
          const nowPress = now;
          const canActivateTime = nowPress > ignoreActivationsBeforeRef.current;
          const cooldownOk =
            nowPress - lastActivateAtRef.current > ACTIVATION_COOLDOWN_MS;
          if (!heldRef.current["A"] && canActivateTime && cooldownOk) {
            const idx = getFocusedIndex();
            const el = getItems()[idx];
            if (el) {
              el.click();
              lastActivateAtRef.current = nowPress;
            }
          }
          heldRef.current["A"] = true;
        } else {
          heldRef.current["A"] = false;
        }

        if (btnStates[1]) {
          // B
          const canActivateTime = now > ignoreActivationsBeforeRef.current;
          if (!heldRef.current["B"]) {
            if (canActivateTime) opts.onBack?.();
            // Mark as held regardless to avoid repeated triggers
          }
          heldRef.current["B"] = true;
        } else heldRef.current["B"] = false;

        if (btnStates[9]) {
          // Start
          const canActivateTime = now > ignoreActivationsBeforeRef.current;
          if (!heldRef.current["Start"]) {
            if (canActivateTime) opts.onOpenSettings?.();
          }
          heldRef.current["Start"] = true;
        } else heldRef.current["Start"] = false;

        if (btnStates[8]) {
          // Select/Back
          const canActivateTime = now > ignoreActivationsBeforeRef.current;
          if (!heldRef.current["Select"]) {
            if (canActivateTime) opts.onQuit?.();
          }
          heldRef.current["Select"] = true;
        } else heldRef.current["Select"] = false;

        // Long-press Y to toggle favorite
        if (btnStates[3]) {
          if (yHoldStartRef.current == null) {
            yHoldStartRef.current = now;
            yFiredRef.current = false;
          } else if (
            !yFiredRef.current &&
            now - yHoldStartRef.current >= Y_HOLD_MS
          ) {
            opts.onToggleFavorite?.();
            yFiredRef.current = true;
          }
        }
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [
    opts.itemSelector,
    opts.scopeSelector,
    opts.mode,
    opts.onBack,
    opts.onOpenSettings,
    opts.onQuit,
  ]);
}
