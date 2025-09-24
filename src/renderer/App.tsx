import React, { useEffect, useMemo, useState } from 'react';

type UserConfig = {
  romsRoot: string;
  emulatorsRoot: string;
  toolsRoot?: string;
};

type View = { name: 'systems' } | { name: 'roms'; system: string };

function useUserConfig() {
  const [cfg, setCfg] = useState<UserConfig | null>(null);
  const refresh = async () => {
    const c = await (window as any).config.get();
    setCfg(c);
  };
  useEffect(() => { void refresh(); }, []);
  const save = async (next: UserConfig) => {
    await (window as any).config.set(next);
    await refresh();
  };
  return { cfg, save, refresh } as const;
}

function Systems({ onOpen }: { onOpen: (system: string) => void }) {
  const [systems, setSystems] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const folders: string[] = await (window as any).roms?.list?.();
      setSystems(folders ?? []);
    })();
  }, []);
  return (
    <section id="systems-screen">
      <h2>Systèmes détectés</h2>
      <div id="systems" className="systems-row">
        {systems.map((name) => (
          <button
            key={name}
            className="system-tile"
            onClick={() => onOpen(name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); onOpen(name);
              }
            }}
          >
            <h3>{name}</h3>
          </button>
        ))}
      </div>
    </section>
  );
}

function Roms({ system, onBack }: { system: string; onBack: () => void }) {
  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const f: string[] = await (window as any).roms?.listFiles?.(system);
      setFiles(f ?? []);
    })();
  }, [system]);
  return (
    <section id="roms-screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button id="back-btn" className="back-btn" onClick={onBack}>← Retour</button>
        <h2 id="roms-title" style={{ margin: '0 0 0 auto' }}>ROMs - {system} ({files.length})</h2>
      </div>
      <div id="roms" className="systems-row">
        {files.length === 0 ? (
          <div className="empty-state">Aucune ROM trouvée pour ce système.</div>
        ) : files.map((file) => (
          <button key={file} className="system-tile" onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
          }}>
            <h3>{file}</h3>
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button id="settings-btn" className="settings-btn" title="Paramètres" aria-label="Paramètres" onClick={onOpen}>⚙️</button>
  );
}

function SettingsModal({ cfg, onClose, onSave }:
  { cfg: UserConfig | null; onClose: () => void; onSave: (c: UserConfig) => void }) {
  const [local, setLocal] = useState<UserConfig>({
    romsRoot: cfg?.romsRoot ?? '',
    emulatorsRoot: cfg?.emulatorsRoot ?? '',
    toolsRoot: cfg?.toolsRoot ?? ''
  });
  useEffect(() => {
    setLocal({
      romsRoot: cfg?.romsRoot ?? '',
      emulatorsRoot: cfg?.emulatorsRoot ?? '',
      toolsRoot: cfg?.toolsRoot ?? ''
    });
  }, [cfg]);
  return (
    <div>
      <h2 id="settings-title">Paramètres</h2>
      <form onSubmit={(e) => { e.preventDefault(); onSave(local); onClose(); }}>
        <div className="form-row">
          <label htmlFor="roms-root">Dossier ROMs (romsRoot)</label>
          <div className="input-row">
            <input id="roms-root" value={local.romsRoot} onChange={(e) => setLocal({ ...local, romsRoot: e.target.value })} />
            <button type="button" className="secondary" onClick={async () => {
              const dir = await (window as any).dialog?.selectDirectory?.();
              if (dir) setLocal({ ...local, romsRoot: dir });
            }}>Parcourir…</button>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="emulators-root">Dossier émulateurs (emulatorsRoot)</label>
          <div className="input-row">
            <input id="emulators-root" value={local.emulatorsRoot} onChange={(e) => setLocal({ ...local, emulatorsRoot: e.target.value })} />
            <button type="button" className="secondary" onClick={async () => {
              const dir = await (window as any).dialog?.selectDirectory?.();
              if (dir) setLocal({ ...local, emulatorsRoot: dir });
            }}>Parcourir…</button>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="tools-root">Dossier outils (toolsRoot)</label>
          <div className="input-row">
            <input id="tools-root" value={local.toolsRoot ?? ''} onChange={(e) => setLocal({ ...local, toolsRoot: e.target.value })} />
            <button type="button" className="secondary" onClick={async () => {
              const dir = await (window as any).dialog?.selectDirectory?.();
              if (dir) setLocal({ ...local, toolsRoot: dir });
            }}>Parcourir…</button>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>Annuler (Esc)</button>
          <button type="submit" className="primary">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

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
      {showSettings && (
        <div
          id="settings-modal"
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{ display: 'flex' }}
          onClick={() => setShowSettings(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SettingsModal
              cfg={cfg}
              onClose={() => setShowSettings(false)}
              onSave={async (c) => { await save(c); await refresh(); }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
