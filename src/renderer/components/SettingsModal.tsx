import React, { useEffect, useState } from 'react';
import type { UserConfig } from '../types';

export function SettingsModal({ cfg, onClose, onSave }:
  { cfg: UserConfig | null; onClose: () => void; onSave: (c: UserConfig) => void }) {
  const [local, setLocal] = useState<UserConfig>({
    romsRoot: cfg?.romsRoot ?? '',
    emulatorsRoot: cfg?.emulatorsRoot ?? '',
    toolsRoot: cfg?.toolsRoot ?? '',
    screenscraper: {
      devId: cfg?.screenscraper?.devId ?? '',
      devPassword: cfg?.screenscraper?.devPassword ?? '',
      softname: cfg?.screenscraper?.softname ?? 'pixel-frontend',
      ssid: cfg?.screenscraper?.ssid ?? '',
      sspassword: cfg?.screenscraper?.sspassword ?? ''
    }
  });

  useEffect(() => {
    setLocal({
      romsRoot: cfg?.romsRoot ?? '',
      emulatorsRoot: cfg?.emulatorsRoot ?? '',
      toolsRoot: cfg?.toolsRoot ?? '',
      screenscraper: {
        devId: cfg?.screenscraper?.devId ?? '',
        devPassword: cfg?.screenscraper?.devPassword ?? '',
        softname: cfg?.screenscraper?.softname ?? 'pixel-frontend',
        ssid: cfg?.screenscraper?.ssid ?? '',
        sspassword: cfg?.screenscraper?.sspassword ?? ''
      }
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
              const dir = await window.dialog.selectDirectory();
              if (dir) setLocal({ ...local, romsRoot: dir });
            }}>…</button>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="emulators-root">Dossier émulateurs (emulatorsRoot)</label>
          <div className="input-row">
            <input id="emulators-root" value={local.emulatorsRoot} onChange={(e) => setLocal({ ...local, emulatorsRoot: e.target.value })} />
            <button type="button" className="secondary" onClick={async () => {
              const dir = await window.dialog.selectDirectory();
              if (dir) setLocal({ ...local, emulatorsRoot: dir });
            }}>…</button>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="tools-root">Dossier outils (toolsRoot)</label>
          <div className="input-row">
            <input id="tools-root" value={local.toolsRoot ?? ''} onChange={(e) => setLocal({ ...local, toolsRoot: e.target.value })} />
            <button type="button" className="secondary" onClick={async () => {
              const dir = await window.dialog.selectDirectory();
              if (dir) setLocal({ ...local, toolsRoot: dir });
            }}>…</button>
          </div>
        </div>
        
        <h3>Configuration ScreenScraper</h3>
        <div className="form-row">
          <label htmlFor="ss-devid">Dev ID</label>
          <input 
            id="ss-devid" 
            value={local.screenscraper?.devId ?? ''} 
            onChange={(e) => setLocal({ 
              ...local, 
              screenscraper: { ...local.screenscraper, devId: e.target.value } 
            })} 
          />
        </div>
        <div className="form-row">
          <label htmlFor="ss-devpassword">Dev Password</label>
          <input 
            id="ss-devpassword" 
            type="password"
            value={local.screenscraper?.devPassword ?? ''} 
            onChange={(e) => setLocal({ 
              ...local, 
              screenscraper: { ...local.screenscraper, devPassword: e.target.value } 
            })} 
          />
        </div>
        <div className="form-row">
          <label htmlFor="ss-ssid">Nom d'utilisateur ScreenScraper</label>
          <input 
            id="ss-ssid" 
            value={local.screenscraper?.ssid ?? ''} 
            onChange={(e) => setLocal({ 
              ...local, 
              screenscraper: { ...local.screenscraper, ssid: e.target.value } 
            })} 
          />
        </div>
        <div className="form-row">
          <label htmlFor="ss-sspassword">Mot de passe ScreenScraper</label>
          <input 
            id="ss-sspassword" 
            type="password"
            value={local.screenscraper?.sspassword ?? ''} 
            onChange={(e) => setLocal({ 
              ...local, 
              screenscraper: { ...local.screenscraper, sspassword: e.target.value } 
            })} 
          />
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={onClose}>Annuler (Esc)</button>
          <button type="submit" className="primary">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
