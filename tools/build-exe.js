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
const mods = { './shared/engine': 'shared/engine.js', './shared/bot': 'shared/bot.js', './engine': 'shared/engine.js', './shared/cosmetics': 'shared/cosmetics.js', './shared/scenarios': 'shared/scenarios.js', './shared/personas': 'shared/personas.js', './personas': 'shared/personas.js', './profiles': 'profiles.js' };
const version = process.env.SECTOR_BUILD_VERSION || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
let bundle = "'use strict';\nconst __SECTOR_VERSION = " + JSON.stringify(version) + ";\nconst __mods = {}, __cache = {};\nconst __req = require;\n";
bundle += "function __require(id) { if (__mods[id]) { if (!__cache[id]) { const m = { exports: {} }; __cache[id] = m; __mods[id](m, m.exports, __require); } return __cache[id].exports; } return __req(id); }\n";
for (const [id, file] of Object.entries(mods)) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  bundle += `__mods[${JSON.stringify(id)}] = function (module, exports, require) {\n${src}\n};\n`;
}
bundle += '(function (require) {\n' + fs.readFileSync(path.join(root, 'server.js'), 'utf8') + '\n})(__require);\n';
fs.writeFileSync(path.join(dist, 'sector-bundle.js'), bundle);

// 2. SEA config with every client file as an embedded asset
const assets = { 'engine.js': path.join(root, 'shared', 'engine.js'), 'cosmetics.js': path.join(root, 'shared', 'cosmetics.js'), 'scenarios.js': path.join(root, 'shared', 'scenarios.js') };
for (const f of fs.readdirSync(path.join(root, 'public'))) assets['public/' + f] = path.join(root, 'public', f);
const cfg = { main: path.join(dist, 'sector-bundle.js'), output: path.join(dist, 'sea-prep.blob'), disableExperimentalSEAWarning: true, useCodeCache: false, assets };
fs.writeFileSync(path.join(dist, 'sea-config.json'), JSON.stringify(cfg, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', path.join(dist, 'sea-config.json')], { stdio: 'inherit' });

// 3. copy the node binary and inject the blob
const exe = path.join(dist, process.platform === 'win32' ? 'Sector.exe' : 'sector');
fs.copyFileSync(process.execPath, exe);
// 3b. Windows: give the exe SECTOR's icon and name (before the blob goes in)
if (process.platform === 'win32') {
  const tools = path.join(dist, '.tools');
  if (!fs.existsSync(path.join(tools, 'node_modules', 'rcedit'))) execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', tools, 'rcedit@4.0.1'], { stdio: 'inherit', shell: true });
  const rcedit = path.join(tools, 'node_modules', 'rcedit', 'bin', process.arch === 'arm64' ? 'rcedit-arm64.exe' : 'rcedit-x64.exe');
  const v4 = version.split('-')[0] + '.0';
  execFileSync(rcedit, [exe, '--set-icon', path.join(root, 'assets', 'icon.ico'), '--set-file-version', v4, '--set-product-version', v4,
    '--set-version-string', 'ProductName', 'SECTOR', '--set-version-string', 'FileDescription', 'SECTOR', '--set-version-string', 'CompanyName', 'SECTOR',
    '--set-version-string', 'OriginalFilename', 'Sector.exe', '--set-version-string', 'InternalName', 'Sector', '--set-version-string', 'LegalCopyright', ''], { stdio: 'inherit' });
  console.log('Set icon and version info (' + v4 + ')');
}
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['--yes', 'postject@1.0.0-alpha.6', exe, 'NODE_SEA_BLOB', path.join(dist, 'sea-prep.blob'), '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA');
execFileSync(npx, args, { stdio: 'inherit', shell: process.platform === 'win32' });
// 4. optional (SECTOR_NO_CONSOLE=1): GUI subsystem, no console window. The default keeps the console: it's the server dashboard.
if (process.platform === 'win32' && process.env.SECTOR_NO_CONSOLE) {
  const fd = fs.openSync(exe, 'r+'), b4 = Buffer.alloc(4), b2 = Buffer.alloc(2);
  fs.readSync(fd, b4, 0, 4, 0x3c); const pe = b4.readUInt32LE(0);
  fs.readSync(fd, b4, 0, 4, pe); if (b4.toString('latin1') !== 'PE\0\0') throw new Error('not a PE file');
  const sub = pe + 24 + 68; fs.readSync(fd, b2, 0, 2, sub);
  console.log('PE subsystem ' + b2.readUInt16LE(0) + ' -> 2 (windows GUI)');
  b2.writeUInt16LE(2, 0); fs.writeSync(fd, b2, 0, 2, sub); fs.closeSync(fd);
}
for (const f of ['sea-prep.blob', 'sea-config.json', 'sector-bundle.js']) fs.rmSync(path.join(dist, f), { force: true });
console.log('\nBuilt ' + exe + ' (v' + version + ')');
