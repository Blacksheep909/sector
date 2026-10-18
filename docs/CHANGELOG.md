# SECTOR changelog

Every release, newest first. Each version also has its own post on the [Releases page](https://github.com/Blacksheep909/sector/releases).

## v0.6.1

- **Captured Bunkers are destroyed.** Take an enemy commander's bunkered hex and the Bunker is blown up on the spot (with a demolition blast), so you can't turn their own defences against them. Other buildings on the hex still change hands. Neutral Old Forts still give you their Bunker.

## v0.6.0

**The big one.** Fog of war, alliances, world events, undo, a Balance of Power chart, up to 8 commanders, menu music, and a pile of fixes.

**New ways to play**
- **🌫 Fog of war** (lobby option): you only see around your land and units, and your allies' view. Enemy units hide in the fog, and marching into hidden troops means an ambush.
- **🤝 Alliances:** press ALLY under a rival's name. Allies can't attack each other, share vision, and **win together** if they're the last ones standing. BREAK ends a pact at the start of your next turn, so there's a warning before the betrayal.
- **⛈ World events:** from round 3, most rounds bring an event for the whole round: Storm Front, Rough Seas, Blizzard, Gold Rush, Arms Fair, Supply Shortage, War Fervour or Clear Skies. Each comes with rain or snow on the map where it fits.
- **↶ Undo** (`Ctrl+Z`) for moves, deploys and builds that revealed nothing.
- **Up to 8 commanders**, so you can fill the lobby with bots.
- **📈 Balance of Power:** the victory screen charts every commander's share of the land, round by round, and marks every moment the lead changed hands.

**World and art**
- **Bigger biome regions** and a new **Red Canyons** biome (+1 defence, 2 move).
- **New highlands art:** rolling mounds instead of boxes.
- **Neutral villages and forts roll their own garrison strength**, shown as pips on the map.
- **Airstrikes fly real jets** in the striker's colour, with contrails, shadows and falling bombs. Carpet bombing is a three-jet formation.
- **Fights show the cards:** attacker and defender stacks appear as fanned unit cards in the combat panel instead of tiny icons.
- **Random map type reveal:** a slot reel of battlefield thumbnails lands on your map.
- **🎵 Main-menu war theme:** a slow, heavy orchestral march, synthesized live. Menu only.

**Fixes**
- **Turn timer:**
  - It now **pauses while your fights and crates play out**, and resupply gets its own 20 seconds.
  - Running out of time mid-menu no longer stalls the game.
  - There's a visible clock bar.
  - It no longer depends on players' computer clocks matching.
- **Enter no longer ends your turn by accident.** It needs two presses and is ignored during and just after fights.
- **The camera stays put:** it only glides to your HQ at your turn start, and only if your HQ is off-screen.
- **Left-hand HUD panels no longer overlap** on smaller or taller windows; the whole HUD scales down to fit.
- **Card-reveal sunbursts follow the card** (no more off-centre rays), and draft and resupply effects are much lighter on laptop graphics.
- The blueprint preview no longer acts out sieges, which made land flicker.

## v0.5.6

- **Bunkers are real strongpoints now** (no dice changes):
  - **Built-in garrison:** +3 chips per level, even with no troops inside. Enemies can't stroll into an empty bunkered hex any more. They have to attack it, and annexing, flyover captures and Heli Drop can't take it for free.
  - **Bunker Line:** a ★★ or ★★★ Bunker gives your neighbouring hexes +1 defence mult, so a few Bunkers hold a whole front.
  - The +2 / +3 / +4 defence mult stays as before. A lone tank has about a 6% chance against an empty ★★ Bunker. Bring a combined assault or a Siege Breaker.

## v0.5.5

- **Emergency muster.** If someone sits on your HQ, every hex you own next to it becomes a deploy point, and troops placed there can attack immediately. Rush in defenders and take your HQ back on the same turn. The siege warning tells you how, and bots use it too: in testing, about a third of besieged HQs were won back.
- **Fixed: land flashing between two colours during a siege.** While you sat on someone's HQ, your blueprint preview acted out their elimination, so their territory flickered between your colour and theirs. The preview no longer resolves sieges; they resolve for real at the start of your turn.

## v0.5.4

- **Fixed: menus overlapping each other.** The hover-to-enlarge card and the build-bar tips used to get stuck on screen and float over the Card Index, the Supply Drop and other menus. They now close the moment you stop hovering, and every menu clears them when it opens.
- **The camera stays where you put it.** Other players' moves no longer drag your view around while you plan blueprint orders. It only moves at the start of your turn and to follow your own actions.
- **FOBs under construction are visible.** A new (or newly captured) base shows a greyed-out icon, a spinning hazard ring, a little crane with a swinging hook, a "1" turns-left badge and a NEXT TURN tag until it comes online.
- **Sea fades instead of flickering.** Water hexes changing hands now cross-fade smoothly to their new colour.
- **Buildings get pricier as you build more.** Each building you buy raises the price of the next one of that type by $1, upgrades included (for example Market $7 → $8 → $9). HQ fortification is exempt.
- **Eliminated commanders are greyed out** in the top bar, with a struck-through name and a ☠ OUT tag.

## v0.5.3

- **Supply Drops open like a real loot chest:**
  - Each tier has its own painted chest: oak and iron, red and gold, or violet crystal.
  - It slams down with a squash-and-bounce and a dust puff, then sits breathing and glowing until you tap it.
  - On the tap it hops three times while light leaks from the seam. Then the lid bursts open, a beam of light shoots up, and the sunburst spins behind it.
  - The three cards shoot out of the chest one by one while a counter ticks down.
- **Fixed:** the sunburst is now always centred on the chest. It used to fan in from the top of the screen.
- **Fixed:** the BREAKTHROUGH! / REPELLED! banner now lands over the finished dice tray instead of on top of the scores.
- **🎲 Random bot difficulty.** Set a bot to Random in the lobby, and it rolls Easy, Medium, Hard or Impossible when the game starts.

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

