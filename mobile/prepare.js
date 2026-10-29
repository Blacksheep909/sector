// Gets the app's own files ready before a native build: the icon for the start screen, from the game's icons.
// (The launcher icons and splash screens are generated from assets/ by @capacitor/assets: see docs/MOBILE.md.)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
fs.copyFileSync(path.join(root, 'public', 'app-512.png'), path.join(__dirname, 'www', 'icon.png'));
console.log('www/icon.png ready');
