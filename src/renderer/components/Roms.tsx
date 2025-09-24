import React, { useEffect, useState } from 'react';
import { RomTile } from './RomTile';

export function Roms({ system, onBack }: { system: string; onBack: () => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  useEffect(() => {
    (async () => {
      const f: string[] = await (window as any).roms?.listFiles?.(system);
      setFiles(f ?? []);
    })();
  }, [system]);

  const downloadAllMetadata = async () => {
    if (isDownloadingAll) return;
    
    setIsDownloadingAll(true);
    try {
      await (window as any).metadata?.downloadSystem?.(system);
      // Refresh the ROM tiles by triggering a re-render
      window.location.reload();
    } catch (error) {
      console.error('Error downloading all metadata:', error);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <section id="roms-screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button id="back-btn" className="back-btn" onClick={onBack}>‹ Retour</button>
        <h2 id="roms-title" style={{ margin: '0 0 0 auto' }}>ROMs - {system} ({files.length})</h2>
        <button 
          className="download-all-btn" 
          onClick={downloadAllMetadata}
          disabled={isDownloadingAll}
        >
          {isDownloadingAll ? 'Téléchargement...' : 'Télécharger toutes les métadonnées'}
        </button>
      </div>
      <div id="roms" className="roms-grid">
        {files.length === 0 ? (
          <div className="empty-state">Aucune ROM trouvée pour ce système.</div>
        ) : files.map((file) => (
          <RomTile key={file} fileName={file} systemId={system} />
        ))}
      </div>
    </section>
  );
}
