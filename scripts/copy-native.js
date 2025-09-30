// Script de copie du binaire natif après build pour simplifier la résolution.
// Usage: node scripts/copy-native.js
const fs = require('fs');
const path = require('path');

const buildPath = path.join(__dirname, '..', 'native', 'xinput', 'build', 'Release', 'xinput_native.node');
const targetDir = path.join(__dirname, '..', 'dist-native');
const targetPath = path.join(targetDir, 'xinput_native.node');

if (!fs.existsSync(buildPath)) {
  console.error('[copy-native] Binaire introuvable:', buildPath);
  process.exit(1);
}
fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(buildPath, targetPath);
console.log('[copy-native] Copié vers', targetPath);
