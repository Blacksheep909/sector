# How to play SECTOR

Grab land, build an economy, crush your rivals. **Every hex you hold pays you**, so standing still is losing.

## Setup and the opening draft

- 2–10 commanders: humans over the network, bots (Easy, Medium, Hard, Impossible), and **pass-and-play** players sharing one device. Anyone can press 👁 in the lobby to **spectate** instead of play. A cover screen hides each player's hand between turns.
- Every map is procedurally generated from one of seven layouts: continent, supercontinent, twin continents, archipelago, inland sea, crescent isles or open ocean. Rivers branch into tributaries, small lakes sit in the lowlands, and mountain ranges throw out ridges of highlands. The coastline is noise-warped, so no two boards share an outline. Sizes run from Small to **Huge** (about 3.5× the land of Small).
- Every map also has a **theme**, its climate: Mixed climates, Grasslands (open plains), Woodland (forests and some swamp), Desert (sand and canyons), Badlands (red canyons and scrub), Arctic (snowfields and tundra), Jungle, Wetlands (swamps, lakes and forest) or Highlands (ridges and mountains). **Random** (the default) rolls one for each war, from the seed, so a shared seed gives the same map. The map reel names it, and the ground is coloured to match (snow on arctic plains, dry scrub in the desert). Missions keep their own hand-built maps.
- **Spawns.** With *Random* spawns, HQs are placed fairly far apart. With *Pick your HQ*, commanders take turns choosing their HQ hex (whoever moves last picks first). HQs must sit a minimum distance apart, and bots pick roomy spots near resources. In fog of war you only see the hexes you can still pick, never where the others set up.
- Everyone starts with an HQ and its surrounding hexes, 2 Grunts, $6, a **Rare Supply Drop** card, and two unit cards: **Grunts** and their faction's starter unit. Commanders who start on a small island also get the **Ark** transport so they can reach the mainland.
- **Opening draft.** Before round 1, every commander picks simultaneously. In each of 3 draft rounds you're offered 3 cards and keep 1.

## Fog of war, events and alliances

- **Fog of war** (lobby option). You see one hex past your borders, two hexes around your units (three for aircraft), and everything your allies see. **Unexplored** hexes are completely hidden, rival HQs included: you have to find them. Hexes you've explored but can't see right now show what you **last saw** there, without units. March into a hex that hides enemies and you'll fight them: an ambush. **Bots play by the same fog:** they only know what a player in their seat would.
- **World events** (on by default). From round 3, most rounds roll an event that lasts the whole round:

| Event | Effect |
|---|---|
| ⛈ Storm Front | Aircraft are grounded |
| 🌊 Rough Seas | Ships stay in port |
| ❄ Blizzard | Every unit has 1 less move (minimum 1) |
| 💰 Gold Rush | Resources and oil rigs pay double |
| 🛒 Arms Fair | Units cost $1 less |
| 📦 Supply Shortage | Buildings cost $2 more |
| 🔥 War Fervour | Every attack gets +1 mult |
| ☀ Clear Skies | Everyone sees 2 hexes further (fog of war games only) |

- **Alliances.** Any time (not just on your turn), press **ALLY** under a rival's name to propose one. Allies can't attack each other or take each other's land, but their troops may **cross and stop on each other's empty land** (if a pact ends with your troops still in the other side's territory, they're lost), know where each other's HQ is (but each still sees only with their own troops and land in the fog; teammates in a team game do share vision), and if only allies are left standing they **win together**. In Conquest and World War, allies who are all allied with each other also **count their land together** toward the win.
  - **Pacts last 5 rounds** (the 🤝 badge shows how many are left). In the last 2 rounds, both sides can press **RENEW** to extend it 5 more. If either side doesn't, it lapses peacefully: no traitor penalty.
  - **No mega-alliances:** a bloc (everyone linked by pacts) can hold at most half the commanders still standing, and never fewer than 2. A pact that would make it bigger is refused, and one that ends up too big as commanders fall can't be renewed (it lapses peacefully).
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

**Teams** (lobby option). The lobby splits into team columns: drag a name onto another team to move it (the host can move anyone, and players can move themselves; the ⇄ chip does the same on a touch screen). Each team plays in one colour: Team A red, Team B blue, Team C gold, Team D green (a hex's tooltip says which teammate holds it). Teammates are locked into a permanent alliance: shared vision, no friendly fire, and they win together. Teammates start near each other, and in Conquest or World War the team's land counts together. Other diplomacy is switched off.
- **Fight as one army.** You can **deploy at a teammate's FOB** (while their own troops aren't standing on it) and **launch ships from their Ports**.
- **Open hands.** You see your teammates' tactic cards and cash. Press **🃏 TEAM** under a teammate's name for the team panel: **send them cash** ($2, $5 or $10) or **pass them a card**, instantly, any time.
- **Team chat.** In a team game the chat goes to your team by default; the **TEAM / ALL** switch (or Tab) flips it. **Map pings** only ever reach your own side.
- The top bar shows each team's land (just your own team's in the fog), and bot teammates send cash to a teammate who's run dry.

**World War** is the big one:
- A **colossal map**, always with world events.
- A **war economy**: you start with $20, a wider territory, two extra Grunts and your faction unit, and earn 25% more income.
- **Every unit gets +1 move**, and other commanders' turns play at double speed, so the huge map keeps moving.
- **🚀 Superweapon silos** sit in the no-man's-land between the HQs. Each has a 10-chip guard and a ★★ Bunker. Hold one at the start of 3 of your turns in a row and it hands you a **Mythic** card.

## A turn

1. **Resupply.** Three face-down cards are dealt. Rare and better cards glow through their backs. Click each card to flip it (`Space` flips the next one). Then either:
   - take one card and keep most of your income, or
   - skip the cards and collect the *full* income.

   A card costs part of that turn's income: a little for its rarity (common $2, uncommon $3, rare $5, epic $8, legendary $12, mythic $16) plus 15% of your income, and never more than half. The cash you'd keep shows under each card. Early on that's about half your income; once you earn $100+ a turn a card costs a fraction of it. **Big economies also flip rarer cards:** from $30 a turn the odds slide toward rare, epic and legendary, fully by $150.

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

Legendaries and Mythics are unique: only one copy exists until it's spent or its owner is eliminated. Mythics are very rare (a sliver of resupply picks and Gilded/Mythic packs, or a superweapon silo in World War).

**The black market.** Once your income reaches **$50 a turn**, the black market opens for good (you'll see a banner). Every turn it stocks **5 random tactic cards** that you can buy outright for cash with the round purple **black market** button on your cash panel. Each costs a set price for its rarity (common $6, uncommon $9, rare $14, epic $22, legendary $34, mythic $50) plus a fifth of your income. The stock is yours alone and changes every turn: what you don't buy is gone. Like resupply, a big economy finds rarer cards there.

**Rerolls** at resupply cost a quarter of your income (min $2), and each further reroll that turn costs that much again. **Bounty** pays a fifth of your income (min $2) per enemy unit you destroy.

### Supply Drops: the slot machine

**Supply Drop** is a tactic card in three rarities. Playing one spins a reel for a crate tier. The card's rarity sets the odds:

| Supply Drop | Standard | Gilded | Mythic |
|---|---|---|---|
| Rare | 60% | 32% | 8% |
| Epic | 15% | 55% | 30% |
| Legendary | 0% | 35% | 65% |

A card pack of that tier drops in: tear it open along the top (drag across the seam, or click and it tears itself) and light the colour of the best card inside pours out, then it deals 3 cards with that tier's odds. Keep one, or scrap them all for $2 (more as your income grows: scrap value, ruins loot and maxed-card payouts all scale with a tenth of your income).

| Pack | Common | Uncommon | Rare | Epic | Legendary |
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
- **Drafting a unit you already own upgrades it:** ★ means +1 ATK and +1 DEF, up to ★★★. A maxed unit pays out $4 instead (scaled up with your income).
- **Full deck?** Choose a card to replace. Units of the replaced type already on the board stay.
- **Tactics** are single-use cards kept in your hand.

Hover any card in your deck bar or hand to see it enlarged. The **Card Index** (main menu, or the ▤ button in game) lists every card, structure, faction, and the crate odds.

## Income

```
$3 base
+ $1 per 3 land hexes connected to supply
+ $1 per 4 sea hexes connected to supply
+ $2 per resource node (land crystals and offshore oil rigs)
+ shipping lanes: each Port earns $1 per 4 of your sea hexes connected to it (max $5 per Port)
+ $2 per village, $3 per relic
+ refineries and warehouses
```

**Diminishing returns.** Buildings (refineries and warehouses) pay in full up to $8 a turn, then at half rate up to $24, then a quarter. Past $50 a turn, every extra dollar of income counts as two-thirds. Holding land always pays; farming buildings alone can't run away.

**Rivers** wind from the highlands down to the sea (or into an inland lake) as channels of water hexes, and later rivers join earlier ones as tributaries. **Vehicles and artillery can't cross a river without a bridge**: build a Bridge on a river hex that's yours or that touches your supplied land. **Nobody stands in a river.** Infantry can ford one straight across, from bank to far bank, but only from a standing start and it takes their whole move. Aircraft fly over, and Grunts riding in a helicopter go with it. A river hex defends at **+1 mult (River Crossing)**, and every 3 river hexes you hold pay **+$1** (fertile valleys). Nothing but a Bridge can be built on a river hex. HQs, towns and other sites always sit on dry ground.

**Roads** link your buildings back to your HQ through your own land. They're for show: they break where land is captured or cut off, so you can read your supply network at a glance.

**Economic warfare.** You can wreck a rival's economy without fighting their troops:
- **Gun Run, Airstrike and Precision Strike** can target an enemy hex that has economic buildings (Warehouse, Refinery, Depot, Port) and no troops. Gun Run knocks a level off, Airstrike 1–2 levels, and Precision Strike destroys a building outright. A ★ building, or a Port, is destroyed when it loses its last level.
- **Artillery and warships** can shell undefended economic buildings in range: each salvo knocks off a level.
- **Strategic Bombing** (Rare) hits a hex and its neighbours: their economic buildings lose a level, and that land is **bombed out**, paying nothing for its owner's next 2 turns (supply still runs through it). Each enemy unit under the bombs has a **30% chance to be destroyed** (Carpet Bombing, the epic, kills at 50%).

**Air defence.** Anti-air units can shoot down air strikes (Gun Run, Kamikaze Drone, Airstrike, Precision Strike, Cruise Missile, Bunker Buster, Carpet and Strategic Bombing) aimed near them. A Stinger covers its own hex (25%), a Scorpion 1 hex (35%), a Skyguard 2 (50%), a Grumble 3 (55%) and a Sentinel 3 (60%). Chances stack, up to 90%. Precision Strikes are only 60% as likely to be caught. A downed strike still spends the card. Anti-air also blocks Heli Drops and EMPs within that same reach. (The old Flak building is gone: anti-air units do its job.) **Nukes and the Tsar Bomba can't be stopped.** The **Trident** submarine's missile (range 4) can only be intercepted by Sentinel and Grumble batteries within 3 of its target.

**Supply:** a hex pays only if it connects through your own territory to your HQ or a Port. A **FOB supplies land only while it's connected** that way too (a cut-off FOB still takes reinforcements, but supplies nothing), and you can only build a FOB on supplied land. Owned sea counts as territory, so sea lanes carry supply to your islands. Cut-off hexes are hatched on the map and pay nothing.

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

- **Ruins.** The first unit to pass through loots $4–10 (more later in the war, scaled with your income).
- **Supply cache.** The first unit to pass through finds a tactic card (common 40%, uncommon 35%, rare 18%, epic 6%, legendary 1%).
- **Village.** Neutral town with a militia of 3–9 chips (+1 mult, +2 from 7 chips). Conquer it for **+$2 every turn**. The pips under its marker show how strong it is.
- **Abandoned FOB.** A war-torn forward base nobody holds, with no garrison. Drive a unit onto it and it becomes your ★ FOB (a deploy point and supply source, online next turn).
- **Ancient relic.** **+$3 every turn** while you hold it. Relics sit as far from every HQ as possible.

## Moving

- Ground units and ships **seize every unclaimed hex they pass through**. Aircraft can't hold ground they fly over: **every aircraft only takes the hex it lands on.** Gunships (Valkyrie, Seraph, and the Wren, Ravager and Banshee helicopters) can fly over enemy land, and get **Strafing Run** (+2 mult attacking ground targets).
- **Troop carriers.** Grunts moving together with a carrier ride along at its speed and over its terrain: helicopters and the Valkyrie fly them over mountains and water, and APCs drive them. Seats: Wren 2, Bulwark 4, Outrider 4, Stormcrow 6, Valkyrie 8. It's all or nothing: with more Grunts than seats, nobody rides and the group walks. Grunts aboard don't count toward the 5-unit limit, but **no hex ever holds more than 10 units**, carriers or not. A helicopter carrying troops can hover over water (they stay aboard), but it can't fly off and leave them there, and if it goes down, the passengers who don't fit go down with it.
- **Fog of war:** if something hidden blocks the route you planned, your troops go as far as they can, or run into the hidden enemy (an ambush).
- **March orders:** Ctrl+click a hex (or select a stack, press `M`, then click) to give the stack a standing order. At the start of each of your turns it advances toward the objective by itself, and it halts on enemy contact or when it arrives. Select it and press `Delete` to cancel.
- Highlands, jungle, tundra, swamp and canyons cost 2 move. Fording a **river** takes an infantry unit's whole move, straight across to the far bank (vehicles need a bridge). **A unit can always move at least one hex**, so slow units like the Goliath never get stuck in rough ground (and a Blizzard never takes a unit below 1 move).
- Mountains block movement except for air units. Open water blocks land units unless they're aboard an Ark; aircraft fly across it, and can end their move over it.
- A hex holds at most 5 units, and mixed types share a stack freely. A hex of nothing but Grunts can hold 10, and so can a stack whose Grunts ride in carriers (never more than 10).
- Entering an empty enemy hex captures it. Entering an occupied hex starts a fight.
- **Sweeping advance:** undefended enemy land doesn't slow you down. Troops keep moving at full speed through empty enemy hexes and capture every one on the way. They stop when they take a fortified hex (a FOB), when they come next to enemy troops, or at a river. Bunkers and HQs still have to be attacked.

## Combined assaults (pincers)

1. Select a stack.
2. **Shift-click** your other stacks to add them to the selection.
3. Click a red target.

Every selected stack that can reach the target attacks together. You get **Pincer** +1 mult per extra stack (max +2) on top of everything else.

## Combat: chips × mult

```
Attacker score = total ATK chips × (d6 + 2 + attacker mult)
Defender score = total DEF chips × (d6 + 2 + defender mult)
```

You **throw your own die**: drag and fling it in the dice tray, or press `Space`. Every roll gets +2 (training), so luck can still swing a close fight but a clearly stronger, better-supported army wins far more reliably (twice the chips wins about 9 times in 10). The defender wins ties.

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
| Anti-Air | Stinger +3, Scorpion +4, Skyguard +6, Sentinel +7, Grumble +7 chips in any fight involving enemy aircraft |
| Strafing Run | +2 mult when gunships (Valkyrie, Seraph, Wren, Ravager, Banshee) attack ground targets |
| Hellfire | +3 chips per Banshee against vehicles |
| Ground Fire | +1 chip per infantry unit in any fight against helicopters (rifles hit helicopters too) |
| Siege Breaker | +2 mult vs fortified hexes |
| Aegis | +1 defender mult |
| Shore Assault | −1 mult when ships alone attack a land hex |

**No contest.** When the odds show 100%, every possible roll wins, so there's no dice roll at all. The defenders are **obliterated** on the spot, and you take no pyrrhic losses.

## Artillery, anti-air and gunships

Units with a range stat fire instead of moving.

- If the shot wins, it destroys 1 unit, 2 if your score beats the defender's by half again (×1.6), and 3 if by two and a half times.
- If it misses, nothing happens.
- **Shelling brings walls down:** against a shot from artillery alone, a Bunker's and a FOB's walls count for half their mult.
- Shots can't pass through mountains (the Oracle, and anti-air firing at aircraft, ignore this).
- **Anti-air fires only at aircraft**, and only shoots down aircraft: the Stinger team at **1 hex**, the Scorpion and Skyguard at **2**, and the **Sentinel** (Patriot) and **Grumble** (S-300) batteries at **3**. On overwatch it only fires at a move that includes aircraft.
- **Covered airspace (passive air defence).** Anti-air also fires **on its own, during the enemy's turn**, at enemy aircraft that **end a move** within its passive range: its range less 1, at least 1 (Stinger, Scorpion and Skyguard **1 hex**, Sentinel and Grumble **2**). It's a normal ranged roll with a **Snap Shot −1 Mult**, each anti-air stack fires **once per enemy turn** (the first aircraft to stop in its cover draws the fire, so a second flight can follow it in), and firing this way doesn't use up its own turn. Flying *through* covered airspace is safe; only where you stop counts, and attacking the anti-air directly doesn't trigger it. The Phantom's stealth keeps it out of the fight. **Grunts aboard a helicopter that's shot down go down with it.** While you move aircraft, the airspace enemy anti-air covers is shaded red on the map.
- **Missiles go for the aircraft:** when anti-air fires, only the aircraft on the target hex defend; troops riding in them or standing below don't add their defence.
- **Anti-air only really fights aircraft.** Against a hex with no aircraft in it, each anti-air unit is just its crew's small arms: **1 chip** (**AA Guns vs Ground**). Against aircraft it's the missiles that count, in a ranged shot or a close assault alike (**Missiles Only** plus its **Anti-Air** chips).
- **Guns only hit the ground.** Artillery and other guns can't shell aircraft: a hex with nothing but aircraft isn't a target, and when they shell a hex with aircraft over it, only the ground units defend and only ground units can be hit (**Ground Only**). Dragged into a close assault, each gun is just its crew: **1 chip** (**Guns in Close Combat**). Guns and anti-air are thin-skinned too (defence 1, the Oracle 2): keep them behind your line.

## The sea

- **Sea control.** Ships claim every sea hex they sail through. Owned sea pays income, carries supply, and holds **offshore oil rigs** worth $2 each. **Aircraft** claim the sea hex they end their move over (an oil rig included), like they take land they land on; flying *over* the sea claims nothing.
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
- **Bridges** span a one-hex sea gap between two shores. Land units walk across on top and ships sail underneath, though a ship can't stop under a bridge (and enemy troops standing on one block the way). Two bridges can't sit next to each other. **A bridge takes a turn to build**: it opens to traffic on your next turn (until then it shows half-built, marked NEXT TURN). **Every air strike can hit an enemy bridge** with nobody on it: a Precision Strike, Cruise Missile or Bunker Buster always drops it, an Airstrike on a 3+, a Kamikaze Drone on a 4+ and a Gun Run on a 5+, and Carpet or Strategic Bombing brings down each empty enemy bridge under the bombs on a 4+. Sabotage destroys one too. A destroyed bridge leaves **wreckage**: building a new bridge there costs $8 more.

## Buildings and upgrades

Build from the build bar (`Z` to `/`; the Airbase is `/`). To **upgrade** a structure, build the same one again on the same hex. Each structure goes up to ★★★, and each level costs more: ×1.5, then ×2.25. Every building you buy also makes the next one of that type $2 dearer (HQ fortification excepted), so spreading out across building types is cheaper than spamming one.

| Structure | Per level |
|---|---|
| **Fortify (HQ)** | +3 garrison chips and +1 mult |
| **FOB** | +1 defence mult |
| **Warehouse** | +$2 (+$3 when next to a resource node, Refinery or Port) |
| **Refinery** | +$1 (+$3 on a resource node or oil rig) |
| **Depot** | +1 to its range for the move bonus |
| **Bunker** | +3 garrison chips (even when empty, so it must be attacked) and +1 defence mult (★ gives +2). From ★★, your neighbouring hexes get +1 mult (Bunker Line). **Hold the Line:** when defended against a stronger attack, +40% of the attacker's chip lead (max 4 per level). **★★★ Citadel:** 14 garrison chips, +5 mult, +2 mult to neighbours, and Hold the Line takes 60% of the lead (max 20). **Destroyed** when an enemy captures its hex |
| **Sea Mine** | The naval Bunker, built on your own sea: +3 garrison chips per level (so enemy ships must fight through instead of sailing past) and +2 defence mult (+1 per extra level). Cleared when an enemy captures the hex |
| **Airbase** | Hands you one air-strike card at the start of each of your turns: a common at ★ (Gun Run or Kamikaze Drone), a rare at ★★ (Precision Strike or Strategic Bombing), an epic at ★★★ (Cruise Missile, Carpet Bombing or Bunker Buster). It costs **$25, $40 and $60** for its three levels, plus $8 for every airbase you've bought or upgraded before, and you can own **up to 3**. Like a FOB it **takes a turn to get ready**, after building and after each upgrade (no card that turn). A captured airbase is yours after a turn. Not within 3 hexes of your HQ. |

Ports and bridges don't upgrade. **Sabotage** knocks a level off a structure, and destroys it only at ★.

**Stacking.** A hex can hold up to **3 different buildings**, for example a Warehouse★★, a Bunker and a Depot. Bridges take a hex to themselves, and so does your **HQ**: nothing else can be built on the HQ hex (fortify it instead; the Fortify card fortifies the HQ when played there).

**New and captured bases.** A FOB you build, and a FOB or Port you capture, comes online at the start of your next turn. You can't build or capture one and deploy on it the same turn.

## Eliminations

When a commander falls, the conqueror takes their **heartland** (hexes within 2 of the fallen HQ) and the **spoils of war**: $10 + $2 per round played, the fallen commander's whole treasury, one turn of their income, and up to 2 of their tactic cards. The later the war, the richer the prize. The rest of the fallen empire **collapses into neutral land** for anyone to claim, and the buildings out there are wrecked (bridges remain, unowned).

## HQ sieges

Taking an enemy HQ doesn't knock them out straight away: it puts their HQ **under siege**. The defender gets one full turn cycle to strike back. If your troops are still standing on that HQ when your next turn starts, they're eliminated. If they retake it or drive you off, the siege collapses. A besieged HQ can't deploy units or supply territory, and its garrison bonus is gone. Instead you get an **emergency muster**: every hex you own next to your besieged HQ becomes a deploy point, and troops deployed there can attack immediately, so you can rush in defenders and take your HQ back the same turn.

When a siege knocks a commander out, **their old HQ becomes your FOB**: a deploy point right where you broke through.

## Menus and joining

- **Ready up.** In the lobby every guest presses **READY UP**; the host's **DEPLOY** stays locked until everyone is ready. Changing a setting un-readies everyone, so nobody gets surprised.
- **Dropping out.** If a player disconnects mid-game, a bot covers their empire after 30 seconds (marked 📡 AWAY), and hands it back the moment they reconnect.
- **Kicking.** The host can kick a player mid-game with the ✕ on their name (click twice). A bot takes over their empire and they can't rejoin that seat.
- **Esc** opens the pause menu: resume, rules, card index, sound, and **Leave game**. When you leave, a bot takes over your empire so everyone else can keep playing. The host can also **End game for everyone**.
- **Factions.** Everyone starts with **Iron Covenant**. The other four (Volt Syndicate, Ashen Nomads, Verdant Host, Null Order) are unlocked for good in **Store → Factions** for 1,500 Valor each; a room's lobby lists only the factions you own. Bots can be any faction.
- **The Store.** **Today's shop** sells a handful of looks at their price, new every day. Anything else (every territory, aura, border line, banner and unit card version) can be bought any day from the **Locker**, for a higher price than in the shop. Every country flag costs the same. Whatever you buy (or unlock) bursts onto the screen, ready to equip.
- **The front menu.** **PLAY** puts you in an open public war, or opens one that you host: you pick the settings and press DEPLOY, and anyone else pressing PLAY joins you until then (bots fill the empty seats). **＋ PRIVATE ROOM** opens a room you host, with a code to share; type a friend's code to join theirs. Your **commander card** shows your banner, territory skin and record, and **CUSTOMIZE** opens the Locker.
- **Singleplayer and saved wars.** **🎮 SINGLEPLAYER** opens a room of your own with three bots ready (change them, or the settings, before you deploy). Every war you start in a room of your own saves itself as you play, to your commander: sign in with Google or Discord and your saves follow you to any device. You keep your **5** most recent; a sixth replaces the oldest. Resume or delete them from your room's lobby. **🔗 INVITE A FRIEND** (in the lobby, or the Esc menu mid-war) copies a link: a friend who opens it can take over one of the bots.
- **Chat and names** are kept clean: links are removed, swearing is masked, fancy-font letters show as plain ones, and offensive or official-looking names (like "Admin") aren't allowed.
- **Parties.** Start a party and send friends the invite link. Click anyone in the party to see their profile. When the leader presses PLAY (or opens a private room), the whole party goes in together.
- **Leaderboard and news.** The most wins this week and all time, and the latest patch notes. Click a name on the leaderboard to see that commander's profile. The ⚙ button holds the settings: volume, music, graphics quality, reduced motion and bot chatter.
- **On a LAN server**, the front menu also has **JOIN THE LAN LOBBY** (the classic one-lobby game) and **FIND LAN GAMES**, which scans your Wi-Fi for SECTOR servers. Games in progress show their round and how many bots are playing; press **WATCH** to spectate.
- **Take over a bot.** While you're spectating a game in progress, every bot has a **TAKE OVER** button under its name. Press it to take command of that bot's empire: its land, army, cards and cash become yours.
- **Skipping.** Click a battle or press **Space** to skip it. If anyone fighting in a battle skips it, it skips for everyone watching, and anyone can skip a fight between bots.
- **The log** only shows the headlines: falls, sieges, pacts, betrayals, nukes, wins, and fights that involve you.

## Encirclement

If your territory completely surrounds a land pocket of 10 hexes or fewer, the pocket is **annexed** automatically. This works on neutral land, and on enemy hexes with no troops and no HQ, FOB or Port. Mountains count as walls, but the pocket must touch your land somewhere: a hex ringed only by mountains belongs to nobody.

The same goes for water: a pocket of 12 or fewer sea hexes walled in by your coast and your own sea, with no enemy ships inside, becomes yours.

## Missions and the tutorial

**🎯 MISSIONS & TUTORIAL** (front page or lobby) opens 25 hand-built missions, each teaching one technique. Most are fixed boards with set armies, cash and cards, a goal and a turn limit: no resupply draws and no weather, so every one has a solution to find. General Hale briefs you on each, and the mission bar has a **HINT** button if you're stuck. Clear a mission to unlock the next. Your first clear of each pays **100 Valor**, and clearing them all pays a **1,000 Valor** bonus. The last one, **Endgame** (Nightmare), needs every arm in the right order: take the bridge before the Ark sails under it, knock out the air defence before the Bunker Buster goes in, then storm the ★★★ fortress from two sides with your cards.

After Endgame come five **Situations** on bigger boards: a **live enemy** that plays like a bot, with real income and resupply on both sides, so there's no single solution, only a plan. **Breakout** (relieve a cut-off division), **Island Chain** (seize a bridgehead and push through), **Relief Force** (hold a besieged town), **Two Fronts** (two enemies at once) and **Total War** (knock out a rival on a whole continent).

| # | Mission | Tier | Technique |
|---|---|---|---|
| 1 | Basic Training | Tutorial | Moving, capturing, deploying and attacking |
| 2 | War Chest | Tutorial | Income, resupply and economic buildings |
| 3 | Strength in Numbers | Easy | Pincer attacks: hit one hex from several sides at once |
| 4 | Holding Ground | Easy | Defence: holding ground and your HQ (high ground, digging in, Bunkers, fortifying the HQ) |
| 5 | Crossing | Easy | Rivers, bridges and combined arms |
| 6 | Forward Base | Easy | FOBs: deploying at the front, not just at home |
| 7 | Breakthrough | Medium | Leapfrogging: each wave passes through the last to punch deeper |
| 8 | Spoils of War | Medium | Ruins, caches, villages, relics and abandoned FOBs |
| 9 | Over the Mountains | Medium | Helicopters carry Grunts |
| 10 | Big Guns | Hard | Artillery: firing from range |
| 11 | All In | Hard | Battle cards: tipping a fight before the dice roll |
| 12 | Air Power | Hard | Air strikes, Gun Runs, Heli Drops and air defence |
| 13 | Air Wing | Medium | Airbases, strike cards and the black market |
| 14 | Sky Shield | Hard | Anti-air: shooting down aircraft from range |
| 15 | Sea Lanes | Hard | Ports, warships and sea control |
| 16 | Beachhead | Very Hard | Transports, landings and naval gunfire |
| 17 | The Cauldron | Hard | Encirclement: cutting off a pocket to take it whole |
| 18 | Hold the Line | Expert | Defence: bunkers, terrain and reserves |
| 19 | Lightning War | Impossible | Everything at once |
| 20 | Endgame | Nightmare | Every arm in the right order: armour, sea, guns, air and cards |

## Battle cards

Battle cards are thrown into a fight **before the dice roll**, by either side. When an attack is ordered and the attacker or defender holds a battle card they can afford, a battle window opens for a few seconds with the live odds:
- Both sides can throw in **up to 3 cards each**, one at a time. Every card the other side plays gives you a few more seconds to answer (up to 20 seconds in all).
- Press **FIGHT** / **HOLD** (or Space) when you're done; the dice roll once both sides are ready or time runs out.
- Bots throw cards in when it swings a fight worth winning, and answer yours.
- On your own turn you can also **ready** an attack card: it joins your next attack.
- If the order never goes through (the fog stopped it short, say), the cards are handed back.

| Card | Rarity | Cost | Side | Effect |
|---|---|---|---|---|
| Rally | Common | $1 | Attack | +2 Mult |
| Fix Bayonets | Common | $1 | Attack | +1 Chip for each attacking unit |
| Hold Fast | Common | $1 | Defence | +2 Mult |
| Ambush | Common | $1 | Defence | +2 Chips for each defending unit |
| Covering Barrage | Rare | $2 | Either | +3 Mult |
| Reserves | Rare | $2 | Either | +2 Chips for each unit on your side |
| Steady Nerves | Rare | $2 | Either | Your die never rolls below 3 |

They turn up in resupply and in supply caches like any other tactic. Smoke Screen, Fortify and Industrial Revolution are played on your own turn.

## Trading

Any time, click **TRADE** under a rival's name. You can offer cash and tactic cards in exchange for cash. They accept or decline. Bots weigh offers by value, are greedier on higher difficulties, and won't feed a runaway leader.

## Between turns

You're never just watching:
- **Battle cards.** When an enemy attacks you, see **Battle cards** below: you get a few seconds to throw cards into the fight before the dice roll.
- **Next resupply.** Your next resupply is dealt when your turn ends. Pick a card or full income from the panel while you wait, and your next turn starts straight in the action.
- **Diplomacy and trades** work any time, not just on your turn.
- **Intel ops** (fog of war): a quarter of your income (at least $2) to scout a 2-hex area anywhere until the end of next round, twice per round (`I`).
- **Pings and emotes** from the bar above the chat.
- **Overwatch.** On your turn, select a stack and press `O`: it gives up its move to watch. When an enemy ends a move next to it (or within range, for artillery), you get a few seconds to **FIRE** (+1 mult, one shot) or **HOLD**.
- **Radar and alerts.** In fog of war, hidden enemies moving within 2 hexes of your land show up as radar blips. Attacks on you and contacts are listed in the side panel with a LOOK button.
- **War room.** In the Alt view, draw arrows and circles on the map that only you and your allies can see.
- **Troop donations.** On your turn, select a stack and press **GIVE** on an ally's name card to hand it over.

## Blueprint

While others play, queue moves, deploys and builds. The preview shows exactly what your turn will look like, including income, Depot move bonuses and newly online bases. When your turn starts, income is collected automatically and the queue runs. Untick *auto-collect income* if you'd rather choose from the resupply first; the queue then runs right after your pick. You can queue a move from the spot an earlier queued move left your units. Attacks and tactics are live-only, and any order the board no longer allows is skipped with a note.

## Turn timer and undo

- With a **turn timer** set, a bar under the top bar drains in the current player's colour, turning red for the last 10 seconds. The clock **pauses while your fights and supply drops play out**, and your resupply pick gets 20 seconds of its own. If time runs out, income is collected and your turn ends.
- **Undo** (↶ button or `Ctrl+Z`) takes back moves, deploys and builds that didn't reveal anything: no fights, loot or cards, and in fog of war no newly spotted enemy troops, land or buildings (uncovering empty terrain is fine). Hexes the move captured are given back. You can undo several steps back to the last such reveal. If nothing can be undone, it tells you why. In the blueprint, `Ctrl+Z` takes back the last queued order.
- **Auto-end turn:** when you have nothing left to do (no stack can act, nothing affordable to deploy or build, no tactic to play), your turn ends after a 3-second countdown. Press STAY to keep it, or switch it off in the Esc menu.
- **Whose turn:** a pill under the top bar always shows whose turn it is (and when you're next). On your turn the screen edge glows in your colour.
- **Game speed:** Normal, Fast or Superspeed (lobby setting, or the **⏸ > >> >>>** strip in the top bar for the host). Faster speeds make bot turns and other players' animations quicker. **⏸ pauses** the game: bots stop and the turn clock freezes until someone resumes. When only bots are left, anyone can use the strip, up to 🚀 Max.
- **AFK:** a connected player who sits idle through 2 turns gets a bot covering for them until they press any key or click. Without a turn timer, a turn with no sign of life ends after 2 minutes.
- **Time bank** (lobby option): instead of a per-turn timer, each commander gets a chess clock: 3 or 6 minutes in the bank, plus 20 seconds every turn.
- **Auto-resolve:** a fight at 95%+ odds that goes the expected way skips the dice and the long animation.
- **Batch moves:** Shift+drag a box around several stacks, then click a hex to send them all there (each as far as it can), or a red target to attack together.
- **Dig in:** select a stack and press `G`. It gives up its move for +1 defence Mult until it moves again.
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
| `Alt` (toggle) | War-room view: the board fades out, every stack shows its total attack and defence, and you can draw arrows (drag) and circles (click) that only your allies see; right-click erases |
| Pack (Supply Drop) | Drag across the top seam, click, or `Space` to tear it open |
| `F` | Jump to your HQ |
| `Tab` / `Shift+Tab` / `E` | Select the next stack that can still act |
| `Ctrl`-click, or `M` then click | Give the selected stack a march order |
| `Delete` | Cancel the selected stack's march order |
| `G` | Dig the selected stack in (+1 defence until it moves) |
| `O` | Put the selected stack on overwatch |
| `Shift`-drag | Box-select several stacks for a batch move |
| `I` | Intel op: scout an area through the fog ($2) |
| `Ctrl+Z` | Undo the last move, deploy or build |
| `Enter` | **End your turn** (opens chat when it isn't your turn) |
| `T` | Chat |
| Hover a card | Enlarge it |
