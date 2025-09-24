import React, { useEffect, useState } from 'react';

interface GameMetadata {
  id: string;
  name: string;
  description?: string;
  releaseDate?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
  players?: string;
  rating?: string;
  images: {
    cover?: string;
    screenshot?: string;
    title?: string;
  };
}

interface RomTileProps {
  fileName: string;
  systemId: string;
}

export function RomTile({ fileName, systemId }: RomTileProps) {
  const [metadata, setMetadata] = useState<GameMetadata | null>(null);
  const [hasMetadata, setHasMetadata] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkMetadata();
  }, [fileName, systemId]);

  const checkMetadata = async () => {
    try {
      setError(null);
      const exists = await (window as any).metadata?.has?.(fileName, systemId);
      setHasMetadata(exists);
      
      if (exists) {
        const meta = await (window as any).metadata?.get?.(fileName, systemId);
        setMetadata(meta);
      }
    } catch (error) {
      console.error('Error checking metadata:', error);
      setError('Erreur lors de la vérification des métadonnées');
    }
  };

  const downloadMetadata = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const meta = await (window as any).metadata?.download?.(fileName, systemId);
      if (meta) {
        setMetadata(meta);
        setHasMetadata(true);
      } else {
        setError('Aucune métadonnée trouvée');
      }
    } catch (error) {
      console.error('Error downloading metadata:', error);
      setError('Erreur lors du téléchargement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rom-tile">
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
              : metadata.description
            }
          </p>
        )}
        
        <div className="rom-details">
          {metadata?.developer && <span className="rom-developer">{metadata.developer}</span>}
          {metadata?.releaseDate && <span className="rom-date">{metadata.releaseDate}</span>}
          {metadata?.genre && <span className="rom-genre">{metadata.genre}</span>}
        </div>
        
        {!hasMetadata && (
          <div>
            <button 
              className="download-metadata-btn"
              onClick={downloadMetadata}
              disabled={isLoading}
            >
              {isLoading ? 'Téléchargement...' : 'Télécharger métadonnées'}
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}