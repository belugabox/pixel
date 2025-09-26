import React, { useEffect, useState, useRef, useCallback } from 'react';
import { findLogo } from '../logo-manifest';
import { useInputNavigation } from '../hooks/useInputNavigation';
import { getInputMode, setInputMode } from '../inputMode';

export function Systems({ onOpen, initialIndex = 0 }: { onOpen: (system: string, index: number) => void; initialIndex?: number }) {
  const [systems, setSystems] = useState<string[]>([]);
  const scopeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const resolveLogo = useCallback((idOrName: string) => findLogo(idOrName), []);
  // animation state
  const targetOffsetRef = useRef(0); // desired translateX
  const currentOffsetRef = useRef(0); // rendered translateX
  const rafRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const velocityRef = useRef(0);

  // spring config
  const SPRING_STIFFNESS = 640; // higher = snappier
  const SPRING_DAMPING = 68;    // higher = more friction
  const MAX_FRAME_MS = 48;      // clamp long frames

  const applyTransform = (x: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = `translateX(${x}px)`;
    track.setAttribute('data-offset', String(x));
  };

  const animate = useCallback((ts: number) => {
    const track = trackRef.current;
    if (!track) return;
    if (lastTsRef.current == null) lastTsRef.current = ts;
    const dtMs = Math.min(MAX_FRAME_MS, ts - lastTsRef.current);
    lastTsRef.current = ts;
    const dt = dtMs / 1000; // seconds
    const target = targetOffsetRef.current;
    const current = currentOffsetRef.current;
    const displacement = target - current;

    // critically damped-ish spring (semi-implicit Euler)
    const accel = SPRING_STIFFNESS * displacement - SPRING_DAMPING * velocityRef.current;
    const newVel = velocityRef.current + accel * dt;
    let newPos = current + newVel * dt;

    // snap when very close to avoid jitter
    if (Math.abs(displacement) < 0.2 && Math.abs(newVel) < 5) {
      newPos = target;
      velocityRef.current = 0;
    } else {
      velocityRef.current = newVel;
    }

    currentOffsetRef.current = newPos;
    applyTransform(newPos);
    if (newPos !== target) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      lastTsRef.current = null; // reset timeline for next motion
    }
  }, []);

  const setTargetOffset = useCallback((x: number, immediate = false) => {
    targetOffsetRef.current = x;
    if (immediate) {
      velocityRef.current = 0;
      currentOffsetRef.current = x;
      applyTransform(x);
      return;
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const centerOnIndex = useCallback((idx: number, opts?: { immediate?: boolean }) => {
    const track = trackRef.current;
    if (!track) return;
    const tiles = Array.from(track.querySelectorAll<HTMLElement>('.system-tile'));
    if (!tiles.length) return;
    const clamped = Math.max(0, Math.min(idx, tiles.length - 1));
    const target = tiles[clamped];
    if (!target) return;

    // viewport center (ignores internal track padding heuristics)
    const viewportCenter = window.innerWidth / 2;
    const targetRect = target.getBoundingClientRect();
    const targetMid = targetRect.left + targetRect.width / 2;
    const delta = viewportCenter - targetMid;
    const current = currentOffsetRef.current;
    let next = current + delta;

    // naive bounds: prevent dragging beyond first/last so they can center
    const firstRect = tiles[0].getBoundingClientRect();
    const lastRect = tiles[tiles.length - 1].getBoundingClientRect();
    const firstMid = firstRect.left + firstRect.width / 2;
    const lastMid = lastRect.left + lastRect.width / 2;
    const desiredFirst = viewportCenter - firstMid + current; // offset that would center first
    const desiredLast = viewportCenter - lastMid + current;   // offset that would center last
    // diff to current already included; clamp against these extremes
    next = Math.min(desiredFirst, Math.max(desiredLast, next));

  setTargetOffset(next, !!opts?.immediate);

    // neighbor marking for peek effect
    tiles.forEach((el, i) => {
      if (i === clamped) {
        el.removeAttribute('data-neighbor');
      } else if (Math.abs(i - clamped) === 1) {
        el.setAttribute('data-neighbor', 'true');
      } else {
        el.removeAttribute('data-neighbor');
      }
    });
  }, [setTargetOffset]);

  useEffect(() => {
    (async () => {
      const folders = await window.roms.list();
      setSystems(folders ?? []);
    })();
  }, []);

  useEffect(() => {
    if (systems.length > 0) {
      requestAnimationFrame(() => {
  const nodeList: NodeListOf<HTMLElement> = trackRef.current?.querySelectorAll<HTMLElement>('.system-tile') || ([] as unknown as NodeListOf<HTMLElement>);
  const tiles = Array.from(nodeList);
        const init = Math.min(initialIndex, tiles.length - 1);
        const target = tiles[init];
        target?.focus();
        setFocusedIndex(init);
        centerOnIndex(init, { immediate: true });
      });
    }
  }, [systems, centerOnIndex, initialIndex]);

  useInputNavigation({
    itemSelector: '#systems-screen .system-tile',
    scopeSelector: '#systems-screen',
    mode: 'row',
    wrapRow: true,
    onOpenSettings: () => document.getElementById('settings-btn')?.click(),
    activeGuard: () => !document.getElementById('settings-modal'),
  });

  // Track focus changes to recenter
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const idx = Array.from(
        trackRef.current?.querySelectorAll('.system-tile') || [],
      ).findIndex(el => el === e.target);
      if (idx >= 0) {
        setFocusedIndex(idx);
        centerOnIndex(idx); // normal animated recenter
      }
    };
    const track = trackRef.current;
    track?.addEventListener('focusin', onFocus);
    return () => {
      track?.removeEventListener('focusin', onFocus);
      cancelAnimationFrame(rafRef.current);
    };
  }, [centerOnIndex]);

  // Wheel horizontal scroll -> shift focus by wheel delta
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      // Treat as mouse interaction and only handle wheel in mouse mode
      setInputMode('mouse');
      if (getInputMode() !== 'mouse') return;
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        // treat vertical wheel as horizontal intent
      }
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 4) return; // ignore tiny
      e.preventDefault();
      const dir = delta > 0 ? 1 : -1;
      const tiles = Array.from(el.querySelectorAll<HTMLElement>('.system-tile'));
      const len = tiles.length;
      if (!len) return;
      const next = (focusedIndex + dir + len) % len;
      if (next !== focusedIndex) {
        tiles[next]?.focus();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [focusedIndex]);

  return (
    <section id="systems-screen" ref={scopeRef}>
      <div className="systems-carousel">
        <div ref={trackRef} className="systems-track" data-offset="0">
          {systems.map((name, i) => {
            const logo = resolveLogo(name);
            return (
            <button
              key={name}
              className="system-tile"
              tabIndex={0}
              aria-current={i === focusedIndex ? 'true' : undefined}
              onClick={() => onOpen(name, i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault(); onOpen(name, i);
                }
              }}
            >
              {logo && <img src={logo} alt="" aria-hidden="true" className="system-logo" />}
              {!logo && <h3>{name}</h3>}
            </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
