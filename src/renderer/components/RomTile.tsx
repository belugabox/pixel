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

  useEffect(() => {
    checkMetadata();
  }, [fileName, systemId]);

  const checkMetadata = async () => {
    try {
      const exists = await (window as any).metadata?.has?.(fileName, systemId);
      setHasMetadata(exists);
      
      if (exists) {
        const meta = await (window as any).metadata?.get?.(fileName, systemId);
        setMetadata(meta);
      }
    } catch (error) {
      console.error('Error checking metadata:', error);
    }
  };

  const downloadMetadata = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const meta = await (window as any).metadata?.download?.(fileName, systemId);
      if (meta) {
        setMetadata(meta);
        setHasMetadata(true);
      }
    } catch (error) {
      console.error('Error downloading metadata:', error);
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
          <button 
            className="download-metadata-btn"
            onClick={downloadMetadata}
            disabled={isLoading}
          >
            {isLoading ? 'Téléchargement...' : 'Télécharger métadonnées'}
          </button>
        )}
      </div>
    </div>
  );
}