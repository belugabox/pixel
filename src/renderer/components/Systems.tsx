import React, { useEffect, useState, useRef } from 'react';
import { useInputNavigation } from '../hooks/useInputNavigation';

export function Systems({ onOpen }: { onOpen: (system: string) => void }) {
  const [systems, setSystems] = useState<string[]>([]);
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const folders = await window.roms.list();
      setSystems(folders ?? []);
    })();
  }, []);

  useEffect(() => {
    // Focus the first system tile when list is ready
    if (systems.length > 0) {
      const first = document.querySelector<HTMLElement>('#systems .system-tile');
      first?.focus();
    }
  }, [systems]);

  useInputNavigation({
    itemSelector: '#systems .system-tile',
    scopeSelector: '#systems-screen',
    mode: 'row',
    onOpenSettings: () => document.getElementById('settings-btn')?.click(),
    activeGuard: () => !document.getElementById('settings-modal'),
  });

  return (
    <section id="systems-screen" ref={scopeRef}>
      <h2>Systèmes détectés</h2>
      <div id="systems" className="systems-row">
        {systems.map((name) => (
          <button
            key={name}
            className="system-tile"
            tabIndex={0}
            onClick={() => onOpen(name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); onOpen(name);
              }
            }}
          >
            <h3>{name}</h3>
          </button>
        ))}
      </div>
    </section>
  );
}
