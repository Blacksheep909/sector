# SECTOR

**Capture · Deploy · Destroy.** A turn-based hex conquest game for 2–6 players on the same network. It has procedural maps of any shape, a card draft, naval warfare, trading, and Balatro-style combat where you fling the dice yourself.

Every hex you hold pays income, so the game is a nonstop land grab.

## Play

### Option A: the .exe (Windows, nothing to install)

1. Download **`Sector.exe`** from the [Releases](../../releases) page.
2. Double-click it. A console window opens, and your browser opens the game.
3. Friends on the **same Wi-Fi / LAN** type the **"Same network"** address from that console window (for example `http://192.168.1.20:3000`) into their browser. They don't need to install anything.
4. Keep the console window open while you play. Close it to stop the server.

The first time you run it, Windows Firewall asks whether to allow network access. Tick **Private networks** so friends can connect. SmartScreen may also warn that the exe is unsigned: click *More info → Run anyway*.

### Option B: from source (any OS)

You need [Node.js](https://nodejs.org) 22 or newer. There are no dependencies, so there's no `npm install` step.

```
node server.js
```

On Windows you can also double-click **Start Sector.bat**. Then open http://localhost:3000.

### In the lobby

The first person to join is the **host**. The host picks the mode, map type, map size, turn timer and round limit, and can add bots and set each bot's difficulty (**Easy, Medium, Hard, Impossible**). Everyone picks a faction and colour. If you refresh or drop out, you rejoin your seat automatically.

## Features

- **Procedural maps.** Six layout archetypes, noise-warped and trimmed to the coastline, so the board outline differs every game. Includes mountains, highlands, forests, resource nodes, and shallow and deep sea.
- **Supply Drop draft.** Each turn, take one of 3 face-down cards (with escalating reveals for rare and legendary pulls) or collect full income. Legendaries are unique.
- **Chips × Mult combat.** Unit stats, terrain, flanking and perks stack into a score multiplied by a die you throw into a physics tray.
- **Navy.** Ports, gunboats, destroyers, submarines, battleships, a legendary dreadnought, and Ark transports for amphibious invasions.
- **Economy and logistics.** Income needs supply lines back to your HQ, a FOB or a Port. Build Markets, Refineries and Depots. **Trade** cash and cards with other players.
- **Encirclement.** Surround a pocket of land and it's annexed.
- **Hotbar.** Press `1`–`0` to deploy and `Z`–`M` to build.
- **Blueprint mode.** Queue your turn while others play; it runs the moment your turn starts.
- **Five factions**, each with a perk and a starting unit.
- **Bots** with four difficulty levels, including naval play and trade negotiation.
- No asset files: every unit and structure is drawn as vector art, and every sound is synthesized.

Read the full rules in **[docs/RULES.md](docs/RULES.md)**. Every unit, tactic and structure is listed in **[docs/CARDS.md](docs/CARDS.md)**.

## Releasing a new .exe

Releases are built by GitHub Actions (`.github/workflows/release.yml`):

```
git tag v0.2.0
git push origin v0.2.0
```

The workflow tests the game, builds `Sector.exe` on Windows, and attaches it to a GitHub Release. To build locally instead, run `node tools/build-exe.js`. The output goes to `dist/Sector.exe`.

## Development

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for the architecture, tools and testing.
