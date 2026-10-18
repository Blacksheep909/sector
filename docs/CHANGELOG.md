# SECTOR changelog

Every release, newest first. Each version also has its own post on the [Releases page](https://github.com/Blacksheep909/sector/releases).

## v0.7.2

**Drop-outs no longer strand the game, the host can kick, sneakier bots, and a drone nerf.**

- **📡 No more stranded games:** if a player disconnects, a bot covers their empire after 30 seconds and hands it straight back when they reconnect.
- **👢 Host kick:** the host can remove a player mid-game with the ✕ on their name; a bot takes over that empire.
- **🗡 Bots betray strategically:** once the common enemy is beaten, or a weak ally sits next door while they lead, harder bots will break a pact (never one younger than 3 rounds).
- **🕵 Spy Ring** steals any card the rival has earned: a tactic or a unit from their deck, never their starting Grunts, faction unit or Ark.
- **✈ Aircraft nerf (hits Volt Syndicate hardest):** aircraft only take the hex they land on, instead of every unclaimed hex they fly over. Drone swarms can no longer grab huge areas, and their income, in a turn. Gunships (Valkyrie, Seraph) still seize enemy hexes on their flight path.
- **Privacy:** the repository history no longer contains network addresses or a personal email.

## v0.7.1

**Ready up, rivers, sea mines, and a lot faster.**

**New**
- **✔ Ready up:** every guest presses READY UP before the host can deploy. Changing a setting un-readies everyone.
- **🌊 Rivers** wind from the highlands to the sea. Fording costs 2 move, river hexes defend at +1, and every 3 river hexes you hold pay +$1.
- **💣 Sea Mines:** the naval Bunker. Build them in your own sea (up to ★★★); enemy ships have to fight through a minefield instead of sailing past. Bots lay them in front of their Ports.
- **Host online:** a new [hosting guide](https://github.com/Blacksheep909/sector/blob/main/docs/HOSTING.md) covers playing through a free Cloudflare tunnel (no port forwarding, your IP stays hidden) or on a cloud server, with a Dockerfile and a **public mode** (`npm run start:public`).

**Faster**
- **Card picking is smooth again:** the spinning sunburst behind the draft and resupply was a huge 2× layer; it's now screen-sized, and the card glows no longer repaint every frame.
- **The board no longer stutters on slower PCs:** it redraws its animated scenery less often when that's expensive, unit tokens are cached instead of redrawn every frame, and the menu background stops repainting constantly.

**Fixes**
- **Sea tiles** shimmer smoothly instead of flashing.
- **The EMP** is a clean electric shockwave with crackling arcs, and frozen units show a calm pulse and a lightning badge.
- **Spy Ring** works (it couldn't find targets in your browser).
- **Nothing else can be built on an HQ hex;** the Fortify card fortifies the HQ instead.
- **Chat** no longer overlaps the build bar.
- **The card index** shows where Mythics are (they're tactics) instead of an empty page.
- **Aegis Protocol** has a properly sized icon, the Mythic cards no longer overflow, and long card names shrink to fit.
- **Security:** the host panel can't be reached through tunnels or proxies, and public servers don't reveal private network addresses.

## v0.7.0

**The huge one.** Teams and World War modes, Mythic cards, a Carrier, ocean maps, smarter bots with moods, an end-of-game War Report, taking over bots mid-game, and a big pile of fixes and balance.

**New modes**
- **👥 Teams** (lobby option): pick teams A–D. Teammates share vision, can't hurt each other, start close together and win together.
- **🌍 World War:** a colossal map with a war economy (more cash, a starting army and wider borders), +1 move for every unit, double-speed playback of other turns, a 45% land win and **🚀 superweapon silos** that hand out Mythic cards.
- **🌊 Open Ocean maps:** small scattered islands and lots of oil rigs. Everyone starts with a Port and an Ark.

**New cards**
- **Mythic rarity:** white-hot cards with a rainbow edge and their own reveal.
  - **☢ Tsar Bomba:** a 9-hex nuke.
  - **🏛 Regime Change:** an enemy hex and their land around it flip to you, and their troops there switch sides.
  - **🛡 Aegis Protocol:** +3 defence everywhere and immunity to enemy tactics until your next turn.
- **Carrier** (Legendary): a floating airbase. Deploy aircraft onto it, fly them off and land them back.
- **⛏ Quarry Blast** (Rare): blast a mountain into Highlands to open a pass.
- **🕵 Spy Ring** (Epic): steal a random card from an enemy.

**Diplomacy and bots**
- **Bot moods:** a face by each bot's name shows how it feels about you. Bots hold grudges, warm to long-standing allies, gang up on whoever is most dangerous, and turn on an ally who gets too big.
- **Betrayal hurts:** breaking a pact makes you a TRAITOR for 3 turns: -40% income, no new pacts, and your victim gets +2 mult against you.
- **Loyalty pays:** an alliance held for 2+ rounds earns both sides up to +$4 a turn, and allies' bordering hexes defend at +1.

**Network play**
- **Take over a bot:** spectating a game in progress? Press **TAKE OVER** under any bot's name to take command of its empire.
- The network scan starts by itself and shows how many bots each running game has.
- **Skips are shared:** if anyone fighting in a battle skips it, it skips for everyone, and anyone can skip bot-vs-bot fights. **Space** skips animations.

**War Report**
- The victory screen now has tabs:
  - Balance of power
  - **Battle heatmap**
  - **Land swings** (the front lines)
  - **Economy** and **Armies** charts round by round
  - **Awards**: Warmonger, Land Baron, Tycoon, Conqueror, Scavenger, Meat Grinder and the biggest battle of the war

**Balance**
- Each building of a type now raises the next one's price by **$2** (was $1).
- **Rerolls** cost a quarter of your income, and more for each extra one. **Bounty** pays a fifth of your income per kill.
- **★★★ Bunkers are Citadels:** 14 garrison chips, +5 mult, +2 to neighbours, and they hold far more of a big attack.
- **FOBs must be connected** to your HQ or a Port to deploy from, to supply land, or to be built.

**Fixes and polish**
- **The Ark works:** it launches from a coastal HQ or FOB as well as a Port, and its passengers can land straight from the selection.
- **Slow units always move:** the Goliath, and any 1-move unit in snow, highlands or a blizzard, can always step one hex.
- **Placing is instant:** spam-click to deploy or build. Clicks no longer wait for the last animation.
- **Hold Alt** for a troops-only view showing every stack's attack and defence.
- **The Oracle** strikes with a beam from orbit instead of firing out of its dish.
- **Oil rigs** show their owner with a coloured ring and flag.
- **The NEXT TURN tag** is no longer hidden behind neighbouring tiles.
- **Loaded Dice** shows the real roll in the battle panel.
- **The log** keeps to the headlines instead of every move.
- **Undo** can no longer be used to scout the fog for free.
- **Licence:** SECTOR is now under the PolyForm Noncommercial licence: free to play, share and mod, but not to sell.

## v0.6.5

- **Real weather.** Blizzards now bring drifting snow in layers (near flakes bigger and softly glowing), gusts of wind, and a frosty edge to the screen. Storms and rough seas bring slanted rain, a darker sky and, in storms, the odd lightning flash.
- **No free Ark.** Commanders start with Grunts and their faction unit. Only those whose HQ starts on a small island get an Ark, so nobody is stranded.
- **Embargo reworked:** click any enemy territory and that commander earns **half income for their next 2 turns** and **can't trade** while it lasts. It also has new art: a crate of gold chained shut.
- **Upgrade prices on hover.** In build mode, hovering a building you already own shows the upgrade price (e.g. Market ★ → ★★ $12) on the tooltip and on the build-bar tile.

## v0.6.4

- **Smoother card screens.** The holographic foils on rare, epic and legendary cards used to repaint the whole card every frame and use expensive colour blending. They now slide a GPU layer instead and look the same. While a card screen (draft, resupply, crate, index) is open, everything behind it stops animating.
- **Supply caches give better loot.** They now hold a real tactic card with proper rarity odds: common 40%, uncommon 35%, rare 18%, epic 6%, legendary 1%. Before, they almost always fell back to a common card.
- **No more blueprint spoilers.** Planning a move through ruins or a cache no longer shows what's inside; you find out when your units actually get there.
- **The Blueprint box moved** to the bottom right, so the log and event chips on the left no longer cover it.

## v0.6.3

- **Real fog of war.** Turn it on in the lobby and the map starts dark.
  - **Unexplored land is hidden completely:** no terrain, owners, buildings or loot, just drifting cloud. Only HQ locations are known.
  - **Places you've explored but can't currently see** show the terrain and what you **last saw** there, dimmed, with no units.
  - **What your units, borders and allies can see** is fully live.
  - The game remembers what each commander has explored, so scouting finally matters.
- Garrison strengths on villages and forts are confirmed random per village and per game (villages 3–9, forts 3–8 with a ★–★★★ Bunker).

## v0.6.2

- **⚡ Much smoother on big maps.** The board is now drawn into a cached layer that only redraws when the view or board changes. Per-frame drawing time on a Huge map dropped about 6× (8.4ms → 1.3ms zoomed out), and the expensive glow blurs on borders and markers were replaced with cheap look-alikes. Laptops should feel the difference most.
- **Eliminating a commander is no longer a jackpot.** You take only their heartland (hexes within 2 of their HQ) plus $10 plunder. The rest of their empire collapses into neutral land, open to everyone, and the buildings out there are wrecked.
- **Pick any colour.** In the lobby you can take a colour a bot is using. The bot swaps to your old colour, so no two commanders ever match. Colours held by other human players stay locked.
- **Bunkers hold the line.** A defended Bunker now digs in against big attacks: it gains extra chips worth 40% of the attacker's chip lead (up to 4 per Bunker level). One tank barely dents a ★★ Bunker; it takes a real army to crack one.

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

