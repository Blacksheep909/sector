// Builds dist/Sector.exe: a single self-contained executable (Node SEA) that runs the
// server, embeds the client files, and opens the browser. Usage: node tools/build-exe.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

// 1. bundle server + shared modules into one CommonJS file (SEA can only `require` built-ins)
const mods = { './shared/engine': 'shared/engine.js', './shared/bot': 'shared/bot.js', './engine': 'shared/engine.js' };
let bundle = "'use strict';\nconst __mods = {}, __cache = {};\nconst __req = require;\n";
bundle += "function __require(id) { if (__mods[id]) { if (!__cache[id]) { const m = { exports: {} }; __cache[id] = m; __mods[id](m, m.exports, __require); } return __cache[id].exports; } return __req(id); }\n";
for (const [id, file] of Object.entries(mods)) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  bundle += `__mods[${JSON.stringify(id)}] = function (module, exports, require) {\n${src}\n};\n`;
}
bundle += '(function (require) {\n' + fs.readFileSync(path.join(root, 'server.js'), 'utf8') + '\n})(__require);\n';
fs.writeFileSync(path.join(dist, 'sector-bundle.js'), bundle);

// 2. SEA config with every client file as an embedded asset
const assets = { 'engine.js': path.join(root, 'shared', 'engine.js') };
for (const f of fs.readdirSync(path.join(root, 'public'))) assets['public/' + f] = path.join(root, 'public', f);
const cfg = { main: path.join(dist, 'sector-bundle.js'), output: path.join(dist, 'sea-prep.blob'), disableExperimentalSEAWarning: true, useCodeCache: false, assets };
fs.writeFileSync(path.join(dist, 'sea-config.json'), JSON.stringify(cfg, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', path.join(dist, 'sea-config.json')], { stdio: 'inherit' });

// 3. copy the node binary and inject the blob
const exe = path.join(dist, process.platform === 'win32' ? 'Sector.exe' : 'sector');
fs.copyFileSync(process.execPath, exe);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['--yes', 'postject@1.0.0-alpha.6', exe, 'NODE_SEA_BLOB', path.join(dist, 'sea-prep.blob'), '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA');
execFileSync(npx, args, { stdio: 'inherit', shell: process.platform === 'win32' });
for (const f of ['sea-prep.blob', 'sea-config.json', 'sector-bundle.js']) fs.rmSync(path.join(dist, f), { force: true });
console.log('\nBuilt ' + exe);
