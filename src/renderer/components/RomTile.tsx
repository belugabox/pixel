import React, { useEffect, useState } from 'react';
import { GameMetadata } from '../types';
import { useToast } from './Toast';

interface RomTileProps {
  fileName: string;
  systemId: string;
}

export function RomTile({ fileName, systemId }: RomTileProps) {
  const [metadata, setMetadata] = useState<GameMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const fallbackExts = ['webp', 'png', 'jpg', 'svg'] as const;

  const toFileUrl = (absPath: string) => {
    if (!absPath) return '';
    if (absPath.startsWith('file://')) return absPath;
    const normalized = absPath.replace(/\\/g, '/');
    return 'file:///' + encodeURI(normalized);
  };

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const meta = await window.metadata.get(fileName, systemId);
        setMetadata(meta);
      } catch (e) {
        console.error('Error checking metadata:', e);
        setError('Erreur lors de la vérification des métadonnées');
      }
    })();
  }, [fileName, systemId]);

  useEffect(() => {
    if (metadata?.images?.cover) {
      setCoverSrc(toFileUrl(metadata.images.cover));
      setFallbackIndex(0);
    } else {
      setFallbackIndex(0);
      setCoverSrc(`systems/${systemId}.${fallbackExts[0]}`);
    }
  }, [metadata, systemId]);

  const launch = async () => {
    try {
      const res = await window.roms.launch(systemId, fileName);
      if (!res.ok && 'error' in res) {
        show(res.error || 'Échec du lancement', 'error');
      }
    } catch (e) {
      console.error('Launch failed:', e);
      show('Échec du lancement (voir logs)', 'error');
    }
  };

  return (
    <div className="rom-tile" onClick={launch} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') launch(); }}>
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={metadata?.name || fileName}
          className="rom-cover"
          onError={() => {
            // Try next fallback extension for system placeholder
            if (!metadata?.images?.cover) {
              const next = fallbackIndex + 1;
              if (next < fallbackExts.length) {
                setFallbackIndex(next);
                setCoverSrc(`systems/${systemId}.${fallbackExts[next]}`);
              } else {
                setCoverSrc(null);
              }
            } else {
              setCoverSrc(null);
            }
          }}
        />
      ) : (
        <div className="rom-cover" aria-hidden="true" />
      )}

      <div className="rom-info">
        <h3 className="rom-title">{metadata?.name || fileName}</h3>

        {metadata?.description && (
          <p className="rom-description">
            {metadata.description.length > 150
              ? metadata.description.substring(0, 150) + '...'
              : metadata.description}
          </p>
        )}

        <div className="rom-details">
          {metadata?.developer && <span className="rom-developer">{metadata.developer}</span>}
          {metadata?.releaseDate && <span className="rom-date">{metadata.releaseDate}</span>}
          {metadata?.genre && <span className="rom-genre">{metadata.genre}</span>}
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}
