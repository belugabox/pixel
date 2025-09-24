import React, { useEffect, useState } from 'react';
import type { UserConfig } from '../types';

export function SettingsModal({ cfg, onClose, onSave }:
  { cfg: UserConfig | null; onClose: () => void; onSave: (c: UserConfig) => void }) {
  const [local, setLocal] = useState<UserConfig>({
    romsRoot: cfg?.romsRoot ?? '',
    emulatorsRoot: cfg?.emulatorsRoot ?? '',
    toolsRoot: cfg?.toolsRoot ?? '',
    scrapers: {
      screenscraper: {
        ssid: cfg?.scrapers?.screenscraper?.ssid ?? '',
        sspassword: cfg?.scrapers?.screenscraper?.sspassword ?? ''
      }
    }
  });

  useEffect(() => {
    setLocal({
      romsRoot: cfg?.romsRoot ?? '',
      emulatorsRoot: cfg?.emulatorsRoot ?? '',
      toolsRoot: cfg?.toolsRoot ?? '',
      scrapers: {
        screenscraper: {
          ssid: cfg?.scrapers?.screenscraper?.ssid ?? '',
          sspassword: cfg?.scrapers?.screenscraper?.sspassword ?? ''
        }
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
          <label htmlFor="ss-ssid">Nom d'utilisateur ScreenScraper</label>
          <input 
            id="ss-ssid" 
            value={local.scrapers?.screenscraper?.ssid ?? ''} 
            onChange={(e) => setLocal({ 
              ...local, 
              scrapers: { 
                ...local.scrapers, 
                screenscraper: { 
                  ...local.scrapers?.screenscraper, 
                  ssid: e.target.value 
                } 
              }
            })} 
          />
        </div>
        <div className="form-row">
          <label htmlFor="ss-sspassword">Mot de passe ScreenScraper</label>
          <input 
            id="ss-sspassword" 
            type="password"
            value={local.scrapers?.screenscraper?.sspassword ?? ''} 
            onChange={(e) => setLocal({ 
              ...local, 
              scrapers: { 
                ...local.scrapers, 
                screenscraper: { 
                  ...local.scrapers?.screenscraper, 
                  sspassword: e.target.value 
                } 
              }
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
