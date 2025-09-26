import React, { useEffect, useState, useCallback } from 'react';
import { RomTile } from './RomTile';
import { useInputNavigation } from '../hooks/useInputNavigation';
import { findLogo } from '../logo-manifest';

export function Roms({ system, onBack }: { system: string; onBack: () => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [favMap, setFavMap] = useState<Array<{ systemId: string; fileName: string }>>([]);
  const [favVersion, setFavVersion] = useState(0); // bump to force tiles to remount when favorites change

  const reload = useCallback(async () => {
    if (system.toLowerCase() === 'favorites') {
      const list = await window.favorites.list();
      setFavMap(list);
      setFiles(list.map((x) => x.fileName));
    } else {
      const [f, favList] = await Promise.all([
        window.roms.listFiles(system),
        window.favorites.list(),
      ]);
      setFavMap(favList);
      setFiles(f ?? []);
    }
  }, [system]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (files.length > 0) {
      const first = document.querySelector<HTMLElement>('#roms .rom-tile');
      first?.focus();
    }
  }, [files]);

  useEffect(() => {
    // Subscribe to favorites change to refresh order and force tiles to remount
    const off = window.favorites.onChanged(() => {
      setFavVersion((v) => v + 1);
      reload();
    });
    return () => off();
  }, [reload]);

  useInputNavigation({
    itemSelector: '#roms .rom-tile',
    scopeSelector: '#roms-screen',
    mode: 'grid',
    // B should always bring back to the main Systems menu
    onBack,
    onOpenSettings: () => document.getElementById('settings-btn')?.click(),
    onToggleFavorite: async () => {
      // Toggle favorite for the currently focused tile
      const active = document.activeElement as HTMLElement | null;
      const tile = active?.closest('.rom-tile') as HTMLElement | null;
      const file = tile?.dataset.file;
      const sys = tile?.dataset.system;
      if (file && sys) {
        try {
          await window.favorites.toggle(sys, file);
          // Changes are handled by favorites:changed subscription
        } catch (e) {
          // ignore
        }
      }
    },
    activeGuard: () => !document.getElementById('settings-modal'),
  });

  // For non-favorites systems, sort favorites at the top with a visual separator
  const isFavForSystem = new Set(
    favMap
      .filter((f) => f.systemId.toLowerCase() === system.toLowerCase())
      .map((f) => f.fileName.toLowerCase()),
  );

  const favoredFiles = system.toLowerCase() === 'favorites'
    ? []
    : files.filter((f) => isFavForSystem.has(f.toLowerCase()));
  const otherFiles = system.toLowerCase() === 'favorites'
    ? files
    : files.filter((f) => !isFavForSystem.has(f.toLowerCase()));

  const isSingle = false; // grid is always centered via CSS now

  return (
    <section id="roms-screen" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="roms-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '24px 0 8px' }}>
        <button id="back-btn" className="back-btn" onClick={onBack} style={{ position: 'absolute', left: 16, top: 8 }}>‹ Retour</button>
        {(() => {
          const logo = findLogo(system);
          return logo ? (
            <img src={logo} alt={system} className="system-logo" style={{ maxHeight: 60, objectFit: 'contain' }} />
          ) : (
            <h2 id="roms-title" style={{ margin: 0 }}>ROMs - {system} ({files.length})</h2>
          );
        })()}
      </div>
  <div id="roms" className={`roms-grid`} style={{ width: 'min(1400px, 92vw)' }}>
        {files.length === 0 ? (
          <div className="empty-state">Aucune ROM trouvée pour ce système.</div>
        ) : system.toLowerCase() === 'favorites' ? (
          favMap.map((f) => (
            <RomTile key={`${f.systemId}:${f.fileName}:${favVersion}`} fileName={f.fileName} systemId={f.systemId} />
          ))
        ) : (
          <>
            {!isSingle && favoredFiles.length > 0 && (
              <div className="roms-separator" style={{ padding: '6px 4px' }}>Favoris</div>
            )}
            {favoredFiles.map((file) => (
              <RomTile key={`${file}:fav:${favVersion}`} fileName={file} systemId={system} />
            ))}
            {!isSingle && favoredFiles.length > 0 && otherFiles.length > 0 && (
              <div className="roms-separator" style={{ padding: '10px 4px 6px' }}>Autres</div>
            )}
            {otherFiles.map((file) => (
              <RomTile key={`${file}:other:${favVersion}`} fileName={file} systemId={system} />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
