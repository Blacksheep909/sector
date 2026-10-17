<div align="center">

<img src="docs/img/title.png" alt="SECTOR title screen" width="100%">

# SECTOR

**Capture · Deploy · Destroy**

A turn-based hex conquest game for 2–6 players on the same Wi-Fi.<br>
Procedural maps · card drafting · naval warfare · Balatro-style dice combat.

[**⬇ Download for Windows**](../../releases/latest) · [How to play](docs/RULES.md) · [Card list](docs/CARDS.md)

</div>

---

## Play in 30 seconds

1. Download **`Sector.exe`** from the [latest release](../../releases/latest).
2. Double-click it. The game opens in its own window. Click **🖥 SERVER** in the menu to see your invite addresses and who's connected, and to stop the server.
3. Friends on the **same network** run `Sector.exe` too and choose **Join a game → Scan network**, or just type an invite address into any browser (for example `http://192.168.1.20:3000`).

**Updates install themselves.** Sector.exe checks this repo's releases, and when there's a new version the Server panel offers **Update & restart**. Only the host needs the exe: friends who join through a browser always get the host's version.

> The first launch asks for network access. Tick **Private networks** so friends can connect. Windows SmartScreen may warn that the exe is unsigned: click *More info → Run anyway*.

There are no accounts, no internet servers and no port forwarding. Prefer one screen? Add **local players** in the lobby for **pass-and-play** on a single device. Short on friends? Add bots on **Easy, Medium, Hard or Impossible**.

---

## What it looks like

<table>
<tr>
<td width="50%"><img src="docs/img/board.png" alt="The board mid-game"><br><sub><b>Every map is procedurally generated</b> from continents, archipelagos, inland seas and more. Territory pays income, so it's a nonstop land grab.</sub></td>
<td width="50%"><img src="docs/img/combat.png" alt="Combat"><br><sub><b>Chips × Mult combat.</b> Unit stats, terrain, flanking and pincers stack up. Then you fling your own die into the tray.</sub></td>
</tr>
<tr>
<td><img src="docs/img/legendary.png" alt="A legendary card reveal"><br><sub><b>Rarity-based reveals.</b> Commons snap over, Epics fly to centre stage, and Legendaries shake, spin and detonate.</sub></td>
<td><img src="docs/img/resupply.png" alt="Resupply"><br><sub><b>Resupply every turn.</b> Take a card plus half your income, or take the full income. Duplicate units level up ★.</sub></td>
</tr>
<tr>
<td><img src="docs/img/draft.png" alt="Opening draft"><br><sub><b>Opening draft.</b> Everyone picks 3 cards at the same time before the war starts.</sub></td>
<td><img src="docs/img/index.png" alt="Card index"><br><sub><b>Card index.</b> Every unit, tactic, structure and faction, plus the crate odds.</sub></td>
</tr>
<tr>
<td><img src="docs/img/closeup.png" alt="Close-up of the board"><br><sub><b>Readable at a glance.</b> Team-coloured territory, unit stacks, supply lines, sea control and bridges.</sub></td>
<td><img src="docs/img/lobby.png" alt="Lobby"><br><sub><b>LAN lobby.</b> Pick a faction and colour, add bots or local players, choose the map type and mode.</sub></td>
</tr>
</table>

---

## Features

| | |
|---|---|
| 🗺️ **Procedural maps** | Six layouts (continent, supercontinent, twin continents, archipelago, inland sea, crescent isles), noise-warped so no two outlines match. |
| 🃏 **Cards** | A deck of up to 10 unit cards. Pull a duplicate and it levels up (★ +1 ATK/DEF, max ★★★). Five rarities from Common to Legendary, and every Legendary is unique. |
| 🎰 **Supply Drop** | A tactic card in Rare, Epic and Legendary versions. Playing it spins a slot-machine reel for a crate tier, then the crate bursts open. |
| 🎲 **Combat** | Score = chips × (d6 + mult). Throw the die yourself. Combined Arms, Pincers, Flanking, terrain and structures all stack. |
| ⚓ **Navy** | Claim sea lanes, take offshore oil rigs, shell coastlines, and run amphibious invasions with Ark transports. Build bridges across narrow straits. |
| 🏭 **Economy and logistics** | Hexes only pay if they're connected by supply to your HQ, a FOB or a Port. Build Markets, Refineries and Depots, and **stack them up to ★★★**. Fortify your HQ. Encircle enemy pockets to annex them. |
| 🌐 **Easy LAN** | A host/join panel scans your Wi-Fi for games. The Esc menu lets you leave mid-game, and a bot takes over your seat. |
| 🤝 **Diplomacy** | Trade cash and cards with other players. Bots haggle too. |
| 🧠 **Bots** | Four difficulties. Bots draft, build, invade by sea, set up pincers and judge trades. |
| 📋 **Blueprint** | Queue your turn while others play; it runs the moment your turn begins. |
| 🗺️ **Living maps** | Biomes (desert, jungle, tundra, swamp), ruins and caches to loot, villages and forts to conquer, relics to fight over. Small to Huge sizes. Random spawns or pick your HQ. |
| ⚔️ **Factions** | Iron Covenant, Volt Syndicate, Ashen Nomads, Verdant Host and Null Order, each with a perk and a starting unit. |
| 🎨 **No assets** | Every unit, card and building is procedural vector art, and every sound is synthesized. The whole game is about 300 KB of code. |

## Modes

| Mode | Win by |
|---|---|
| **Domination** | Capturing every enemy HQ. |
| **Conquest** | Holding 60% of the land. |
| **Beacon** | Holding the glowing centre hex for 3 turns in a row. |

Full rules are in **[docs/RULES.md](docs/RULES.md)**.

---

## Run from source

You need [Node.js](https://nodejs.org) 22 or newer. There are **no dependencies**, so there's nothing to `npm install`.

```bash
git clone https://github.com/Blacksheep909/sector.git
cd sector
node server.js
```

Then open http://localhost:3000. On Windows you can also double-click `Start Sector.bat`.

## Build the .exe

```bash
node tools/build-exe.js
```

This packages the server and the client into a single `dist/Sector.exe` (a Node single-executable application).

Releases are automated. Pushing a tag like `v1.0.0` makes GitHub Actions run the bot-vs-bot smoke test, build the exe on Windows, and attach it to a GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Project layout

```
server.js            LAN server: HTTP + hand-rolled WebSocket, lobby, bots, pass & play
shared/engine.js     all game rules (authoritative on the server; also used in the browser for previews)
shared/bot.js        AI opponents
public/              the client: render.js (board), main.js (HUD & flow), cards.js (cards, reveals, index),
                     art.js (vector art), audio.js (synth SFX), style.css
tools/               sim.js (headless bot games), maps.js (map previews), build-exe.js, screenshots.js, e2e-pass.js, e2e-blueprint.js, e2e-spawn.js, balance.js
docs/                rules, card reference, development notes, screenshots
```

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for the architecture and the testing tools.

---

<sub>SECTOR began as a cardboard board game made in Year 10, with hand-built models and a lot of dice. This is the remake.</sub>
