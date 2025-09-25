import { useEffect, useState } from 'react';

export type GamepadInfo = {
  index: number;
  id: string;
  connected: boolean;
  buttons: boolean[];
  axes: number[];
  mapping: string;
  timestamp: number;
};

export type GamepadStatus = {
  pads: GamepadInfo[];
  globalWatcherActive: boolean | null;
  lastUpdate: number;
};

export function useGamepadStatus() {
  const [status, setStatus] = useState<GamepadStatus>({
    pads: [],
    globalWatcherActive: null,
    lastUpdate: 0,
  });

  useEffect(() => {
    let active = true;
    let rafId: number;

    const poll = () => {
      if (!active) return;

      try {
        const raw = navigator.getGamepads ? navigator.getGamepads() : [];
        const pads: GamepadInfo[] = [];

        // Convert gamepads to our format, including null/disconnected slots
        for (let i = 0; i < raw.length; i++) {
          const gp = raw[i];
          if (gp) {
            pads.push({
              index: gp.index,
              id: gp.id,
              connected: gp.connected,
              buttons: gp.buttons.map(b => b.pressed),
              axes: Array.from(gp.axes),
              mapping: gp.mapping || 'unknown',
              timestamp: gp.timestamp,
            });
          }
        }

        setStatus(prev => ({
          ...prev,
          pads,
          lastUpdate: performance.now(),
        }));
      } catch (error) {
        console.warn('Error polling gamepads:', error);
      }

      rafId = requestAnimationFrame(poll);
    };

    // Start polling
    poll();

    return () => {
      active = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Poll global watcher status periodically
  useEffect(() => {
    let active = true;
    let timeoutId: number;

    const checkGlobalWatcher = async () => {
      if (!active) return;
      
      try {
        if (window.gamepad?.isGlobalActive) {
          const isActive = await window.gamepad.isGlobalActive();
          if (active) {
            setStatus(prev => ({
              ...prev,
              globalWatcherActive: isActive,
            }));
          }
        }
      } catch (error) {
        console.warn('Error checking global watcher status:', error);
        if (active) {
          setStatus(prev => ({
            ...prev,
            globalWatcherActive: null,
          }));
        }
      }

      if (active) {
        timeoutId = window.setTimeout(checkGlobalWatcher, 5000);
      }
    };

    // Initial check
    checkGlobalWatcher();

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return status;
}