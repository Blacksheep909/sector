// Regenerates docs/CARDS.md from the engine data: node tools/gen-cards.js
const fs = require('fs');
const path = require('path');
const E = require('../shared/engine');
const cls = { inf: 'Infantry', veh: 'Vehicle', air: 'Air', art: 'Artillery', sea: 'Naval' };
const order = ['common', 'uncommon', 'rare', 'legendary'];
let md = '# Card reference\n\n_Generated from `shared/engine.js` by `node tools/gen-cards.js`._\n\n';
md += 'Cards come from supply crates (Standard, Gilded, Mythic) and the opening draft; see the crate odds in docs/RULES.md. Legendaries are unique: only one copy exists until it is spent or its owner is eliminated.\n\n';
md += '## Units\n\nUnit cards are permanent unlocks: deploy as many as you can afford.\n\n| Unit | Class | Rarity | Cost | ATK | DEF | Move | Range | Notes |\n|---|---|---|---|---|---|---|---|---|\n';
for (const r of order) for (const [id, u] of Object.entries(E.UNITS)) if (u.rarity === r)
  md += `| **${u.name}** | ${cls[u.cls]} | ${E.RARITY[r].name} | $${u.cost} | ${u.atk} | ${u.def} | ${u.mv} | ${u.range || '–'} | ${u.desc} |\n`;
md += '\n## Tactics\n\nSingle-use cards from your hand.\n\n| Tactic | Rarity | Cost | Effect |\n|---|---|---|---|\n';
for (const r of order) for (const [id, t] of Object.entries(E.TACTICS)) if (t.rarity === r)
  md += `| **${t.name}** | ${E.RARITY[r].name} | $${t.cost} | ${t.desc} |\n`;
md += '\n## Structures\n\nBuilt from the hotbar (keys Z–M) on hexes you own that are connected to supply.\n\n| Structure | Cost | Effect |\n|---|---|---|\n';
for (const [id, s] of Object.entries(E.STRUCTS)) if (id !== 'hq') md += `| **${s.name}** | $${s.cost} | ${s.desc} |\n`;
md += '\n## Factions\n\n| Faction | Perk | Starts with |\n|---|---|---|\n';
for (const f of Object.values(E.FACTIONS)) md += `| **${f.name}** | ${f.perk}: ${f.desc} | ${E.UNITS[f.starter].name} |\n`;
md += '\nEvery commander also starts with **Grunts** and the **Ark** transport.\n';
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'CARDS.md'), md);
console.log('wrote docs/CARDS.md');
