# How to play SECTOR

Grab land, build an economy, crush your rivals. **Every hex you hold pays you**, so sitting still is losing.

## Setup

- 2–6 commanders, humans and/or bots (Easy, Medium, Hard, Impossible).
- Every map is procedurally generated. The layout is one of: continent, supercontinent, twin continents, archipelago, inland sea, or crescent isles, plus noise, so the outline changes every game.
- Everyone starts with an HQ, its surrounding hexes, 2 Grunts, $6, a Supply Cache card, and three unit unlocks: **Grunts**, the **Ark** transport, and their faction's starter unit.

## Win conditions

| Mode | Win by |
|---|---|
| **Domination** | Capturing every enemy HQ. |
| **Conquest** | Holding 60% of all land. |
| **Beacon** | Holding the glowing centre hex at the start of 3 of your turns in a row. |

An optional round limit gives the win to whoever holds the most hexes when time runs out. Being the last commander standing always wins.

## A turn

1. **Supply Drop.** Three random cards are dealt face-down and flipped. Either take one and get *half* your income, or skip them and collect the *full* income. You can pay to reroll ($2, then $3, …).
2. **Act** in any order. Each unit acts once per turn:
   - **Deploy** units with the hotbar (keys `1`–`0`). Land units deploy at your HQ or a FOB. Ships deploy into the sea next to a Port.
   - **Move or attack.** Click a stack, then a highlighted hex.
   - **Build** structures with the hotbar (keys `Z`–`M`).
   - **Play tactic cards** from your hand.
   - **Trade** with another commander. Click TRADE on their name.
3. **End turn** (`Space`).

Freshly deployed units can't act until your next turn.

## Income

```
$3 base
+ $1 per 3 hexes you hold that are connected to supply
+ $2 per resource node (glowing crystals)
+ refineries and markets
```

**Supply:** a hex only pays if it connects through your own territory to your HQ, a FOB, or a Port. Cut-off hexes are hatched on the map and pay nothing. Cutting an enemy's supply line is a real attack.

## Moving

- Units **seize every unclaimed hex they pass through**, so fast units are land-grabbers.
- Highlands cost 2 move. Mountains are impassable, except to air units. Water is impassable, except to air units, hover tanks, and ships.
- At most 5 units per hex. A stack moves at the speed of its slowest unit.
- Entering an empty enemy hex captures it. Entering an occupied one starts a fight.

## Encirclement (annexing)

If your territory completely surrounds a pocket of land, the pocket flips to you automatically. This works on neutral land, and on enemy hexes that hold no troops and no HQ, FOB or Port. Coasts count as open, and pockets larger than 10 hexes are safe.

## Combat: chips × mult

Every fight is a Balatro-style showdown:

```
Attacker score = total ATK chips × (d6 + attacker mult bonuses)
Defender score = total DEF chips × (d6 + defender mult bonuses)
```

You **throw your own die**: drag it in the dice tray and fling it. If you don't throw within 5 seconds, it's thrown for you. The defender wins ties.

- **The loser's stack is wiped out.**
- **Pyrrhic victory:** if the loser scored at least 60% of the winner's score, the winner also loses its weakest unit.

| Bonus | Effect |
|---|---|
| Flanking | +1 mult for each *other* friendly stack touching the target (max +2) |
| Combined Arms | +1 mult for 3+ different unit types in the attack |
| Forest / Highlands | +1 / +2 defender mult |
| Bunker / FOB / HQ | +2 / +1 / +2 defender mult; an HQ also has +3 garrison chips |
| Smoke Screen | +2 defender mult |
| Tank Hunter (Lancer) | +3 chips vs vehicles |
| Torpedoes (Kraken) | +4 chips vs ships |
| Siege Breaker (Goliath) | +2 mult vs fortified hexes |
| Aegis (Warden) | +1 defender mult |
| Flak | +2 defender mult vs air attackers |

The attack preview shows your win chance before you commit.

## Artillery and gunships

Units with a **range** stat (Thumper, Basilisk, Oracle, Marlin, Bastion, Abyssal) can fire instead of moving.

- If the shot wins, it destroys 1 unit, or 2 if you double the defender's score.
- If it loses, nothing happens.
- Shots can't pass through mountains (the Oracle ignores this).

## Navy

- **Ports** are built on coastal hexes you own. They launch ships into the adjacent sea, and they're also a supply source, so an island with a Port pays income.
- Ships sail on water only. They fight other ships hand-to-hand. Warships with range can also shell the coast.
- **Transports (Ark):** land units move onto an Ark's hex to board it (up to 3 per Ark). When the Ark sails, its cargo comes along. On a later turn, the troops move off onto any adjacent land. If the Ark sinks, everyone aboard drowns.
- Air units can attack ships but can't stay over water.

## Trading

On your turn, click **TRADE** on another commander's name and build an offer:

- **You give:** cash and/or tactic cards.
- **You get:** cash.

The other commander gets a popup to accept or decline. Hands stay secret. Bots weigh offers by value, are greedier on higher difficulties, and won't feed a runaway leader.

## Blueprint (planning ahead)

While other players take their turns, you can queue moves, deploys and builds. The queued orders fire the instant your turn starts. Income is auto-collected unless you untick that box. Attacks and tactics are live-only.

## Controls

| Input | Action |
|---|---|
| Click | Select / give an order |
| Right-click, `Esc` | Cancel |
| Drag, `WASD`, arrow keys | Pan |
| Mouse wheel | Zoom |
| `1`–`0` | Deploy hotbar |
| `Z`–`M` | Build hotbar |
| `F` | Jump to your HQ |
| `Space` | End turn |
| `Enter` | Chat |
