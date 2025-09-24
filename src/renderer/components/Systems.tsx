import React, { useEffect, useState } from 'react';

export function Systems({ onOpen }: { onOpen: (system: string) => void }) {
  const [systems, setSystems] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const folders = await window.roms.list();
      setSystems(folders ?? []);
    })();
  }, []);

  return (
    <section id="systems-screen">
      <h2>Systèmes détectés</h2>
      <div id="systems" className="systems-row">
        {systems.map((name) => (
          <button
            key={name}
            className="system-tile"
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
