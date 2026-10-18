# How to play SECTOR

Grab land, build an economy, crush your rivals. **Every hex you hold pays you**, so standing still is losing.

## Setup and the opening draft

- 2–8 commanders: humans over the network, bots (Easy, Medium, Hard, Impossible), and **pass-and-play** players sharing one device. Anyone can press 👁 in the lobby to **spectate** instead of play. A cover screen hides each player's hand between turns.
- Every map is procedurally generated from one of six layouts: continent, supercontinent, twin continents, archipelago, inland sea, or crescent isles. The coastline is noise-warped, so no two boards share an outline. Sizes run from Small to **Huge** (about 3.5× the land of Small).
- **Spawns.** With *Random* spawns, HQs are placed fairly far apart. With *Pick your HQ*, commanders take turns choosing their HQ hex (whoever moves last picks first). HQs must sit a minimum distance apart, and bots pick roomy spots near resources.
- Everyone starts with an HQ and its surrounding hexes, 2 Grunts, $6, a **Rare Supply Drop** card, and three unit cards: **Grunts**, the **Ark** transport, and their faction's starter unit.
- **Opening draft.** Before round 1, every commander picks simultaneously. In each of 3 draft rounds you're offered 3 cards and keep 1.

## Fog of war, events and alliances

- **Fog of war** (lobby option). You see one hex past your borders, two hexes around your units (three for aircraft), and everything your allies see. Enemy units and buildings in the fog are hidden; HQs are always known. March into a fogged hex that hides enemies and you'll fight them: an ambush.
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

- **Alliances.** On your turn, press **ALLY** under a rival's name to propose one. Allies can't attack or enter each other's land, share vision in the fog, and if only allies are left standing they **win together**. Either side can press **BREAK** to end it. The break takes effect at the start of the breaker's next turn, so the other side gets a warning.

## Win conditions

| Mode | Win by |
|---|---|
| **Domination** | Capturing every enemy HQ. |
| **Conquest** | Holding 60% of all land. |
| **Beacon** | Holding the glowing centre hex at the start of 3 of your turns in a row. |

An optional round limit gives the win to whoever holds the most land when time runs out.

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

Legendaries are unique: only one copy exists until it's spent or its owner is eliminated.

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
+ refineries and markets
```

**Supply:** a hex pays only if it connects through your own territory to your HQ, a FOB, or a Port. Owned sea counts as territory, so sea lanes carry supply to your islands. Cut-off hexes are hatched on the map and pay nothing.

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
- **Supply cache.** The first unit to pass through finds a tactic card.
- **Village.** Neutral town with a militia of 3–9 chips (+1 mult, +2 from 7 chips). Conquer it for **+$2 every turn**. The pips under its marker show how strong it is.
- **Old fort.** Garrisoned ruin (3–8 chips) with a ★ to ★★★ Bunker. Take it and the bunker is yours.
- **Ancient relic.** **+$3 every turn** while you hold it. Relics sit as far from every HQ as possible.

## Moving

- Units **seize every unclaimed hex they pass through**.
- Highlands, jungle, tundra and swamp cost 2 move. Rangers ignore this.
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
| Siege Breaker | +2 mult vs fortified hexes |
| Aegis / Flak | +1 defender mult / +2 vs air |
| Shore Assault | −1 mult when ships alone attack a land hex |

**No contest.** When the odds show 100%, every possible roll wins, so there's no dice roll at all. The defenders are **obliterated** on the spot, and you take no pyrrhic losses.

## Artillery and gunships

Units with a range stat fire instead of moving.

- If the shot wins, it destroys 1 unit (2 if you double the defender's score).
- If it misses, nothing happens.
- Shots can't pass through mountains (the Oracle ignores this).

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
- **Transports.** Land units move onto an Ark to board it (3 per Ark). The Ark carries them as it sails, and they step off onto any coast later. If the Ark sinks, its cargo drowns.
- **Bridges** span a one-hex sea gap between two shores. Land units walk across, but ships can't pass, so a bridge blocks the channel. Sabotage destroys a bridge, and anyone standing on it drowns.

## Buildings and upgrades

Build from the build bar (`Z` and onward, nine slots). To **upgrade** a structure, build the same one again on the same hex. Each structure goes up to ★★★, and each level costs more: ×1.5, then ×2.25. Every building you buy also makes the next one of that type $1 dearer (HQ fortification excepted), so spreading out across building types is cheaper than spamming one.

| Structure | Per level |
|---|---|
| **Fortify (HQ)** | +3 garrison chips and +1 mult |
| **FOB** | +1 defence mult |
| **Market** | +$3, and each level counts toward the trade network |
| **Refinery** | +$2 (+$4 on a resource node or oil rig) |
| **Depot** | +1 to its range for the move bonus |
| **Bunker** | +3 garrison chips (even when empty, so it must be attacked) and +1 defence mult (★ gives +2). From ★★, your neighbouring hexes get +1 mult (Bunker Line) |
| **Flak** | +1 hex of anti-air coverage |

Ports and bridges don't upgrade. **Sabotage** knocks a level off a structure, and destroys it only at ★.

**Stacking.** A hex can hold up to **3 different buildings**, for example a Market★★, a Bunker and a Depot. Bridges take a hex to themselves.

**New and captured bases.** A FOB you build, and a FOB or Port you capture, comes online at the start of your next turn. You can't build or capture one and deploy on it the same turn.

## HQ sieges

Taking an enemy HQ doesn't knock them out straight away: it puts their HQ **under siege**. The defender gets one full turn cycle to strike back. If your troops are still standing on that HQ when your next turn starts, they're eliminated. If they retake it or drive you off, the siege collapses. A besieged HQ can't deploy units or supply territory, and its garrison bonus is gone. Instead you get an **emergency muster**: every hex you own next to your besieged HQ becomes a deploy point, and troops deployed there can attack immediately, so you can rush in defenders and take your HQ back the same turn.

## Menus and joining

- **Esc** opens the pause menu: resume, rules, card index, sound, and **Leave game**. When you leave, a bot takes over your empire so everyone else can keep playing. The host can also **End game for everyone**.
- On the main menu, **Join a game** scans your Wi-Fi for SECTOR servers. You can also type an address, or pick a recent server.

## Encirclement

If your territory completely surrounds a land pocket of 10 hexes or fewer, the pocket is **annexed** automatically. This works on neutral land, and on enemy hexes with no troops and no HQ, FOB or Port.

The same goes for water: a pocket of 12 or fewer sea hexes walled in by your coast and your own sea, with no enemy ships inside, becomes yours.

## Trading

On your turn, click **TRADE** under a rival's name. You can offer cash and tactic cards in exchange for cash. They accept or decline. Bots weigh offers by value, are greedier on higher difficulties, and won't feed a runaway leader.

## Blueprint

While others play, queue moves, deploys and builds. The preview shows exactly what your turn will look like, including income, Depot move bonuses and newly online bases. When your turn starts, income is collected automatically and the queue runs. Untick *auto-collect income* if you'd rather choose from the resupply first; the queue then runs right after your pick. You can queue a move from the spot an earlier queued move left your units. Attacks and tactics are live-only, and any order the board no longer allows is skipped with a note.

## Turn timer and undo

- With a **turn timer** set, a bar under the top bar drains in the current player's colour, turning red for the last 10 seconds. The clock **pauses while your fights and crates play out**, and your resupply pick gets 20 seconds of its own. If time runs out, income is collected and your turn ends.
- **Undo** (↶ button or `Ctrl+Z`) takes back moves, deploys and builds that didn't reveal anything: no fights, loot or cards. You can undo several steps back to the last such reveal.

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
| `Space` | Flip the next card · throw your die (never ends your turn) |
| Crate (Supply Drop) | Click or `Space` to burst it open |
| `F` | Jump to your HQ |
| `Ctrl+Z` | Undo the last move, deploy or build |
| `Enter` ×2 | **End your turn** (press twice; opens chat when it isn't your turn) |
| `T` | Chat |
| Hover a card | Enlarge it |
