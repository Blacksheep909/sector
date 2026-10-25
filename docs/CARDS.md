# Card reference

_Generated from `shared/engine.js` by `node tools/gen-cards.js`._

Cards come from supply crates (Standard, Gilded, Mythic) and the opening draft; see the crate odds in docs/RULES.md. Legendaries are unique: only one copy exists until it is spent or its owner is eliminated.

## Units

Unit cards are permanent unlocks: deploy as many as you can afford.

| Unit | Class | Rarity | Cost | ATK | DEF | Move | Range | Notes |
|---|---|---|---|---|---|---|---|---|
| **Grunts** | Infantry | Common | $2 | 2 | 1 | 2 | – | Cheap, dependable rifle squad. |
| **Skitter** | Vehicle | Common | $3 | 2 | 1 | 4 | – | Raider buggy. Grabs land fast. |
| **Thumper** | Artillery | Common | $4 | 5 | 1 | 1 | 2 | Mortar crew. Fires 2 hexes instead of moving. |
| **Barracuda** | Naval | Common | $4 | 3 | 2 | 4 | – | Fast gunboat. Claims sea lanes, raids coasts. |
| **Stinger** | Infantry | Common | $3 | 1 | 1 | 2 | 1 | MANPADS team. Fires at aircraft 1 hex away (+3 Chips vs aircraft), and a 25% chance to shoot down air strikes on its hex. Weak against ground troops. |
| **Corpsman** | Infantry | Common | $3 | 1 | 3 | 2 | – | Medic squad. Its stack never suffers pyrrhic losses. |
| **Hornet** | Air | Common | $4 | 2 | 1 | 4 | – | Scout drone. Flies over mountains and water and sees 3 hexes around it. |
| **Jackal** | Vehicle | Uncommon | $3 | 3 | 2 | 4 | – | Light patrol truck with a heavy machine gun. Cheap, quick, hits above its weight. |
| **Coyote** | Vehicle | Uncommon | $4 | 2 | 2 | 4 | – | Scout truck with a sensor mast. Sees 2 hexes further in the fog of war. |
| **Lancer** | Infantry | Uncommon | $5 | 3 | 2 | 2 | – | Tank Hunter: +3 Chips when fighting vehicles. |
| **Warden** | Air | Uncommon | $4 | 1 | 3 | 3 | – | Airborne radar plane. Aegis: +1 Mult when its hex defends. |
| **Sapper** | Infantry | Uncommon | $4 | 2 | 2 | 2 | – | Demolitions: +3 Chips attacking a hex with buildings. |
| **Scorpion** | Vehicle | Uncommon | $5 | 2 | 1 | 3 | 2 | Self-propelled anti-air gun. Fires at aircraft 2 hexes away (+4 Chips vs aircraft); 35% to shoot down air strikes within 1. Weak against ground troops. |
| **Bulwark** | Vehicle | Uncommon | $6 | 3 | 5 | 3 | – | Armoured personnel carrier. Holds the line, and carries up to 4 Grunts with it at its own speed. |
| **Mauler** | Vehicle | Uncommon | $6 | 5 | 4 | 2 | – | Main battle tank. |
| **Ark** | Naval | Uncommon | $4 | 0 | 3 | 4 | – | Transport. Carries up to 3 land units across the sea. |
| **Marlin** | Naval | Rare | $7 | 5 | 4 | 4 | 2 | Destroyer. Shells coasts and ships 2 hexes away. |
| **Basilisk** | Artillery | Rare | $7 | 7 | 2 | 1 | 3 | Rocket artillery truck. Fires 3 hexes. |
| **Ranger** | Infantry | Rare | $6 | 4 | 3 | 3 | – | Pathfinders: rough terrain costs only 1 move. |
| **Skyguard** | Vehicle | Rare | $7 | 3 | 1 | 3 | 2 | Air defence truck. Fires at aircraft 2 hexes away (+6 Chips vs aircraft); 50% to shoot down air strikes within 2. Weak against ground troops. |
| **Hellcat** | Vehicle | Rare | $7 | 6 | 2 | 3 | – | Strike tank. Can act on the turn it is deployed. |
| **Outrider** | Vehicle | Rare | $7 | 5 | 3 | 5 | – | Eight-wheeled fighting vehicle. 5 move: the fastest thing on the ground. Carries up to 4 Grunts. |
| **Kraken** | Naval | Rare | $8 | 7 | 2 | 4 | – | Submarine. Torpedoes: +4 Chips vs ships. |
| **Wren** | Air | Rare | $5 | 2 | 0 | 5 | – | Light assault helicopter. Fast, with 2 Grunts riding on its benches. Strafing Run: +2 Mult attacking ground targets. |
| **Ravager** | Air | Rare | $7 | 4 | 1 | 4 | – | Armoured attack helicopter with a chin cannon. Strafing Run: +2 Mult attacking ground targets. |
| **Mule** | Air | Rare | $6 | 1 | 1 | 4 | – | Tandem-rotor heavy-lift helicopter. Barely armed, but carries up to 8 Grunts over mountains and water (it sets them down on land). |
| **Leviathan** | Vehicle | Legendary | $14 | 12 | 10 | 1 | – | Land dreadnought. Never suffers pyrrhic losses. |
| **Titan** | Vehicle | Legendary | $16 | 13 | 12 | 1 | – | Landship with naval guns. Siege Breaker and never suffers pyrrhic losses. |
| **Seraph** | Air | Legendary | $12 | 9 | 4 | 5 | – | Heavy gunship. Strafing Run: +2 Mult attacking ground targets. |
| **Banshee** | Air | Legendary | $14 | 8 | 2 | 4 | – | Attack helicopter with anti-tank missiles. Hellfire: +3 Chips against vehicles, and Strafing Run: +2 Mult attacking ground targets. |
| **Carrier** | Naval | Legendary | $13 | 2 | 2 | 1 | – | Floating airbase: deploy aircraft onto it and fly them off it. Holds 4. |
| **Oracle** | Artillery | Legendary | $11 | 8 | 3 | 2 | 4 | Orbital uplink. Range 4, ignores mountains. |
| **Trident** | Naval | Legendary | $16 | 10 | 6 | 3 | 8 | Missile submarine. Fires at any troops or buildings within 8, over mountains; a hit kills one extra unit. Only Sentinel and Grumble batteries can intercept it. |
| **Abyssal** | Naval | Legendary | $15 | 12 | 10 | 3 | 4 | Sea dreadnought. Range 4. Never suffers pyrrhic losses. |

## Tactics

Single-use cards from your hand.

| Tactic | Rarity | Cost | Effect |
|---|---|---|---|
| **Ambush** | Common | $1 | Battle card (defence): your defenders get +2 Chips each in this fight. |
| **Hold Fast** | Common | $1 | Battle card (defence): +2 Mult to your side in this fight. |
| **Fix Bayonets** | Common | $1 | Battle card (attack): your attackers get +1 Chip each. Ready it on your turn, or throw it in before the dice. |
| **Smoke Screen** | Common | $1 | A hex you own gets +2 Mult on defence until your next turn. |
| **Forced March** | Common | $1 | Units on one hex may act again, with +2 move. |
| **Rally** | Common | $1 | Battle card (attack): +2 Mult. Ready it on your turn for your next attack, or throw it in before the dice. |
| **Fortify** | Common | $2 | Build or upgrade a Bunker on one of your hexes for free (on your HQ hex it fortifies the HQ instead). |
| **Conscription** | Common | $1 | Deploy 5 free Grunts at a deploy point (as many as fit). |
| **Kamikaze Drone** | Common | $2 | A loitering munition dives on a target within 5 of your land. Troops: roll 4+ kills 1. Undefended buildings: knocks a level off one. |
| **Gun Run** | Common | $2 | Attack jet, within 3 of your land. Troops: roll 3+ kills 1. Undefended buildings: knocks a level off one. |
| **Airstrike** | Uncommon | $4 | Bomb a hex within 4 of your land. Troops: roll to kill 1–3. Undefended buildings: knocks 1–2 levels off them. |
| **Heli Drop** | Uncommon | $3 | Fly a stack up to 5 hexes onto any empty land and seize it. |
| **Sabotage** | Uncommon | $3 | Destroy an enemy structure (or bridge) within 3 of your land. |
| **Embargo** | Uncommon | $3 | Click any enemy territory: that commander earns half income for their next 2 turns and cannot trade. |
| **Bounty** | Uncommon | $1 | This turn, every enemy unit you destroy pays a fifth of your income (min $2). |
| **Covering Barrage** | Rare | $2 | Battle card (attack or defence): +3 Mult to your side. |
| **Reserves** | Rare | $2 | Battle card (attack or defence): every unit on your side gets +2 Chips. |
| **Steady Nerves** | Rare | $2 | Battle card (attack or defence): your die never rolls below 3. |
| **Precision Strike** | Rare | $5 | Guided bomb within 5 of your land, hard for anti-air to catch. Kills the strongest unit (2 on a 5+), or destroys a building. |
| **Strategic Bombing** | Rare | $5 | Bombers hit an enemy hex within 6 and its neighbours: their economic buildings lose a level, and that land pays nothing for 2 turns. |
| **Quarry Blast** | Rare | $3 | Blast a mountain within 3 of your land, and the mountain behind it, down into Highlands: a 2-hex pass. |
| **War Bonds** | Rare | $0 | Gain $1 for every 2 hexes you own. |
| **Blitz Doctrine** | Rare | $3 | This turn: all units +1 move, fresh units may act. |
| **Supply Drop** | Rare | $0 | Spin the reel for a crate (60% Standard · 32% Gilded · 8% Mythic), then keep 1 of 3 cards. |
| **Tactical Nuke** | Legendary | $10 | Erase everything in a 1-hex radius. Leaves a fallout zone for 4 rounds. |
| **Supply Drop** | Legendary | $0 | Spin the reel for a crate (35% Gilded · 65% Mythic), then keep 1 of 3 cards. |
| **Mutiny** | Legendary | $6 | An enemy stack (≤3) bordering your land defects to you. |

## Structures

Built from the hotbar (keys Z–M) on hexes you own that are connected to supply.

| Structure | Cost | Effect |
|---|---|---|
| **FOB** | $8 | Forward base: deploy point and supply source. +1 Mult defence per level. |
| **Warehouse** | $6 | +$2 per turn per level. Next to a Resource node, Refinery or Port it stockpiles more: +$3 per level. |
| **Refinery** | $6 | +$1 per turn per level (+$3 per level on a Resource node or oil rig). |
| **Depot** | $4 | Logistics hub: your units starting their turn nearby get +1 move. Range = level. |
| **Port** | $5 | Coast only. Launch ships into the adjacent sea. Supply source for sea lanes. |
| **Bridge** | $6 | Span a 1-hex sea gap between two shores. Land units cross; ships cannot pass. Not next to another bridge. A destroyed bridge leaves wreckage: rebuilding there costs $8 more. |
| **Bunker** | $4 | Strongpoint with its own garrison: +3 Chips per level even when empty, so enemies must attack it. +2 Mult defence (+1 per extra level). ★★+ also gives your neighbouring hexes +1 Mult. Digs in against big attacks: +40% of the attacker chip lead (up to 4 per level). ★★★ Citadel: 14 garrison Chips, +5 Mult, +2 Mult to neighbours, and holds 60% of the lead (up to 20). Destroyed if an enemy captures it. |
| **Sea Mine** | $4 | A minefield on one of your sea hexes: the naval Bunker. +3 Chips per level even when empty, so enemy ships must fight their way through instead of sailing past. +2 Mult defence (+1 per extra level). Cleared if an enemy captures the hex. |
| **Airbase** | $25 | Every turn it hands you an air-strike card: commons (Gun Run, Kamikaze Drone) at ★, rares (Precision Strike, Strategic Bombing) at ★★, epics (Cruise Missile, Carpet Bombing, Bunker Buster) at ★★★. Up to 5 per commander. Takes a turn to build and a turn to upgrade. $25, $40, $60, plus $8 for each one you bought or upgraded before. |
| **Flak (retired)** | $5 | No longer built and has no effect: anti-air units took over air defence. Only found in old saves. |

## Factions

| Faction | Perk | Starts with |
|---|---|---|
| **Iron Covenant** | Steel Wall: +1 defence Chip per unit when defending. | Bulwark |
| **Volt Syndicate** | Overclock: Air units get +1 move, +1 attack and +1 defence, and cost $1 less. | Hornet |
| **Ashen Nomads** | Looters: Earn $2 for every enemy hex you capture. Skitters cost $1 less. | Skitter |
| **Verdant Host** | Deep Roots: Structures cost $3 less, and each building you own pays +$1 a turn. Start with a ★★ Bunker by your HQ. | Thumper |
| **Null Order** | Loaded Dice: Your combat rolls of 1 and 2 count as 3. | Lancer |

Every commander also starts with **Grunts** and the **Ark** transport.
