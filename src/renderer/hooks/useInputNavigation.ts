import { useEffect, useRef } from "react";

type Direction = "left" | "right" | "up" | "down";

export type InputNavOptions = {
  itemSelector: string;
  scopeSelector?: string;
  mode: "row" | "grid" | "list";
  wrapRow?: boolean; // allow circular navigation in row mode
  onBack?: () => void;
  onOpenSettings?: () => void;
  onQuit?: () => void;
  activeGuard?: () => boolean; // return true to enable handling in current context
};

export function useInputNavigation(opts: InputNavOptions) {
  const heldRef = useRef<{ [key: string]: boolean }>({});
  const lastMoveAtRef = useRef<number>(0);
  const lastActivateAtRef = useRef<number>(0);
  const ignoreActivationsBeforeRef = useRef<number>(0);
  const ACTIVATION_COOLDOWN_MS = 220; // évite double validation lors de transitions d'écran
  const INITIAL_IGNORE_MS = 250; // ignore les activations tout de suite après montage (changement d'écran)

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
    const repeatDelay = 150; // ms between repeat moves
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
      const gp = gps.find((g) => g && g.connected && g.mapping === "standard");
      const now = performance.now();
      if (gp) {
        const btn = (i: number) => gp.buttons[i]?.pressed;
        const movedRecently = now - lastMoveAtRef.current < repeatDelay;

        const dpadUp = btn(12);
        const dpadDown = btn(13);
        const dpadLeft = btn(14);
        const dpadRight = btn(15);

        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;
        const dead = 0.4;

        const wantUp = dpadUp || axisY < -dead;
        const wantDown = dpadDown || axisY > dead;
        const wantLeft = dpadLeft || axisX < -dead;
        const wantRight = dpadRight || axisX > dead;

        if (!movedRecently) {
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

        if (btn(0)) {
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

        if (btn(1)) {
          // B
          if (!heldRef.current["B"]) opts.onBack?.();
          heldRef.current["B"] = true;
        } else heldRef.current["B"] = false;

        if (btn(9)) {
          // Start
          if (!heldRef.current["Start"]) opts.onOpenSettings?.();
          heldRef.current["Start"] = true;
        } else heldRef.current["Start"] = false;

        if (btn(8)) {
          // Select/Back
          if (!heldRef.current["Select"]) opts.onQuit?.();
          heldRef.current["Select"] = true;
        } else heldRef.current["Select"] = false;
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
