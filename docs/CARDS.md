# Card reference

_Generated from `shared/engine.js` by `node tools/gen-cards.js`._

Cards come from supply crates (Standard, Gilded, Mythic) and the opening draft; see the crate odds in docs/RULES.md. Legendaries are unique: only one copy exists until it is spent or its owner is eliminated.

## Units

Unit cards are permanent unlocks: deploy as many as you can afford.

| Unit | Class | Rarity | Cost | ATK | DEF | Move | Range | Notes |
|---|---|---|---|---|---|---|---|---|
| **Grunts** | Infantry | Common | $2 | 2 | 2 | 2 | – | Cheap, dependable rifle squad. |
| **Skitter** | Vehicle | Common | $3 | 2 | 1 | 4 | – | Raider buggy. Grabs land fast. |
| **Thumper** | Artillery | Common | $4 | 3 | 1 | 1 | 2 | Mortar crew. Fires 2 hexes instead of moving. |
| **Barracuda** | Naval | Common | $4 | 3 | 2 | 4 | – | Fast gunboat. Claims sea lanes, raids coasts. |
| **Lancer** | Infantry | Uncommon | $4 | 3 | 2 | 2 | – | Tank Hunter: +3 Chips when fighting vehicles. |
| **Warden** | Air | Uncommon | $4 | 1 | 3 | 3 | – | Shield drone. Aegis: +1 Mult when its hex defends. |
| **Bulwark** | Vehicle | Uncommon | $5 | 3 | 5 | 3 | – | Armoured carrier. Holds the line. |
| **Hornet** | Air | Uncommon | $5 | 4 | 1 | 4 | – | Strike drone. Flies over mountains and water. |
| **Mauler** | Vehicle | Uncommon | $6 | 5 | 4 | 2 | – | Main battle tank. |
| **Ark** | Naval | Uncommon | $4 | 0 | 3 | 4 | – | Transport. Carries up to 3 land units across the sea. |
| **Marlin** | Naval | Rare | $7 | 5 | 4 | 4 | 2 | Destroyer. Shells coasts and ships 2 hexes away. |
| **Basilisk** | Artillery | Rare | $8 | 7 | 2 | 1 | 3 | Railgun platform. Fires 3 hexes. |
| **Wraith** | Vehicle | Rare | $8 | 6 | 3 | 4 | – | Hover tank. Glides across water. |
| **Kraken** | Naval | Rare | $8 | 7 | 2 | 4 | – | Submarine. Torpedoes: +4 Chips vs ships. |
| **Leviathan** | Vehicle | Legendary | $14 | 12 | 10 | 1 | – | Land dreadnought. Never suffers pyrrhic losses. |
| **Seraph** | Air | Legendary | $12 | 9 | 4 | 5 | – | Gunship. Seizes enemy hexes it flies over. |
| **Oracle** | Artillery | Legendary | $11 | 8 | 3 | 2 | 4 | Orbital uplink. Range 4, ignores mountains. |
| **Abyssal** | Naval | Legendary | $15 | 12 | 10 | 3 | 4 | Sea dreadnought. Range 4. Never suffers pyrrhic losses. |

## Tactics

Single-use cards from your hand.

| Tactic | Rarity | Cost | Effect |
|---|---|---|---|
| **Smoke Screen** | Common | $1 | A hex you own gets +2 Mult on defence until your next turn. |
| **Forced March** | Common | $1 | Units on one hex may act again, with +2 move. |
| **Conscription** | Common | $1 | Deploy 2 free Grunts at a deploy point. |
| **Airstrike** | Uncommon | $4 | Bomb enemy units within 4 of your land. Roll: kills 1–3. |
| **Heli Drop** | Uncommon | $3 | Fly a stack up to 5 hexes onto any empty land and seize it. |
| **Sabotage** | Uncommon | $3 | Destroy an enemy structure (or bridge) within 3 of your land. |
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
| **Market** | $7 | +$3 per turn per level, +$1 more for each other Market level or Port you own (trade network). |
| **Refinery** | $6 | +$2 per turn per level (+$4 per level on a Resource node or oil rig). |
| **Depot** | $4 | Logistics hub: your units starting their turn nearby get +1 move. Range = level. |
| **Port** | $5 | Coast only. Launch ships into the adjacent sea. Supply source for sea lanes. |
| **Bridge** | $6 | Span a 1-hex sea gap between two shores. Land units cross; ships cannot pass. |
| **Bunker** | $4 | +2 Mult defence, +1 more per extra level. |
| **Flak** | $5 | Blocks enemy air tactics nearby (range = level). +2 Mult vs air. |

## Factions

| Faction | Perk | Starts with |
|---|---|---|
| **Iron Covenant** | Steel Wall: +1 defence Chip per unit when defending. | Bulwark |
| **Volt Syndicate** | Overclock: Vehicles and air units get +1 move. | Hornet |
| **Ashen Nomads** | Raiders: Move through and seize empty enemy hexes. | Skitter |
| **Verdant Host** | Deep Roots: Structures cost $2 less. Start with a Bunker by your HQ. | Thumper |
| **Null Order** | Loaded Dice: Your combat rolls of 1 count as 3. | Lancer |

Every commander also starts with **Grunts** and the **Ark** transport.
