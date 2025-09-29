import React, { useEffect, useState, useRef, useCallback } from 'react';
import { findLogo } from '../logo-manifest';
import { useInputNavigation } from '../hooks/useInputNavigation';

export function Systems({ onOpen, initialIndex = 0 }: { onOpen: (system: string, index: number) => void; initialIndex?: number }) {
  const [systems, setSystems] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const centerRef = useRef<HTMLButtonElement>(null);
  const resolveLogo = useCallback((idOrName: string) => findLogo(idOrName), []);

  // Load systems with optional Favoris up front
  useEffect(() => {
    (async () => {
      const folders = await window.roms.list();
      const favs = await window.favorites.list();
      const hasFavs = Array.isArray(favs) && favs.length > 0;
      const all = folders ?? [];
      const withFav = hasFavs ? ["Favoris", ...all] : all;
      setSystems(withFav);
      const init = Math.min(initialIndex, Math.max(0, withFav.length - 1));
      setIndex(init);
      // Focus center once ready
      requestAnimationFrame(() => centerRef.current?.focus());
    })();
    const off = window.favorites.onChanged(async () => {
      const folders = await window.roms.list();
      const favs = await window.favorites.list();
      const hasFavs = Array.isArray(favs) && favs.length > 0;
      const all = folders ?? [];
      const withFav = hasFavs ? ["Favoris", ...all] : all;
      setSystems(withFav);
      setIndex((i) => Math.min(i, Math.max(0, withFav.length - 1)));
      requestAnimationFrame(() => centerRef.current?.focus());
    });
    return () => off();
  }, [initialIndex]);

  const len = systems.length;
  const wrap = (i: number) => (len ? (i + len) % len : 0);
  const prevIdx = wrap(index - 1);
  const nextIdx = wrap(index + 1);

  const openSystem = useCallback((name: string, i: number) => {
    onOpen(name === 'Favoris' ? 'favorites' : name, i);
  }, [onOpen]);

  // Use navigation for A/B/Start and to keep consistent input mode handling
  useInputNavigation({
    itemSelector: '#systems-screen .system-tile',
    scopeSelector: '#systems-screen',
    mode: 'row',
    wrapRow: true,
    onOpenSettings: () => document.getElementById('settings-btn')?.click(),
    activeGuard: () => !document.getElementById('settings-modal'),
  });

  const onPrevFocus = () => {
    setIndex((i) => wrap(i - 1));
    // Return focus to center so A always applies to selected system
    requestAnimationFrame(() => centerRef.current?.focus());
  };
  const onNextFocus = () => {
    setIndex((i) => wrap(i + 1));
    requestAnimationFrame(() => centerRef.current?.focus());
  };

  const onPrevClick = () => onPrevFocus();
  const onNextClick = () => onNextFocus();
  const onCenterClick = () => {
    const name = systems[index];
    if (name) openSystem(name, index);
  };

  return (
    <section id="systems-screen">
      <div className="systems-three">
        {/* Previous */}
        <button
          className="system-tile prev"
          tabIndex={0}
          onFocus={onPrevFocus}
          onMouseDown={(e) => {
            // Évite double déclenchement (DOWN puis UP) : on gère tout au mousedown
            e.preventDefault();
            onPrevClick();
          }}
          aria-label="Système précédent"
        >
          {len > 0 && (() => {
            const name = systems[prevIdx];
            const logo = resolveLogo(name);
            return logo ? <img src={logo} alt="" aria-hidden="true" className="system-logo" /> : <h3>{name}</h3>;
          })()}
        </button>

        {/* Current */}
        <button
          className="system-tile current"
          tabIndex={0}
          ref={centerRef}
          aria-current="true"
          onClick={onCenterClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); onCenterClick();
            }
          }}
        >
          {len > 0 && (() => {
            const name = systems[index];
            const logo = resolveLogo(name);
            return logo ? <img src={logo} alt="" aria-hidden="true" className="system-logo" /> : <h3>{name}</h3>;
          })()}
        </button>

        {/* Next */}
        <button
          className="system-tile next"
          tabIndex={0}
          onFocus={onNextFocus}
          onMouseDown={(e) => {
            // Évite double déclenchement (DOWN puis UP) : on gère tout au mousedown
            e.preventDefault();
            onNextClick();
          }}
          aria-label="Système suivant"
        >
          {len > 0 && (() => {
            const name = systems[nextIdx];
            const logo = resolveLogo(name);
            return logo ? <img src={logo} alt="" aria-hidden="true" className="system-logo" /> : <h3>{name}</h3>;
          })()}
        </button>
      </div>
    </section>
  );
}
