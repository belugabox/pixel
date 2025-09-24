import React, { useEffect, useState } from 'react';
import type { UserConfig } from '../types';

export function SettingsModal({ cfg, onClose, onSave }:
  { cfg: UserConfig | null; onClose: () => void; onSave: (c: UserConfig) => void }) {
  const [local, setLocal] = useState<UserConfig>({
    romsRoot: cfg?.romsRoot ?? '',
    emulatorsRoot: cfg?.emulatorsRoot ?? '',
    toolsRoot: cfg?.toolsRoot ?? '',
    scrapers: {
      default: cfg?.scrapers?.default ?? 'igdb',
      screenscraper: {
        ssid: cfg?.scrapers?.screenscraper?.ssid ?? '',
        sspassword: cfg?.scrapers?.screenscraper?.sspassword ?? '',
        devid: cfg?.scrapers?.screenscraper?.devid ?? '',
        devpassword: cfg?.scrapers?.screenscraper?.devpassword ?? '',
        softname: cfg?.scrapers?.screenscraper?.softname ?? 'pixel'
      },
      igdb: {
        clientId: cfg?.scrapers?.igdb?.clientId ?? '',
        clientSecret: cfg?.scrapers?.igdb?.clientSecret ?? ''
      }
    }
  });

  useEffect(() => {
    setLocal({
      romsRoot: cfg?.romsRoot ?? '',
      emulatorsRoot: cfg?.emulatorsRoot ?? '',
      toolsRoot: cfg?.toolsRoot ?? '',
      scrapers: {
        default: cfg?.scrapers?.default ?? 'igdb',
        screenscraper: {
          ssid: cfg?.scrapers?.screenscraper?.ssid ?? '',
          sspassword: cfg?.scrapers?.screenscraper?.sspassword ?? '',
          devid: cfg?.scrapers?.screenscraper?.devid ?? '',
          devpassword: cfg?.scrapers?.screenscraper?.devpassword ?? '',
          softname: cfg?.scrapers?.screenscraper?.softname ?? 'pixel'
        },
        igdb: {
          clientId: cfg?.scrapers?.igdb?.clientId ?? '',
          clientSecret: cfg?.scrapers?.igdb?.clientSecret ?? ''
        }
      }
    });
  }, [cfg]);

  return (
    <div className="modal-content">
      <h2 id="settings-title">Paramètres</h2>
      <form onSubmit={(e) => { e.preventDefault(); onSave(local); onClose(); }}>
        <h3>Général</h3>
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

        <h3>Scraper par défaut</h3>
        <div className="form-row">
          <label htmlFor="scraper-default">Scraper par défaut</label>
          <select
            id="scraper-default"
            value={local.scrapers?.default ?? 'igdb'}
            onChange={(e) => setLocal({
              ...local,
              scrapers: {
                ...local.scrapers,
                default: (e.target.value as 'igdb' | 'screenscraper')
              }
            })}
          >
            <option value="igdb">IGDB</option>
            <option value="screenscraper">ScreenScraper</option>
          </select>
        </div>

        <h3>Configuration IGDB</h3>
        <div className="form-row">
          <label htmlFor="igdb-client-id">Client ID (IGDB/Twitch)</label>
          <input
            id="igdb-client-id"
            value={local.scrapers?.igdb?.clientId ?? ''}
            onChange={(e) => setLocal({
              ...local,
              scrapers: {
                ...local.scrapers,
                igdb: {
                  ...local.scrapers?.igdb,
                  clientId: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="form-row">
          <label htmlFor="igdb-client-secret">Client Secret (IGDB/Twitch)</label>
          <input
            id="igdb-client-secret"
            type="password"
            value={local.scrapers?.igdb?.clientSecret ?? ''}
            onChange={(e) => setLocal({
              ...local,
              scrapers: {
                ...local.scrapers,
                igdb: {
                  ...local.scrapers?.igdb,
                  clientSecret: e.target.value
                }
              }
            })}
          />
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
        <div className="form-row">
          <label htmlFor="ss-devid">ID développeur ScreenScraper (optionnel)</label>
          <input
            id="ss-devid"
            value={local.scrapers?.screenscraper?.devid ?? ''}
            onChange={(e) => setLocal({
              ...local,
              scrapers: {
                ...local.scrapers,
                screenscraper: {
                  ...local.scrapers?.screenscraper,
                  devid: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="form-row">
          <label htmlFor="ss-devpassword">Mot de passe développeur ScreenScraper (optionnel)</label>
          <input
            id="ss-devpassword"
            type="password"
            value={local.scrapers?.screenscraper?.devpassword ?? ''}
            onChange={(e) => setLocal({
              ...local,
              scrapers: {
                ...local.scrapers,
                screenscraper: {
                  ...local.scrapers?.screenscraper,
                  devpassword: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="form-row">
          <label htmlFor="ss-softname">Nom du logiciel (softname)</label>
          <input
            id="ss-softname"
            value={local.scrapers?.screenscraper?.softname ?? 'pixel'}
            onChange={(e) => setLocal({
              ...local,
              scrapers: {
                ...local.scrapers,
                screenscraper: {
                  ...local.scrapers?.screenscraper,
                  softname: e.target.value || 'pixel'
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
