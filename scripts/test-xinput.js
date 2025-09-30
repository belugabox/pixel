#!/usr/bin/env node
/*
Petit auto-test pour verifier le chargement de l'addon natif XInput.
Utilisation:
  npm run test:xinput
Comportement:
  - Charge l'addon
  - Ecoute 10 secondes un combo Start+Back (ou Start+Select) sur n'importe quelle manette
  - Affiche succes ou timeout
Exit codes:
  0 = addon chargé + event reçu
  1 = addon non chargé ou erreur
  2 = addon chargé mais aucun event recu dans le délai
*/

// Script autonome: on ne dépend pas du code TS compilé.

function tryRequire(p) { try { return require(p); } catch { return null; }
}
function loadDirect() {
  const candidates = [
    './xinput_native.node',
    'dist-native/xinput_native.node',
    '../dist-native/xinput_native.node',
    '../../dist-native/xinput_native.node',
    '../native/xinput/build/Release/xinput_native.node'
  ];
  for (const c of candidates) {
    const m = tryRequire(c);
    if (m && m.Watcher) return m;
  }
  try { const m = require('xinput_native'); if (m && m.Watcher) return m; } catch { /* ignore */ }
  return null;
}

(async () => {
  const mod = loadDirect();
  if (!mod) {
    console.error('[xinput-test] Echec chargement addon.');
  // Pas de détail additionnel ici (script autonome)
    process.exit(1);
  }
  let triggered = false;
  const watcher = new mod.Watcher(() => {
    triggered = true;
    console.log('\n[xinput-test] Combo détecté ✅');
  });
  watcher.start();
  console.log('[xinput-test] Attente combo Start+Back (10s) ...');
  await new Promise(r => setTimeout(r, 10_000));
  watcher.stop();
  if (!triggered) {
    console.error('[xinput-test] Timeout sans event.');
    process.exit(2);
  }
  console.log('[xinput-test] Succès.');
  process.exit(0);
})();
