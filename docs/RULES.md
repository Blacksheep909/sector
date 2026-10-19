# How to play SECTOR

Grab land, build an economy, crush your rivals. **Every hex you hold pays you**, so standing still is losing.

## Setup and the opening draft

- 2–8 commanders: humans over the network, bots (Easy, Medium, Hard, Impossible), and **pass-and-play** players sharing one device. Anyone can press 👁 in the lobby to **spectate** instead of play. A cover screen hides each player's hand between turns.
- Every map is procedurally generated from one of seven layouts: continent, supercontinent, twin continents, archipelago, inland sea, crescent isles or open ocean. Rivers branch into tributaries, small lakes sit in the lowlands, and mountain ranges throw out ridges of highlands. The coastline is noise-warped, so no two boards share an outline. Sizes run from Small to **Huge** (about 3.5× the land of Small).
- **Spawns.** With *Random* spawns, HQs are placed fairly far apart. With *Pick your HQ*, commanders take turns choosing their HQ hex (whoever moves last picks first). HQs must sit a minimum distance apart, and bots pick roomy spots near resources.
- Everyone starts with an HQ and its surrounding hexes, 2 Grunts, $6, a **Rare Supply Drop** card, and two unit cards: **Grunts** and their faction's starter unit. Commanders who start on a small island also get the **Ark** transport so they can reach the mainland.
- **Opening draft.** Before round 1, every commander picks simultaneously. In each of 3 draft rounds you're offered 3 cards and keep 1.

## Fog of war, events and alliances

- **Fog of war** (lobby option). You see one hex past your borders, two hexes around your units (three for aircraft), and everything your allies see. **Unexplored** hexes are completely hidden (only HQ locations are known). Hexes you've explored but can't see right now show what you **last saw** there, without units. March into a hex that hides enemies and you'll fight them: an ambush.
- **World events** (on by default). From round 3, most rounds roll an event that lasts the whole round:

| Event | Effect |
|---|---|
| ⛈ Storm Front | Aircraft are grounded |
| 🌊 Rough Seas | Ships stay in port |
| ❄ Blizzard | Every unit has 1 less move (minimum 1) |
| 💰 Gold Rush | Resources, oil rigs and fishing grounds pay double |
| 🛒 Arms Fair | Units cost $1 less |
| 📦 Supply Shortage | Buildings cost $2 more |
| 🔥 War Fervour | Every attack gets +1 mult |
| ☀ Clear Skies | Everyone sees 2 hexes further (fog of war games only) |

- **Alliances.** On your turn, press **ALLY** under a rival's name to propose one. Allies can't attack or enter each other's land, share vision in the fog, and if only allies are left standing they **win together**. In Conquest and World War, allies who are all allied with each other also **count their land together** toward the win.
  - **Pacts last 5 rounds** (the 🤝 badge shows how many are left). In the last 2 rounds, both sides can press **RENEW** to extend it 5 more. If either side doesn't, it lapses peacefully: no traitor penalty.
  - Either side can press **BREAK** to end it early. The break takes effect at the start of the breaker's next turn, so the other side gets a warning.
  - **Holding a pact pays.** After 2 rounds, each alliance earns both sides an **alliance dividend** of +$2 per turn, rising by $1 every 3 rounds (max +$4). A hex next to an ally's land also gets **+1 defence mult (Allied Support)**.
  - **Betrayal costs.** Whoever breaks a pact is branded a **🗡 TRAITOR** for 3 of their turns: **-40% income** and nobody will ally with them. The betrayed side gets **+2 mult (Vengeance)** on every attack against the traitor for 3 turns.
- **Bot moods.** Every bot keeps a mood towards every commander (the face next to its name shows how it feels about you). Attacks, sieges, land grabs and betrayals sour it; trades and long alliances warm it up, and grudges fade slowly. Bots read the board too: they team up against whoever is most dangerous, turn down pacts with the runaway leader, and knife an ally who gets too big. Each bot picks a war target (whoever betrayed it, the runaway leader, or its weakest neighbour), masses troops before attacking, reinforces threatened bases, and buys counters (anti-air against air power, tank hunters against armour, siege units against forts). Harder bots are more ruthless: once a pact is 3 rounds old they may break it when the common enemy is beaten, or when a weak ally sits next to them while they lead. They plan it first: they move a strike force onto the border and only break when they can hit hard.

## Win conditions

| Mode | Win by |
|---|---|
| **Domination** | Capturing every enemy HQ. |
| **Conquest** | Holding 60% of all land. |
| **Beacon** | Holding the glowing centre hex at the start of 3 of your turns in a row. |
| **World War** | Holding 45% of a colossal map, or being the last commander standing. |

An optional round limit gives the win to whoever holds the most land when time runs out.

**Teams** (lobby option). Click the TEAM chip next to each commander to pick a team (A–D). Teammates are locked into a permanent alliance: shared vision, no friendly fire, and they win together. Teammates start near each other, and in Conquest or World War the team's land counts together. Other diplomacy is switched off.

**World War** is the big one:
- A **colossal map**, always with world events.
- A **war economy**: you start with $20, a wider territory, two extra Grunts and your faction unit, and earn 25% more income.
- **Every unit gets +1 move**, and other commanders' turns play at double speed, so the huge map keeps moving.
- **🚀 Superweapon silos** sit in the no-man's-land between the HQs. Each has a 10-chip guard and a ★★ Bunker. Hold one at the start of 3 of your turns in a row and it hands you a **Mythic** card.

## A turn

1. **Resupply.** Three face-down cards are dealt. Rare and better cards glow through their backs. Click each card to flip it (`Space` flips the next one). Then either:
   - take one card and get *half* your income, or
   - skip the cards and collect the *full* income.

   You can pay to reroll the offer ($2, then $3, …).
2. **Act** in any order:
   - **Deploy** units from your deck bar (`1`–`0`).
   - **Build** from the build bar (`Z`–`M`).
   - **Move and attack.**
   - **Play tactics** from your hand.
   - **Trade** with another commander.
3. **End turn** with the END TURN button.

## Cards

| Rarity | Colour |
|---|---|
| Common | grey |
| Uncommon | green |
| Rare | blue |
| Epic | purple |
| Legendary | gold |
| **Mythic** | white, with a rainbow edge |

Legendaries and Mythics are unique: only one copy exists until it's spent or its owner is eliminated. Mythics are very rare (a sliver of resupply picks and Gilded/Mythic crates, or a superweapon silo in World War).

**Rerolls** at resupply cost a quarter of your income (min $2), and each further reroll that turn costs that much again. **Bounty** pays a fifth of your income (min $2) per enemy unit you destroy.

### Supply Drops: the slot machine

**Supply Drop** is a tactic card in three rarities. Playing one spins a reel for a crate tier. The card's rarity sets the odds:

| Supply Drop | Standard | Gilded | Mythic |
|---|---|---|---|
| Rare | 60% | 32% | 8% |
| Epic | 15% | 55% | 30% |
| Legendary | 0% | 35% | 65% |

The crate then bursts open and deals 3 cards with that tier's odds. Keep one, or scrap them all for $2.

| Crate | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Standard | 46% | 30% | 15% | 7% | 2% |
| Gilded | 8% | 30% | 32% | 22% | 8% |
| Mythic | 0% | 6% | 30% | 38% | 26% |

**Every reveal is rarity-based:**

- Commons flip in place.
- Rares spin.
- Epics fly to the centre of the screen and spin.
- Legendaries shake, spin 3½ times and detonate.

- **Your deck holds up to 10 unit cards.** Deploy as many copies of a unit as you can afford.
- **Drafting a unit you already own upgrades it:** ★ means +1 ATK and +1 DEF, up to ★★★. A maxed unit pays out $4 instead.
- **Full deck?** Choose a card to replace. Units of the replaced type already on the board stay.
- **Tactics** are single-use cards kept in your hand.

Hover any card in your deck bar or hand to see it enlarged. The **Card Index** (main menu, or the ▤ button in game) lists every card, structure, faction, and the crate odds.

## Income

```
$3 base
+ $1 per 3 land hexes connected to supply
+ $1 per 4 sea hexes connected to supply
+ $2 per resource node (land crystals and offshore oil rigs)
+ $1 per fishing ground
+ shipping lanes: each Port earns $1 per 4 of your sea hexes connected to it (max $5 per Port)
+ $2 per village, $3 per relic
+ refineries and warehouses
```

**Diminishing returns.** Buildings (refineries and warehouses) pay in full up to $8 a turn, then at half rate up to $24, then a quarter. Past $50 a turn, every extra dollar of income counts as two-thirds. Holding land always pays; farming buildings alone can't run away.

**Rivers** wind from the highlands down to the sea (or into an inland lake) as channels of water hexes, and later rivers join earlier ones as tributaries. They keep their land rules: land units ford them (2 move), a river hex defends at **+1 mult (River Crossing)**, and every 3 river hexes you hold pay **+$1** (fertile valleys). HQs, towns and other sites always sit on dry ground.

**Roads** link your buildings back to your HQ through your own land. They're for show: they break where land is captured or cut off, so you can read your supply network at a glance.

**Supply:** a hex pays only if it connects through your own territory to your HQ or a Port. A **FOB only works while it's connected** that way too: a cut-off FOB is no deploy point and supplies nothing, and you can only build a FOB on supplied land. Owned sea counts as territory, so sea lanes carry supply to your islands. Cut-off hexes are hatched on the map and pay nothing.

## The land

Maps have climate. It's colder toward the top and bottom edges and hotter in the middle, so you'll find:

| Terrain | Effect |
|---|---|
| Plains, Desert | Open ground |
| Forest | +1 defender mult |
| Jungle | +1 defender mult, costs 2 move |
| Highlands | +2 defender mult, costs 2 move |
| Tundra | Costs 2 move |
| Swamp | Costs 2 move. Attackers get −1 mult (air units excepted) |
| Red Canyons | +1 defender mult, costs 2 move |
| Mountains | Impassable except to air |

**Points of interest** are scattered across the map:

- **Ruins.** The first unit to pass through loots $4–10.
- **Supply cache.** The first unit to pass through finds a tactic card (common 40%, uncommon 35%, rare 18%, epic 6%, legendary 1%).
- **Village.** Neutral town with a militia of 3–9 chips (+1 mult, +2 from 7 chips). Conquer it for **+$2 every turn**. The pips under its marker show how strong it is.
- **Old fort.** Garrisoned ruin (3–8 chips) with a ★ to ★★★ Bunker. Take it and the bunker is yours.
- **Ancient relic.** **+$3 every turn** while you hold it. Relics sit as far from every HQ as possible.

## Moving

- Ground units and ships **seize every unclaimed hex they pass through**. Aircraft can't hold ground they fly over: **every aircraft only takes the hex it lands on.** Valkyrie and Seraph gunships can fly over enemy land, and get **Strafing Run** (+2 mult attacking ground targets).
- **Fog of war:** if something hidden blocks the route you planned, your troops go as far as they can, or run into the hidden enemy (an ambush).
- **March orders:** Ctrl+click a hex (or select a stack, press `M`, then click) to give the stack a standing order. At the start of each of your turns it advances toward the objective by itself, and it halts on enemy contact or when it arrives. Select it and press `Delete` to cancel.
- Highlands, jungle, tundra, swamp and canyons cost 2 move, and so does fording into a **river** hex. Rangers ignore this. **A unit can always move at least one hex**, so slow units like the Goliath never get stuck in rough ground (and a Blizzard never takes a unit below 1 move).
- Mountains block movement except for air units. Open water blocks land units unless they're aboard an Ark; air units and hover tanks fly or glide across it.
- A hex holds at most 5 units, and mixed types share a stack freely. A hex of nothing but Grunts can hold 10.
- Entering an empty enemy hex captures it. Entering an occupied hex starts a fight.

## Combined assaults (pincers)

1. Select a stack.
2. **Shift-click** your other stacks to add them to the selection.
3. Click a red target.

Every selected stack that can reach the target attacks together. You get **Pincer** +1 mult per extra stack (max +2) on top of everything else.

## Combat: chips × mult

```
Attacker score = total ATK chips × (d6 + attacker mult)
Defender score = total DEF chips × (d6 + defender mult)
```

You **throw your own die**: drag and fling it in the dice tray, or press `Space`. The defender wins ties.

- The loser's stack is wiped out.
- If the loser scored at least 60% of the winner's score, the winner also loses its weakest unit.

| Bonus | Effect |
|---|---|
| Combined Arms | +1 mult per extra unit *class* in the attack (infantry, vehicle, air, artillery, naval), max +3 |
| Pincer | +1 mult per extra attacking stack, max +2 |
| Flanking | +1 mult per *other* friendly stack touching the target, max +2 |
| Veteran ★ | +1 chip per star on each unit |
| Forest / Highlands | +1 / +2 defender mult |
| Bunker / FOB / HQ | +2 / +1 / +2 defender mult; an HQ also has +3 garrison chips |
| Smoke Screen | +2 defender mult |
| Tank Hunter / Torpedoes | +3 chips vs vehicles / +4 chips vs ships |
| Anti-Air | Stinger +3, Scorpion +4, Skyguard +6, Sentinel +4 chips in any fight involving enemy aircraft |
| Strafing Run | +2 mult when Valkyries or Seraphs attack ground targets |
| Siege Breaker | +2 mult vs fortified hexes |
| Aegis / Flak | +1 defender mult / +2 vs air |
| Shore Assault | −1 mult when ships alone attack a land hex |

**No contest.** When the odds show 100%, every possible roll wins, so there's no dice roll at all. The defenders are **obliterated** on the spot, and you take no pyrrhic losses.

## Artillery and gunships

Units with a range stat fire instead of moving.

- If the shot wins, it destroys 1 unit (2 if you double the defender's score).
- If it misses, nothing happens.
- Shots can't pass through mountains (the Oracle and the Sentinel ignore this).
- The **Sentinel** SAM battery only engages stacks with aircraft in them, and only shoots down aircraft.

## The sea

- **Sea control.** Ships claim every sea hex they sail through. Owned sea pays income, carries supply, and holds **offshore oil rigs** worth $2 each.
- **Fishing grounds** (red buoys) are worth +$1 each while you hold them.
- **Ports** are built on coastal hexes. They launch ships into the adjacent sea and act as a supply source. Each Port also earns from **shipping lanes**: $1 per 4 of your sea hexes connected to it, up to $5.
- **Treasure islands.** Small islands away from the HQs carry ruins, caches, villages and often a relic. Sail an Ark over, or fly in.
- **Naval gunfire.** Each of your warships next to a land hex being fought over adds +2 chips to your side, up to 3 ships. That works whether you're attacking or defending. Ships that aren't in the fight themselves still help, so a fleet off the coast backs up your land war.
- Ignoring the sea costs you nothing; it's extra money and firepower for whoever takes it.
- **Coastal fighting:**
  - Ships can assault enemy units on adjacent coastal hexes. They kill the defenders on a win but can't occupy land.
  - Land units can attack enemy ships next to their shore.
- **Transports.** An Ark launches from a Port, or from any **coastal HQ or connected FOB**, so you don't need a Port to use one. Land units move onto an Ark to board it (3 per Ark). The Ark carries them as it sails. Select the Ark's hex and its passengers' landing hexes light up too: click one to wade ashore. If the Ark sinks, its cargo drowns.
- **Carrier** (Legendary). A floating airbase: deploy aircraft straight onto it, fly them off it and land them back on it (4 per Carrier). They ride along when it sails. If it sinks, aircraft still on board ditch into the sea.
- **Open Ocean** maps are a scatter of small islands with lots of oil rigs. Every commander starts with a Port and an Ark.
- **Bridges** span a one-hex sea gap between two shores. Land units walk across, but ships can't pass, so a bridge blocks the channel. Sabotage destroys a bridge, and anyone standing on it drowns.

## Buildings and upgrades

Build from the build bar (`Z` and onward, nine slots). To **upgrade** a structure, build the same one again on the same hex. Each structure goes up to ★★★, and each level costs more: ×1.5, then ×2.25. Every building you buy also makes the next one of that type $2 dearer (HQ fortification excepted), so spreading out across building types is cheaper than spamming one.

| Structure | Per level |
|---|---|
| **Fortify (HQ)** | +3 garrison chips and +1 mult |
| **FOB** | +1 defence mult |
| **Warehouse** | +$2 (+$3 when next to a resource node, Refinery or Port) |
| **Refinery** | +$1 (+$3 on a resource node or oil rig) |
| **Depot** | +1 to its range for the move bonus |
| **Bunker** | +3 garrison chips (even when empty, so it must be attacked) and +1 defence mult (★ gives +2). From ★★, your neighbouring hexes get +1 mult (Bunker Line). **Hold the Line:** when defended against a stronger attack, +40% of the attacker's chip lead (max 4 per level). **★★★ Citadel:** 14 garrison chips, +5 mult, +2 mult to neighbours, and Hold the Line takes 60% of the lead (max 20). **Destroyed** when an enemy captures its hex |
| **Sea Mine** | The naval Bunker, built on your own sea: +3 garrison chips per level (so enemy ships must fight through instead of sailing past) and +2 defence mult (+1 per extra level). Cleared when an enemy captures the hex |
| **Flak** | +1 hex of anti-air coverage |

Ports and bridges don't upgrade. **Sabotage** knocks a level off a structure, and destroys it only at ★.

**Stacking.** A hex can hold up to **3 different buildings**, for example a Warehouse★★, a Bunker and a Depot. Bridges take a hex to themselves, and so does your **HQ**: nothing else can be built on the HQ hex (fortify it instead; the Fortify card fortifies the HQ when played there).

**New and captured bases.** A FOB you build, and a FOB or Port you capture, comes online at the start of your next turn. You can't build or capture one and deploy on it the same turn.

## Eliminations

When a commander falls, the conqueror takes their **heartland** (hexes within 2 of the fallen HQ) and $10 plunder. The rest of the fallen empire **collapses into neutral land** for anyone to claim, and the buildings out there are wrecked (bridges remain, unowned).

## HQ sieges

Taking an enemy HQ doesn't knock them out straight away: it puts their HQ **under siege**. The defender gets one full turn cycle to strike back. If your troops are still standing on that HQ when your next turn starts, they're eliminated. If they retake it or drive you off, the siege collapses. A besieged HQ can't deploy units or supply territory, and its garrison bonus is gone. Instead you get an **emergency muster**: every hex you own next to your besieged HQ becomes a deploy point, and troops deployed there can attack immediately, so you can rush in defenders and take your HQ back the same turn.

## Menus and joining

- **Ready up.** In the lobby every guest presses **READY UP**; the host's **DEPLOY** stays locked until everyone is ready. Changing a setting un-readies everyone, so nobody gets surprised.
- **Dropping out.** If a player disconnects mid-game, a bot covers their empire after 30 seconds (marked 📡 AWAY), and hands it back the moment they reconnect.
- **Kicking.** The host can kick a player mid-game with the ✕ on their name (click twice). A bot takes over their empire and they can't rejoin that seat.
- **Esc** opens the pause menu: resume, rules, card index, sound, and **Leave game**. When you leave, a bot takes over your empire so everyone else can keep playing. The host can also **End game for everyone**.
- On the main menu, **Join a game** scans your Wi-Fi for SECTOR servers (it starts scanning as soon as you open it). Games in progress show their round and how many bots are playing; press **WATCH** to spectate. You can also type an address, or pick a recent server.
- **Take over a bot.** While you're spectating a game in progress, every bot has a **TAKE OVER** button under its name. Press it to take command of that bot's empire: its land, army, cards and cash become yours.
- **Skipping.** Click a battle or press **Space** to skip it. If anyone fighting in a battle skips it, it skips for everyone watching, and anyone can skip a fight between bots.
- **The log** only shows the headlines: falls, sieges, pacts, betrayals, nukes, wins, and fights that involve you.

## Encirclement

If your territory completely surrounds a land pocket of 10 hexes or fewer, the pocket is **annexed** automatically. This works on neutral land, and on enemy hexes with no troops and no HQ, FOB or Port.

The same goes for water: a pocket of 12 or fewer sea hexes walled in by your coast and your own sea, with no enemy ships inside, becomes yours.

## Trading

On your turn, click **TRADE** under a rival's name. You can offer cash and tactic cards in exchange for cash. They accept or decline. Bots weigh offers by value, are greedier on higher difficulties, and won't feed a runaway leader.

## Blueprint

While others play, queue moves, deploys and builds. The preview shows exactly what your turn will look like, including income, Depot move bonuses and newly online bases. When your turn starts, income is collected automatically and the queue runs. Untick *auto-collect income* if you'd rather choose from the resupply first; the queue then runs right after your pick. You can queue a move from the spot an earlier queued move left your units. Attacks and tactics are live-only, and any order the board no longer allows is skipped with a note.

## Turn timer and undo

- With a **turn timer** set, a bar under the top bar drains in the current player's colour, turning red for the last 10 seconds. The clock **pauses while your fights and crates play out**, and your resupply pick gets 20 seconds of its own. If time runs out, income is collected and your turn ends.
- **Undo** (↶ button or `Ctrl+Z`) takes back moves, deploys and builds that didn't reveal anything: no fights, loot or cards, and in fog of war no newly seen hexes. You can undo several steps back to the last such reveal. If nothing can be undone, it tells you why. In the blueprint, `Ctrl+Z` takes back the last queued order.
- **Auto-end turn:** when you have nothing left to do (no stack can act, nothing affordable to deploy or build, no tactic to play), your turn ends after a 3-second countdown. Press STAY to keep it, or switch it off in the Esc menu.
- **Whose turn:** a pill under the top bar always shows whose turn it is (and when you're next). On your turn the screen edge glows in your colour.
- **Game speed:** Normal, Fast or Superspeed (lobby setting, or the speed button for the host). Faster speeds make bot turns and other players' animations quicker. When only bots are left, anyone can change it, up to 🚀 Max.
- **AFK:** a connected player who sits idle through 2 turns gets a bot covering for them until they press any key or click. Without a turn timer, a turn with no sign of life ends after 2 minutes.
- **Fast placing.** In deploy or build mode you can click as fast as you like: each click is sent straight away, even while the last drop is still landing.

## Controls

| Input | Action |
|---|---|
| Click | Select / order |
| Shift-click | Add a stack (pincer) |
| Right-click, `Esc` | Cancel |
| Drag, `WASD` | Pan |
| Mouse wheel | Zoom |
| `1`–`0` | Deploy |
| `Z`–`M` | Build |
| `Space` | Flip the next card · throw your die · skip the animation playing (never ends your turn) |
| Click a flipping card | Finish its reveal at once; quick clicks flip the rest at triple speed |
| Hold `Alt` | Troops-only view: the board fades out and every stack shows its total attack and defence |
| Crate (Supply Drop) | Click or `Space` to burst it open |
| `F` | Jump to your HQ |
| `Tab` / `Shift+Tab` / `E` | Select the next stack that can still act |
| `Ctrl`-click, or `M` then click | Give the selected stack a march order |
| `Delete` | Cancel the selected stack's march order |
| `Ctrl+Z` | Undo the last move, deploy or build |
| `Enter` ×2 | **End your turn** (press twice; opens chat when it isn't your turn) |
| `T` | Chat |
| Hover a card | Enlarge it |
