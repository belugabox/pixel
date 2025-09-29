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
  const [favored, setFavored] = useState<boolean>(false);

  const toFileUrl = (absPath: string) => {
    if (!absPath) return '';
    if (absPath.startsWith('file://')) return absPath;
    const normalized = absPath.replace(/\\/g, '/');
    return 'file:///' + encodeURI(normalized);
  };
  const isRemote = (url: string | undefined | null) => !!url && /^(https?:)?\/\//i.test(url);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const meta = await window.metadata.get(fileName, systemId);
        setMetadata(meta);
        // Load favorite state
        try {
          const isFav = await window.favorites.is(systemId, fileName);
          setFavored(isFav);
        } catch (e) {
          // ignore favorite state load error (non-blocking)
        }
      } catch (e) {
        console.error('Error checking metadata:', e);
        setError('Erreur lors de la vérification des métadonnées');
      }
    })();
  }, [fileName, systemId]);

  useEffect(() => {
    (async () => {
      const imgs = metadata?.images;
      const pickLocal = async (p: string) => {
        const dataUri = await window.image.load(p);
        return dataUri || toFileUrl(p);
      };
      if (imgs?.cover) {
        setCoverSrc(isRemote(imgs.cover) ? imgs.cover : await pickLocal(imgs.cover));
      } else {
        setCoverSrc(null);
      }
    })();
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

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await window.favorites.toggle(systemId, fileName);
      if (res.ok) setFavored(res.favored);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  return (
    <div
      className="rom-tile"
      data-file={fileName}
      data-system={systemId}
      onClick={launch}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') launch();
      }}
    >
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={metadata?.name || fileName}
          className="rom-cover"
          onError={() => {
            // Strict: uniquement cover, pas de fallback
            setCoverSrc(null);
          }}
        />
      ) : (
        <div className="rom-cover" aria-hidden="true" />
      )}

      <div className="rom-info">
        <h3 className="rom-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>{metadata?.name || fileName}</span>
          <button
            className="fav-btn"
            aria-label={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleFavorite}
          >
            {favored ? '★' : '☆'}
          </button>
        </h3>



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
