# Balance report (v0.10.0)

What was overpowered, how we know, and what changed. Every number here comes from `tools/balance-lab.js`, so it can be re-run after any change:

```
node tools/balance-lab.js duel [budget]   # exact equal-budget fights, every land/air unit vs every other, all 36 dice rolls
node tools/balance-lab.js games [n]       # n four-bot games: enemy $ each unit type destroys per $ spent on it
node tools/balance-lab.js ab [n] [units]  # one bot deploys a unit whenever it can; its win rate vs a normal bot
node tools/balance-lab.js skill [n]       # one hard bot vs three medium bots on equal income: does better play win?
```

Bot games measure how units do in *bot* hands. Bots don't exploit deep helicopter strikes or troop-carrier tricks the way a human does, so those findings lean on the exact duel maths and on how the rules can be abused, not on bot win rates alone.

## What was broken

### 1. Carriers broke the stack limit (the "helicopters are amazing on defence" problem)
Grunts riding in a carrier didn't count toward the 5-unit stack limit, and there was no ceiling at all. One hex could hold:

| Stack | Units on one hex | ATK chips | DEF chips |
|---|---|---|---|
| 10 Grunts (the intended max) | 10 | 20 | 10 |
| 5 Maulers | 5 | 25 | 20 |
| 5 Stormcrows + 30 Grunts | 35 | 80 | 50 |
| 5 Valkyries + 40 Grunts | 45 | 110 | 60 |

A flying 35-unit stack that ignores rivers and mountains and moves 4 hexes a turn can't be dislodged by anything on the board. That's what made helicopters feel invincible on defence.
**Fix:** no hex ever holds more than 10 units, carriers or not.

### 2. Helicopters defended like tanks
A real helicopter caught on the ground (or hovering over one) is a soft target. In the game they had tank-like DEF and nothing on the ground could punish them unless it was dedicated anti-air.
**Fix:** helicopters lose ATK and DEF (ATK/DEF: Wren 3/2 → 2/0, Ravager 5/3 → 4/1, Stormcrow 4/4 → 3/2, Banshee 10/5 → 8/2; the Valkyrie tiltrotor DEF 4 → 3), and **Ground Fire**: every infantry unit adds +1 chip in any fight against a helicopter.

Equal-budget duels ($30 a side, open plains), chance to hold when attacked:

| | Before | After |
|---|---|---|
| Banshee | 31% | 2% |
| Ravager | 35% | 2% |
| Valkyrie | 35% | 18% |
| Stormcrow (+ Grunts) | 45% | 16% |
| Wren (+ Grunts) | 45% | 5% |

Attack win rates came down a little (Banshee 83% → 77%, Ravager 79% → 71%, Stormcrow 74% → 63%, Wren 93% → 87%): helicopters still hit hard, they just can't park on a hex and soak up attacks any more. A lone Wren now has 0 DEF, so it's lost to any attack unless it levels up or has company.

### 3. The Banshee (Apache)
ATK 10, flies over everything (mountains, rivers, enemy land without seizing it), Strafing Run +2 mult against anything on the ground, and Hellfire +4 chips per Banshee against any stack with a vehicle in it. One Banshee beats most lone stacks of armour on any roll, from 4 hexes away, and nothing but anti-air can hit back.
**Fix:** ATK 10→8, DEF 5→2, Hellfire +4→+3, cost $13→$14. Together with Ground Fire, a Banshee that kills a stack now has to worry about the counter-attack.

### 4. Grunts were the best unit in the game per dollar
| | Before | After |
|---|---|---|
| Enemy $ destroyed per $ spent (80 bot games) | **1.24** (every other land unit 0.3–0.9) | 0.87 |
| Grunts deployed in 80 games | 20,839 | 5,868 |
| A/B: bot that spams Grunts, win rate (20 games, control ≈ 20–30%) | **45%** | 15% |
| Duel, $ cost of the 10-Grunt stack | $10 (matched $30 stacks) | $20 |

**Fix:** Grunts cost $2. Because Grunts are now worth having, **Conscription deploys 5 Grunts** (was 2 for $1, barely worth the card slot).

### 5. Lancer
The most cost-efficient unit after the Grunt fix (equal-budget duels 82% attack / 53% hold for $20, and a 32% deck win rate in bot games against 25% average). **Fix:** $4 → $5.

### 6. Too much dice luck for skill to show
Score was `chips × (d6 + mult)`. A d6 alone swings from ×1 to ×6, so a much stronger army still lost often:

| Chip advantage | Win chance before (d6) | After (d6 + 2) |
|---|---|---|
| Even | 42% | 42% |
| 1.25× | 61% | 67% |
| 1.5× | 67% | 78% |
| 2× | 75% | 89% |
| 3× | 86% | 100% (no roll) |

**Fix:** every roll is d6 + 2 for both sides. Close fights stay close, terrain and support bonuses are worth exactly what they were, but out-planning your opponent (bigger stacks, flanks, combined arms, picking the right fight) now wins reliably. This is the main lever for the skill curve: good players should crush.

### 7. Rewards that didn't scale
Late in a war income is $50–100+ a turn, but ruins paid $4–10, scrapping a crate paid $2 and a maxed card paid $4. **Fix:** those payouts scale with a tenth of your income (never below the old amounts). Reroll cost, Bounty, intel and elimination spoils already scaled.

## What to watch next

From the 80 "after" games, enemy $ destroyed per $ spent:

- **Trident** (1.01, losing only $0.15 per $ spent) and **Oracle** (0.90, $0.32): long-range strikers that fire from safety and almost never die. They're legendaries so they're rare, but they're the new top of the table. A range or cost tweak would be the next step if they dominate human games.
- **Goliath** is underpowered: a 4% deck win rate (85 decks), costs $10, moves 1. It could use +1 move or a lower cost.
- **Skill check** (hard bot vs three medium bots on equal income): 30% before, 33% after (25% = no edge, ±6% noise at 60 games). The bots' "skill" is just thresholds and noise, so this can't measure the human skill curve; the d6 + 2 maths above is the better guide.
