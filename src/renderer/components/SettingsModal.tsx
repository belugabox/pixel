import React, { useEffect, useState } from 'react';
import type { UserConfig } from '../types';

export function SettingsModal({ cfg, onClose, onSave }:
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
    <div className="modal-content">
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
