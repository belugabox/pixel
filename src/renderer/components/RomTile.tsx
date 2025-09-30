import React, { useEffect, useRef, useState } from 'react';
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
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [wheelSrc, setWheelSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const focusTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
        } catch {
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
      // Background: screenshot
      if (imgs?.screenshot) {
        setScreenshotSrc(isRemote(imgs.screenshot) ? imgs.screenshot : await pickLocal(imgs.screenshot));
      } else {
        setScreenshotSrc(null);
      }
      // Overlay: wheel
      if (imgs?.wheel) {
        setWheelSrc(isRemote(imgs.wheel) ? imgs.wheel : await pickLocal(imgs.wheel));
      } else {
        setWheelSrc(null);
      }
      // Video (normalized)
      const v = metadata?.videos?.normalized;
      if (v) {
        if (isRemote(v)) {
          setVideoSrc(v);
        } else {
          // Load local video as data URL to avoid file:/// CSP restrictions
          try {
            const dataUri = await window.video.load(v);
            setVideoSrc(dataUri || null);
          } catch {
            setVideoSrc(null);
          }
        }
      } else {
        setVideoSrc(null);
      }
    })();
  }, [metadata, systemId]);

  // Handle focus-based delayed video reveal
  useEffect(() => {
    // Clear any pending timer
    if (focusTimerRef.current) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    if (isFocused && videoSrc) {
      focusTimerRef.current = window.setTimeout(() => {
        setShowVideo(true);
      }, 500);
    } else {
      // Hide video immediately when losing focus or no video
      setShowVideo(false);
    }
    return () => {
      if (focusTimerRef.current) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isFocused, videoSrc]);

  // Pause/reset video when hidden
  useEffect(() => {
    if (!showVideo && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, [showVideo]);

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
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') launch();
      }}
    >
      {!showVideo && screenshotSrc ? (
        <img
          src={screenshotSrc}
          alt={metadata?.name || fileName}
          className="rom-bg"
          onError={() => setScreenshotSrc(null)}
        />
      ) : (
        !showVideo && <div className="rom-bg" aria-hidden="true" />
      )}

      {!showVideo && wheelSrc && (
        <img
          src={wheelSrc}
          alt="wheel"
          className="rom-wheel"
          onError={() => setWheelSrc(null)}
          draggable={false}
        />
      )}

      {showVideo && videoSrc && (
        <video
          ref={videoRef}
          className="rom-video"
          src={videoSrc}
          muted
          loop
          autoPlay
          playsInline
        />
      )}

      <button
        className="fav-btn overlay"
        aria-label={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        title={favored ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleFavorite}
      >
        {favored ? '★' : '☆'}
      </button>

      <div className="rom-caption">
        <span className="rom-caption-text">{metadata?.name || fileName}</span>
      </div>

      {error && <div className="error-message" style={{ position: 'absolute', left: 8, top: 8 }}>{error}</div>}
    </div>
  );
}
