import React, { useEffect, useState } from 'react';
import { GameMetadata } from '../types';
import { useToast } from './Toast';

interface RomTileProps {
  fileName: string;
  systemId: string;
}

export function RomTile({ fileName, systemId }: RomTileProps) {
  const [metadata, setMetadata] = useState<GameMetadata | null>(null);
  const [hasMetadata, setHasMetadata] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // metadata-only errors
  const { show } = useToast();

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const exists = await window.metadata.has(fileName, systemId);
        setHasMetadata(exists);
        if (exists) {
          const meta = await window.metadata.get(fileName, systemId);
          setMetadata(meta);
        }
      } catch (e) {
        console.error('Error checking metadata:', e);
        setError('Erreur lors de la vérification des métadonnées');
      }
    })();
  }, [fileName, systemId]);

  const downloadMetadata = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const meta = await window.metadata.download(fileName, systemId);
      if (meta) {
        setMetadata(meta);
        setHasMetadata(true);
      } else {
        setError('Aucune métadonnée trouvée');
      }
    } catch (e) {
      console.error('Error downloading metadata:', e);
      setError('Erreur lors du téléchargement');
    } finally {
      setIsLoading(false);
    }
  };

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
      {metadata?.images?.cover && (
        <img
          src={`file://${metadata.images.cover}`}
          alt={metadata.name}
          className="rom-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
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

        {!hasMetadata ? (
          <div>
            <button
              className="download-metadata-btn"
              onClick={(e) => { e.stopPropagation(); downloadMetadata(); }}
              disabled={isLoading}
            >
              {isLoading ? 'Téléchargement...' : 'Télécharger métadonnées'}
            </button>
          </div>
        ) : (
          <button
            className="download-metadata-btn"
            onClick={(e) => { e.stopPropagation(); launch(); }}
          >
            Lancer
          </button>
        )}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}
