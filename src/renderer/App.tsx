import React, { useEffect, useRef, useState } from 'react';
import type { View } from './types';
import { useUserConfig } from './hooks/useUserConfig';
import { Systems } from './components/Systems';
import { Roms } from './components/Roms';
import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { useToast } from './components/Toast';

export default function App() {
  const { cfg, save, refresh } = useUserConfig();
  const [view, setView] = useState<View>({ name: 'systems' });
  const [showSettings, setShowSettings] = useState(false);
  const { show } = useToast();
  const lastKillRef = useRef(0);
  const RAF_REF = useRef(0);
  const COMBO_HOLD_MS = 200; // shorter hold for better responsiveness
  const comboStartRef = useRef<number | null>(null);
  const comboTriggeredRef = useRef(false);
  const [debugPad, setDebugPad] = useState(false);
  const [padState, setPadState] = useState<{ ts: number; pads: Array<{ index: number; id: string; buttons: boolean[]; select: boolean; start: boolean }> }>({ ts: 0, pads: [] });
  const [globalWatcher, setGlobalWatcher] = useState<boolean | null>(null);
  const [lastSystemIndex, setLastSystemIndex] = useState<number>(0);

  // Detect Start+Select (typical buttons 9 + 8, with alternative indices) + optional debug overlay
  useEffect(() => {
    let active = true;
    const SELECT_CANDIDATES = [8, 6]; // 8 standard, 6 some alt mappings
    const START_CANDIDATES = [9, 7]; // 9 standard, 7 some alt mappings

    const poll = () => {
      if (!active) return;
      try {
        const raw = navigator.getGamepads ? navigator.getGamepads() : [];
        const pads = Array.from(raw || []).filter((g): g is Gamepad => !!g);
        let comboPressed = false;
        for (const gp of pads) {
          // Only trust standard mapping when available, but still allow if not declared
          const btns = gp.buttons;
          const selectPressed = SELECT_CANDIDATES.some(i => btns[i]?.pressed);
          const startPressed = START_CANDIDATES.some(i => btns[i]?.pressed);
          if (selectPressed && startPressed) { comboPressed = true; break; }
        }
        if (debugPad) {
          setPadState({
            ts: performance.now(),
            pads: pads.map(gp => ({
              index: gp.index,
              id: gp.id,
              buttons: gp.buttons.map(b => b.pressed),
              select: SELECT_CANDIDATES.some(i => gp.buttons[i]?.pressed),
              start: START_CANDIDATES.some(i => gp.buttons[i]?.pressed)
            }))
          });
        }
        const now = performance.now();
        if (comboPressed) {
          if (comboStartRef.current == null) {
            comboStartRef.current = now;
            comboTriggeredRef.current = false;
          }
          if (!comboTriggeredRef.current && now - comboStartRef.current >= COMBO_HOLD_MS) {
            if (now - lastKillRef.current > 2000) {
              lastKillRef.current = now;
              comboTriggeredRef.current = true;
              // Local (renderer) detection fallback; native watcher will also emit its own event
              (async () => {
                const res = await window.roms.killActive();
                if (res.ok) show('Émulateur arrêté (Start+Select)'); else show(res.error || 'Aucun émulateur actif', 'error');
              })();
            }
          }
        } else {
          comboStartRef.current = null;
          comboTriggeredRef.current = false;
        }
      } catch (e) {
        // ignore polling errors
      }
      RAF_REF.current = requestAnimationFrame(poll);
    };
    RAF_REF.current = requestAnimationFrame(poll);
    return () => { active = false; cancelAnimationFrame(RAF_REF.current); };
  }, []);

  // Subscribe to native global combo (Option B) to show toast feedback even if emulator had focus
  useEffect(() => {
    if (!window.gamepad?.onGlobalCombo) return;
    const off = window.gamepad.onGlobalCombo(() => {
      show('Combo Start+Select détectée (global)');
    });
    return () => off();
  }, []);

  // Query global watcher status once and then every 5s while overlay visible
  useEffect(() => {
  let t: number | undefined;
    const tick = async () => {
      if (window.gamepad?.isGlobalActive) {
        try { setGlobalWatcher(await window.gamepad.isGlobalActive()); } catch { /* ignore */ }
      }
  t = window.setTimeout(tick, 5000);
    };
    if (debugPad) { tick(); }
    return () => { if (t) clearTimeout(t); };
  }, [debugPad]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'g') {
        setDebugPad(d => !d);
        return;
      }
      if (e.key === 'Escape') {
        if (showSettings) { setShowSettings(false); return; }
        if (view.name === 'roms') { setView({ name: 'systems' }); return; }
        setShowSettings(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showSettings, view]);

  // Appliquer le thème depuis la configuration
  useEffect(() => {
    if (cfg?.theme) {
      document.body.setAttribute('data-theme', cfg.theme);
    } else {
      document.body.setAttribute('data-theme', 'retro');
    }
  }, [cfg?.theme]);

  return (
    <main>
      <h1>Pixel</h1>
      {debugPad && (
        <div style={{ position: 'fixed', bottom: 8, left: 8, background: 'rgba(0,0,0,0.75)', padding: '8px 10px', fontSize: '10px', zIndex: 3000, maxWidth: 480, lineHeight: 1.3 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Gamepad Debug (Ctrl+Alt+G)</div>
          <div style={{ marginBottom: 4, color: globalWatcher ? '#1ec31e' : '#ffaa00' }}>
            Global watcher: {globalWatcher == null ? '...' : (globalWatcher ? 'actif' : 'fallback renderer')}
          </div>
          {padState.pads.length === 0 && <div>Aucune manette détectée</div>}
          {padState.pads.map(p => (
            <div key={p.index} style={{ marginBottom: 6 }}>
              <div style={{ color: '#ff156d' }}>#{p.index} {p.id}</div>
              <div>Start: {p.start ? 'ON' : 'off'} | Select: {p.select ? 'ON' : 'off'}</div>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>Boutons: {p.buttons.map((b, i) => b ? i : '.').join(' ')}</div>
              {comboStartRef.current && (<div>Hold ms: {Math.round(performance.now() - (comboStartRef.current || 0))}</div>)}
            </div>
          ))}
        </div>
      )}
      {view.name === 'systems' && (
        <Systems
          initialIndex={lastSystemIndex}
          onOpen={(sys, index) => {
            setLastSystemIndex(index);
            setView({ name: 'roms', system: sys });
          }}
        />
      )}
      {view.name === 'roms' && (
        <Roms system={view.system} onBack={() => setView({ name: 'systems' })} />
      )}

  <SettingsButton onOpen={() => setShowSettings(true)} />
      {showSettings && (
        <div
          id="settings-modal"
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{ display: 'flex' }}
        >
          <SettingsModal
            cfg={cfg}
            onClose={() => setShowSettings(false)}
            onSave={async (c) => { await save(c); await refresh(); }}
          />
        </div>
      )}
    </main>
  );
}
