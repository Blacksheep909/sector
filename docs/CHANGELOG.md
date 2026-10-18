# SECTOR changelog

Every release, newest first. Each version also has its own post on the [Releases page](https://github.com/Blacksheep909/sector/releases).

## v0.5.2

- **No contest, no dice.** If an attack can't lose (100% win chance), there's no dice roll. Your troops crush the defenders with an **OBLITERATED!** slam: a flash, a shockwave and debris. Crushing wins never cost you a unit to pyrrhic losses. Certain-hit bombardments land as **DIRECT HIT!** the same way.

## v0.5.1

- **Spectators.** In the lobby, press 👁 next to your name (or, as host, next to any player) to sit the game out and watch. Press ▶ to play again. You need at least 2 commanders who are playing.
- **Cleaner art:**
  - The Lancer's launcher now rests on his shoulder instead of going through his head.
  - The Titan has been redrawn as a proper colossus mech.
  - Every card was checked at full size and at card size.
- **FOBs take a turn to construct.** A new FOB comes online at the start of your next turn; until then you can't deploy on it.
- **Sea encirclement.** A pocket of 12 or fewer water hexes, walled in by your coast and your own sea, flips to you automatically, just like land pockets.
- **Fixed: ships now claim the water they launch into.** Deploying a ship from a Port claims that sea hex, just like sailing through it.
- **Calmer for antivirus.** The updater no longer writes and runs a batch script. The new exe swaps itself in and restarts, and the browser now opens through Explorer rather than a hidden command prompt.
- **One post per release.** Each GitHub release now lists only that version's changes. The full history lives in [CHANGELOG.md](https://github.com/Blacksheep909/sector/blob/main/docs/CHANGELOG.md).

## v0.5

**The sea is worth taking**, though it's never required: players who stay on land lose nothing.

- **Fishing grounds:** shoals with red buoys, worth +$1 each while you hold them.
- **Twice as many offshore oil rigs** (+$2 each).
- **Shipping lanes:** every Port earns $1 per 4 of your sea hexes connected to it, up to $5 per Port.
- **Treasure islands:** small islands now hold ruins, caches, villages and relics. Sail an Ark over to grab them.
- **Naval gunfire:** each warship next to a land fight adds +2 chips to its side (up to 3 ships), whether attacking or defending. Fleets now back up the land war.
- **Smarter bot admirals:** bots build Ports when there are prizes at sea, chase rigs and fishing grounds, and raid treasure islands.

## v0.4.1

- **A real server window.** Sector.exe is a dedicated server with a live terminal dashboard showing your addresses, players, status, updates and activity. Keys: **O** open the game, **C** copy the invite, **U** update, **Q** stop. The game itself lives in the browser.
- **SECTOR icon** on the exe, the server window and the browser tab.
- **Draft at your own pace.** Make all 3 picks back to back; the war starts once everyone's done.
- **Leaving works everywhere.** Leaving during the draft, HQ picking, a crate, a trade or pass and play now returns you to the main menu. The victory screen has a **Main menu** button for everyone.
- **New card art:**
  - Every unit has been redrawn with shading, wheels and tracks, cockpits and weapons.
  - The infantry have faces and rifles held across the chest.
  - The Hornet is now an MQ-9-style drone.
- **SECTOR card backs:** a crimson hex weave, a cream frame and the SECTOR emblem. Every card shares the same back.
- **Fixed:** card names that turned into scribbles on cards with long descriptions.

## v0.4

**Hosting**
- **No more terminal.** The exe runs windowless, and the new **Server panel** shows invite addresses (with copy buttons), connected players, uptime, the version, and **Stop server**.
- **Auto-update** from GitHub releases, in one click.
- The server shuts itself down a minute after everyone leaves. Launching the exe again while it's running just reopens the game window.

**Maps**
- **Large is really large now** (1.8× Medium), and there's a new **Huge** size (2.6×).
- **Biomes:** desert, jungle, tundra and swamp, laid out by climate.
- **Points of interest:** loot Ruins and Supply caches, conquer garrisoned Villages (+$2/turn) and Old forts (free ★★ Bunker), and fight over Ancient relics (+$3/turn).
- **Pick your HQ:** a new lobby option lets commanders take turns choosing where to spawn. Random spawns are still the default.

**12 new cards**
- Units: **Corpsman** (medic), **Sapper** (demolitions), **Scorpion** (anti-air), **Ranger** (pathfinder), **Hellcat** (strikes the turn it lands), **Phantom** (stealth bomber, epic) and **Titan** (legendary colossus).
- Tactics: **Rally**, **Fortify**, **Bounty**, **Embargo** and **Orbital Strike**.

**Balance**
- **HQ sieges:** capturing an HQ gives the defender one turn cycle to retake it before they're eliminated.
- **Captured FOBs and Ports** come online next turn, so no instant deploys.
- **Up to 3 buildings per hex.**
- **Grunt-only stacks hold 10** (mixed stacks are still 5).
- **Supply Drops never roll another Supply Drop.**
- Factions:
  - **Volt**: +1 move for air only, and Hornets are cheaper.
  - **Ashen**: no more zooming through enemy land. They loot $2 per enemy hex captured, and Skitters are cheaper.
  - **Iron**: +2 defence chips per unit.
  - **Null**: rolls of 1 *and 2* count as 3.
- Bot sims now land every faction between 15% and 25% wins.
- Units: Valkyrie is $10 with 4 move, Goliath has 6 defence and costs $10, Bulwark costs $6, and Basilisk costs $7.
- **Medium bots are calmer.** Every difficulty was retuned, and Medium now gets 90% income.

**Fixes and controls**
- **Blueprints rebuilt:**
  - Queued orders now run in round 1 too.
  - The preview follows the real turn-start rules.
  - Moves of units you deployed in the plan work.
  - The arrows follow the real path.
  - Each pass-and-play seat has its own blueprint.
- **Enter ends your turn** (T opens chat).

## v0.3

- **Game window.** The exe now opens SECTOR in its own app window instead of a browser tab.
- **Host / Join panel.** Scan your network for games, join by address, or pick a recent server.
- **Esc menu.** Resume, rules, card index, sound, and **leave the game**. A bot takes your seat so the match carries on. The host can end the game for everyone.
- **Building upgrades.** Build the same structure on a hex again to stack it up to ★★★. That includes **fortifying your HQ**.
- **Bigger, clearer build bar.** Labelled tiles, a red price when you're short, and an ▲ badge when something can be upgraded.
- **Pass and play.** The "pass the device" screen now appears only when a local player actually has to act, and hands are hidden during bot turns.
- **Reveal fixes.** No more duplicate "reveal" bars. Epic and Legendary cards fly to the true centre. Background beams fill any screen size.
- **Performance.** The resupply menu runs at full frame rate: the board pauses under overlays, and there's no more full-screen blur or blending.
- **Space.** It only flips cards and throws dice. It never ends your turn.

