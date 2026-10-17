# How to play SECTOR

Grab land, build an economy, crush your rivals. **Every hex you hold pays you**, so standing still is losing.

## Setup and the opening draft

- 2–6 commanders: humans over the network, bots (Easy, Medium, Hard, Impossible), and **pass-and-play** players sharing one device. A cover screen hides each player's hand between turns.
- Every map is procedurally generated from one of six layouts: continent, supercontinent, twin continents, archipelago, inland sea, or crescent isles. The coastline is noise-warped, so no two boards share an outline.
- Everyone starts with an HQ and its surrounding hexes, 2 Grunts, $6, a **Rare Supply Drop** card, and three unit cards: **Grunts**, the **Ark** transport, and their faction's starter unit.
- **Opening draft.** Before round 1, every commander picks simultaneously. In each of 3 draft rounds you're offered 3 cards and keep 1.

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
+ refineries and markets
```

**Supply:** a hex pays only if it connects through your own territory to your HQ, a FOB, or a Port. Owned sea counts as territory, so sea lanes carry supply to your islands. Cut-off hexes are hatched on the map and pay nothing.

## Moving

- Units **seize every unclaimed hex they pass through**.
- Highlands cost 2 move.
- Mountains block movement except for air units. Open water blocks land units unless they're aboard an Ark; air units and hover tanks fly or glide across it.
- A hex holds at most 5 units, and mixed types share a stack freely.
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

## Artillery and gunships

Units with a range stat fire instead of moving.

- If the shot wins, it destroys 1 unit (2 if you double the defender's score).
- If it misses, nothing happens.
- Shots can't pass through mountains (the Oracle ignores this).

## The sea

- **Sea control.** Ships claim every sea hex they sail through. Owned sea pays income, carries supply, and holds **offshore oil rigs** worth $2 each.
- **Ports** are built on coastal hexes. They launch ships into the adjacent sea and act as a supply source.
- **Coastal fighting:**
  - Ships can assault enemy units on adjacent coastal hexes. They kill the defenders on a win but can't occupy land.
  - Land units can attack enemy ships next to their shore.
- **Transports.** Land units move onto an Ark to board it (3 per Ark). The Ark carries them as it sails, and they step off onto any coast later. If the Ark sinks, its cargo drowns.
- **Bridges** span a one-hex sea gap between two shores. Land units walk across, but ships can't pass, so a bridge blocks the channel. Sabotage destroys a bridge, and anyone standing on it drowns.

## Buildings and upgrades

Build from the build bar (`Z` and onward, nine slots). To **upgrade** a structure, build the same one again on the same hex. Each structure goes up to ★★★, and each level costs more: ×1.5, then ×2.25.

| Structure | Per level |
|---|---|
| **Fortify (HQ)** | +3 garrison chips and +1 mult |
| **FOB** | +1 defence mult |
| **Market** | +$3, and each level counts toward the trade network |
| **Refinery** | +$2 (+$4 on a resource node or oil rig) |
| **Depot** | +1 to its range for the move bonus |
| **Bunker** | +1 defence mult (★ gives +2) |
| **Flak** | +1 hex of anti-air coverage |

Ports and bridges don't upgrade. **Sabotage** knocks a level off a structure, and destroys it only at ★.

## Menus and joining

- **Esc** opens the pause menu: resume, rules, card index, sound, and **Leave game**. When you leave, a bot takes over your empire so everyone else can keep playing. The host can also **End game for everyone**.
- On the main menu, **Join a game** scans your Wi-Fi for SECTOR servers. You can also type an address, or pick a recent server.

## Encirclement

If your territory completely surrounds a land pocket of 10 hexes or fewer, the pocket is **annexed** automatically. This works on neutral land, and on enemy hexes with no troops and no HQ, FOB or Port.

## Trading

On your turn, click **TRADE** under a rival's name. You can offer cash and tactic cards in exchange for cash. They accept or decline. Bots weigh offers by value, are greedier on higher difficulties, and won't feed a runaway leader.

## Blueprint

While others play, queue moves, deploys and builds. When your turn starts, income is collected automatically and the queue runs. Untick *auto-collect income* if you'd rather choose from the resupply first. Attacks and tactics are live-only.

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
| `Enter` | Chat |
| Hover a card | Enlarge it |
