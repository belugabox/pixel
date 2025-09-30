import React, { useEffect, useMemo, useState } from 'react';
import { useInputNavigation } from '../hooks/useInputNavigation';
import type { UserConfig, AllDownloadResult } from '../types';
import { useToast } from './Toast';
import { ManettesSection } from './ManettesSection';

export function SettingsModal({ cfg, onClose, onSave }:
  { cfg: UserConfig | null; onClose: () => void; onSave: (c: UserConfig) => void }) {
  const [local, setLocal] = useState<UserConfig>({
    romsRoot: cfg?.romsRoot ?? '',
    emulatorsRoot: cfg?.emulatorsRoot ?? '',
    toolsRoot: cfg?.toolsRoot ?? '',
    theme: cfg?.theme ?? 'retro',
    updatesBeta: cfg?.updatesBeta ?? false,
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

  const [section, setSection] = useState<'menu' | 'configuration' | 'scrapers' | 'scraping' | 'themes' | 'manettes' | 'updates' | 'quitter'>('menu');
  const [isScraping, setIsScraping] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const { show } = useToast();
  const [progress, setProgress] = useState<{ systemId: string; current: number; total: number; fileName: string } | null>(null);
  const [scrapeResult, setScrapeResult] = useState<AllDownloadResult | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<null | { version: string; notes: string; url: string }>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");

  useEffect(() => {
    const off = window.metadata.onProgress((p) => setProgress(p));
    return () => off();
  }, []);

  useEffect(() => {
    (async () => {
      try { setCurrentVersion(await window.app.version()); } catch { /* ignore */ }
    })();
  }, []);

  // Wire updater events when updates screen is active
  useEffect(() => {
    if (section !== 'updates') return;
    const offAvail = window.updates.onAvailable(() => {/* no-op, we show info after manual check */ });
    const offNotAvail = window.updates.onNotAvailable(() => {/* no-op */ });
    const offErr = window.updates.onError((msg) => {
      setDownloading(false);
      setDownloaded(false);
      setDownloadProgress(null);
      show(msg || 'Erreur de mise à jour', 'error');
    });
    const offProg = window.updates.onProgress((p: unknown) => {
      // electron-updater provides {percent, transferred, total, bytesPerSecond}
      const rec = (p && typeof p === 'object') ? (p as Record<string, unknown>) : null;
      const pct = rec && typeof rec.percent === 'number' ? (rec.percent as number) : null;
      setDownloadProgress(pct);
    });
    const offDl = window.updates.onDownloaded(() => {
      setDownloading(false);
      setDownloaded(true);
      setDownloadProgress(100);
    });
    return () => {
      offAvail();
      offNotAvail();
      offErr();
      offProg();
      offDl();
    };
  }, [section, show]);

  const normalize = (c: UserConfig | null) => ({
    romsRoot: c?.romsRoot ?? '',
    emulatorsRoot: c?.emulatorsRoot ?? '',
    toolsRoot: c?.toolsRoot ?? '',
    theme: c?.theme ?? 'retro',
    updatesBeta: c?.updatesBeta ?? false,
    scrapers: {
      default: c?.scrapers?.default ?? 'igdb',
      igdb: {
        clientId: c?.scrapers?.igdb?.clientId ?? '',
        clientSecret: c?.scrapers?.igdb?.clientSecret ?? '',
      },
      screenscraper: {
        ssid: c?.scrapers?.screenscraper?.ssid ?? '',
        sspassword: c?.scrapers?.screenscraper?.sspassword ?? '',
        devid: c?.scrapers?.screenscraper?.devid ?? '',
        devpassword: c?.scrapers?.screenscraper?.devpassword ?? '',
        softname: c?.scrapers?.screenscraper?.softname ?? 'pixel',
      },
    },
  });

  const isDirty = useMemo(() => {
    try {
      const a = JSON.stringify(normalize(cfg));
      const b = JSON.stringify(normalize(local));
      return a !== b;
    } catch {
      return true;
    }
  }, [cfg, local]);

  // Keyboard/gamepad navigation for the menu screen
  useInputNavigation({
    itemSelector: section === 'menu' ? '#settings-menu .menu-item' : '#__none__',
    scopeSelector: '.modal-content',
    mode: 'grid',
    // When on the menu screen: B closes the modal, Start closes the modal
    onBack: () => onClose(),
    onOpenSettings: () => onClose(),
    activeGuard: () => {
      // Active only when menu is visible
      const menu = document.getElementById('settings-menu');
      return !!menu && getComputedStyle(menu).display !== 'none';
    },
  });

  // When inside a screen, map ESC/B to go back to the menu
  useInputNavigation({
    itemSelector: '#__none__',
    scopeSelector: '.modal-content',
    mode: 'row',
    onBack: () => setSection('menu'),
    activeGuard: () => section !== 'menu',
  });

  // Add navigation between controls for Configuration and Scrapers screens
  useInputNavigation({
    itemSelector: '.settings-content input, .settings-content select, .settings-content button',
    scopeSelector: '.modal-content',
    mode: 'list',
    onBack: () => setSection('menu'),
    activeGuard: () => section === 'configuration' || section === 'scrapers' || section === 'scraping' || section === 'themes' || section === 'manettes' || section === 'updates',
  });

  useEffect(() => {
    if (section === 'menu') {
      const first = document.querySelector<HTMLElement>('#settings-menu .menu-item');
      first?.focus();
    } else if (section === 'configuration' || section === 'scrapers' || section === 'scraping' || section === 'themes' || section === 'manettes') {
      const firstField = document.querySelector<HTMLElement>('.settings-content input, .settings-content select, .settings-content button');
      firstField?.focus();
    }
  }, [section]);

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (section !== 'menu') setSection('menu');
      else onClose();
    }
  };

  // Capture ESC before the global document handler to avoid closing the modal
  useEffect(() => {
    const onKeyCapture = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape' && section !== 'menu') {
        evt.preventDefault();
        // Prevent other listeners (including App's) from handling this ESC
        evt.stopPropagation();
        setSection('menu');
      }
    };
    window.addEventListener('keydown', onKeyCapture, { capture: true });
    return () => window.removeEventListener('keydown', onKeyCapture, { capture: true } as AddEventListenerOptions);
  }, [section]);

  useEffect(() => {
    setLocal({
      romsRoot: cfg?.romsRoot ?? '',
      emulatorsRoot: cfg?.emulatorsRoot ?? '',
      toolsRoot: cfg?.toolsRoot ?? '',
      theme: cfg?.theme ?? 'retro',
      updatesBeta: cfg?.updatesBeta ?? false,
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

  // Credentials readiness (for visual badges)
  const igdbReady = !!(local.scrapers?.igdb?.clientId && local.scrapers?.igdb?.clientSecret);
  const ssUserReady = !!(local.scrapers?.screenscraper?.ssid && local.scrapers?.screenscraper?.sspassword);
  const ssDevReady = !!(local.scrapers?.screenscraper?.devid && local.scrapers?.screenscraper?.devpassword);
  const screenscraperReady = ssUserReady || ssDevReady;
  const badgeOkStyle: React.CSSProperties = { background: '#1b5e20', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: '0.65rem' };
  const badgeMissingStyle: React.CSSProperties = { background: '#7f1d1d', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: '0.65rem' };

  return (
    <div className="modal-content" onKeyDown={handleModalKeyDown}>
      <h2 id="settings-title">Paramètres</h2>
      {section === 'menu' && (
        <div className="settings-menu" id="settings-menu">
          <button className="menu-item" tabIndex={0} onClick={() => setSection('configuration')}>
            <div className="menu-title">Configuration</div>
            <div className="menu-desc">Dossiers ROMs, émulateurs, outils</div>
          </button>
          <button className="menu-item" tabIndex={0} onClick={() => setSection('scrapers')}>
            <div className="menu-title">Scrapers</div>
            <div className="menu-desc">Scraper par défaut, IGDB, ScreenScraper</div>
          </button>
          <button className="menu-item" tabIndex={0} onClick={() => setSection('scraping')}>
            <div className="menu-title">Scraping</div>
            <div className="menu-desc">Lancer le scraping global (manquants ou tout)</div>
          </button>
          <button className="menu-item" tabIndex={0} onClick={() => setSection('themes')}>
            <div className="menu-title">Thèmes</div>
            <div className="menu-desc">Choisir l'apparence de l'application</div>
          </button>
          <button className="menu-item" tabIndex={0} onClick={() => setSection('manettes')}>
            <div className="menu-title">Manettes</div>
            <div className="menu-desc">Manettes connectées et statut XInput natif</div>
          </button>
          <button className="menu-item" tabIndex={0} onClick={() => setSection('updates')}>
            <div className="menu-title">Mises à jour</div>
            <div className="menu-desc">Vérifier les nouvelles versions et activer le canal bêta</div>
          </button>
          <button className="menu-item" tabIndex={0} onClick={() => window.app.quit()}>
            <div className="menu-title">Quitter</div>
            <div className="menu-desc">Fermer Pixel et revenir au système</div>
          </button>
        </div>
      )}

      {section !== 'menu' && (
        <form className="settings-content" onSubmit={(e) => { e.preventDefault(); if (!isDirty) return; onSave(local); onClose(); }}>
          <button type="button" className="secondary" onClick={() => setSection('menu')}>
            ← Retour au menu
          </button>
          {section === 'configuration' && (
            <>
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

              {/* Scraper par défaut déplacé dans Scrapers */}
            </>
          )}

          {section === 'scrapers' && (
            <>
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
              <div className="form-row" style={{ gap: 8, alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>État des identifiants:</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ opacity: 0.8 }}>IGDB</span>
                    <span style={igdbReady ? badgeOkStyle : badgeMissingStyle}>{igdbReady ? 'OK' : 'Manquant'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ opacity: 0.8 }}>ScreenScraper</span>
                    <span style={screenscraperReady ? badgeOkStyle : badgeMissingStyle}>{screenscraperReady ? 'OK' : 'Manquant'}</span>
                  </div>
                </div>
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
                {(!local.scrapers?.igdb?.clientId || !local.scrapers?.igdb?.clientSecret) && (
                  <small style={{ color: '#ffa500' }}>
                    Astuce: Renseignez Client ID et Client Secret pour activer IGDB. Sinon, choisissez ScreenScraper en scraper par défaut.
                  </small>
                )}
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
                {!(local.scrapers?.screenscraper?.ssid && local.scrapers?.screenscraper?.sspassword) &&
                  !(local.scrapers?.screenscraper?.devid && local.scrapers?.screenscraper?.devpassword) && (
                    <small style={{ color: '#ffa500' }}>
                      Astuce: Fournissez soit un compte utilisateur (ssid + mot de passe) soit des identifiants développeur (devid + devpassword) pour améliorer la fiabilité de ScreenScraper. Facultatif mais recommandé.
                    </small>
                  )}
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
            </>
          )}

          {section === 'scraping' && (
            <>
              <h3>Scraping global</h3>
              <p>Déclencher le scraping des métadonnées pour toute la bibliothèque.</p>
              {progress && (
                <div className="form-row" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                    <span>Système: {progress.systemId}</span>
                    <span>{progress.current}/{progress.total}</span>
                  </div>
                  <div style={{ background: '#2b2b2b', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, progress.total ? (progress.current / progress.total) * 100 : 0))}%`, height: '100%', background: '#ff156d' }} />
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.8, marginTop: 4, wordBreak: 'break-all' }}>ROM: {progress.fileName}</div>
                </div>
              )}
              <div className="form-row" style={{ gap: 8, alignItems: 'flex-start', flexDirection: 'column' }}>
                <button
                  type="button"
                  disabled={isScraping}
                  onClick={async () => {
                    try {
                      setIsScraping(true);
                      setScrapeResult(null);
                      show('Scraping démarré: ROMs sans métadonnées');
                      const res = await window.metadata.downloadAll({ force: false });
                      show('Scraping terminé (ROMs sans métadonnées)');
                      setProgress(null);
                      setScrapeResult(res);
                      // Affiche l'écran de résultat
                      setSection('scraping');
                    } catch (e) {
                      console.error(e);
                      show('Erreur lors du scraping (voir console).', 'error');
                    } finally {
                      setIsScraping(false);
                    }
                  }}
                >
                  Scraper uniquement les ROMs sans métadonnées
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={isScraping}
                  onClick={async () => {
                    if (!confirmForce) {
                      setConfirmForce(true);
                      show('Cliquez à nouveau pour confirmer le re-scraping total');
                      // Reset confirmation after a short delay
                      setTimeout(() => setConfirmForce(false), 4000);
                      return;
                    }
                    try {
                      setIsScraping(true);
                      setConfirmForce(false);
                      setScrapeResult(null);
                      show('Re-scraping démarré: toutes les ROMs');
                      const res = await window.metadata.downloadAll({ force: true });
                      show('Re-scraping terminé (toutes les ROMs)');
                      setProgress(null);
                      setScrapeResult(res);
                      setSection('scraping');
                    } catch (e) {
                      console.error(e);
                      show('Erreur lors du re-scraping (voir console).', 'error');
                    } finally {
                      setIsScraping(false);
                    }
                  }}
                >
                  {confirmForce ? 'Confirmer: re-scraper TOUT' : 'Re-scraper toutes les ROMs (forcer)'}
                </button>
              </div>

              {scrapeResult && (
                <div className="form-row" style={{ width: '100%', marginTop: 12 }}>
                  <h4>Résultat</h4>
                  <div style={{ fontSize: '0.7rem' }}>
                    Total: {scrapeResult.totals.processed} • Créés: {scrapeResult.totals.created} • Sautés: {scrapeResult.totals.skipped} • Échecs: {scrapeResult.totals.failed}
                  </div>
                  <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 8, marginTop: 6 }}>
                    {scrapeResult.systems.map((sys) => (
                      <div key={sys.systemId} style={{ marginBottom: 10 }}>
                        <div style={{ fontWeight: 600 }}>{sys.systemId} — {sys.created} créés, {sys.skipped} sautés, {sys.failed} échecs</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0' }}>
                          {sys.items.slice(0, 10).map((it, idx) => (
                            <li key={idx} style={{ fontSize: '0.65rem', opacity: 0.9 }}>
                              {it.status === 'created' ? '✅' : it.status === 'skipped' ? '⏭️' : '⚠️'} {it.fileName}
                            </li>
                          ))}
                          {sys.items.length > 10 && (
                            <li style={{ fontSize: '0.65rem', opacity: 0.7 }}>… {sys.items.length - 10} autres</li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {section === 'themes' && (
            <>
              <h3>Thèmes</h3>
              <p>Choisissez l'apparence visuelle de l'application.</p>
              <div className="form-row">
                <label htmlFor="theme-select">Thème actuel</label>
                <select
                  id="theme-select"
                  value={local.theme || 'retro'}
                  onChange={(e) => {
                    const newTheme = e.target.value as "retro" | "abstract";
                    setLocal({ ...local, theme: newTheme });
                    // Appliquer immédiatement le thème pour prévisualisation
                    document.body.setAttribute('data-theme', newTheme);
                  }}
                >
                  <option value="retro">Retro - Arcade classique</option>
                  <option value="abstract">Abstract - Moderne et coloré</option>
                </select>
              </div>
              <div className="theme-help-text">
                Les changements de thème sont appliqués immédiatement. Enregistrez pour conserver vos préférences.
              </div>
            </>
          )}

          {section === 'manettes' && (
            <ManettesSection />
          )}

          {section === 'updates' && (
            <>
              <h3>Mises à jour</h3>
              <div className="form-row" style={{ fontSize: '0.65rem' }}>
                Version actuelle: {currentVersion || '…'}
              </div>
              <div className="form-row">
                <label htmlFor="beta-toggle">Activer les versions bêta</label>
                <select
                  id="beta-toggle"
                  value={String(!!local.updatesBeta)}
                  onChange={(e) => setLocal({ ...local, updatesBeta: e.target.value === 'true' })}
                >
                  <option value="false">Non (stables uniquement)</option>
                  <option value="true">Oui (inclure les préversions)</option>
                </select>
              </div>
              <div className="form-row" style={{ gap: 8 }}>
                <button
                  type="button"
                  disabled={checkingUpdate}
                  onClick={async () => {
                    try {
                      setCheckingUpdate(true);
                      setUpdateInfo(null);
                      const res = await window.updates.check({ beta: !!local.updatesBeta });
                      if (res.ok && res.update) {
                        setUpdateInfo(res.update);
                      } else if (res.ok && !res.update) {
                        show('Aucune mise à jour disponible');
                      } else {
                        show('Échec de la vérification des mises à jour', 'error');
                      }
                    } catch {
                      show('Erreur lors de la vérification', 'error');
                    } finally {
                      setCheckingUpdate(false);
                    }
                  }}
                >
                  {checkingUpdate ? 'Vérification…' : 'Vérifier les mises à jour'}
                </button>
                {updateInfo && !downloaded && (
                  <button
                    type="button"
                    className="primary"
                    disabled={downloading}
                    onClick={async () => {
                      setDownloading(true);
                      setDownloaded(false);
                      setDownloadProgress(null);
                      const res = await window.updates.download();
                      if (!res.ok) {
                        setDownloading(false);
                        show(res.error || 'Échec du téléchargement', 'error');
                      }
                    }}
                  >
                    {downloading ? (downloadProgress != null ? `Téléchargement… ${Math.round(downloadProgress)}%` : 'Téléchargement…') : `Télécharger Pixel ${updateInfo.version}`}
                  </button>
                )}
                {updateInfo && downloaded && (
                  <button
                    type="button"
                    className="primary"
                    onClick={async () => {
                      const res = await window.updates.install();
                      if (!res.ok) show(res.error || "Échec de l'installation", 'error');
                    }}
                  >
                    Installer et redémarrer
                  </button>
                )}
              </div>
              {updateInfo && (
                <div className="form-row" style={{ fontSize: '0.55rem', whiteSpace: 'pre-wrap' }}>
                  <div><strong>Version:</strong> {updateInfo.version}</div>
                  <div><strong>Notes:</strong></div>
                  <div>{updateInfo.notes}</div>
                </div>
              )}
            </>
          )}

          {section === 'quitter' && (
            <>
              <h3>Quitter l'application</h3>
              <p>Fermer Pixel et revenir au système.</p>
              <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                <button type="button" className="primary" onClick={() => window.app.quit()}>Quitter Pixel</button>
              </div>
            </>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => setSection('menu')}
            >
              Annuler (Esc)
            </button>
            <button type="submit" className="primary" disabled={!isDirty}>Enregistrer</button>
          </div>
        </form>
      )}
    </div>
  );
}
