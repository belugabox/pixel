import React, { useEffect, useState } from 'react';
import type { View } from './types';
import { useUserConfig } from './hooks/useUserConfig';
import { Systems } from './components/Systems';
import { Roms } from './components/Roms';
import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { QuitButton } from './components/QuitButton';

export default function App() {
  const { cfg, save, refresh } = useUserConfig();
  const [view, setView] = useState<View>({ name: 'systems' });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings) { setShowSettings(false); return; }
        if (view.name === 'roms') { setView({ name: 'systems' }); return; }
        setShowSettings(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showSettings, view]);

  return (
    <main>
      <h1>Pixel</h1>
      {view.name === 'systems' && (
        <Systems onOpen={(sys) => setView({ name: 'roms', system: sys })} />
      )}
      {view.name === 'roms' && (
        <Roms system={view.system} onBack={() => setView({ name: 'systems' })} />
      )}

  <SettingsButton onOpen={() => setShowSettings(true)} />
  <QuitButton />
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
