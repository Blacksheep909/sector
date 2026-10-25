# SECTOR changelog

Every release, newest first. Each version also has its own post on the [Releases page](https://github.com/Blacksheep909/sector/releases).

## v0.10.4 (unreleased)

**Mission fixes, a cloud transition between missions, and combined arms that works.**

- **Fix: General Hale's face and cap could show up black** in his speech bubble after NEXT MISSION. Two copies of his portrait shared their colour gradients, and when one was hidden the other drew without them. Every copy now has its own.
- **Fix: Shift-clicking a second stack moved your first stack onto it** instead of adding it to the selection. Shift on a hex with your own troops now always adds them (combined arms); Shift on an enemy hex still sends everything selected in.
- **Fix: missions ended before the capture played out.** The result now waits until the last fight and the troops moving in have finished on screen.
- **Fix: after the last mission there was nothing to do but replay it.** Its result now has a **🏆 MAIN MENU** button.
- **🗺 LOOK AT MAP** on the mission result hides it so you can look over the board, with a button to bring it back.
- **Clouds between missions:** NEXT MISSION, RETRY and starting a mission roll in dark war-smoke from both sides while the board loads, then part, instead of a stutter and a flash of the menu.
- Unlocking a faction ends with **AFFIRMATIVE**.
- **Fix: joining a friend's game over LAN dropped you on the main menu.** Room codes belong to the server that made them, so typing a friend's code on your own server found nothing. A code your server doesn't know is now looked up on your network and takes you straight into your friend's room. **FIND LAN GAMES** lists every open lobby with its own JOIN (or WATCH), and an invite link now wins over a seat you had somewhere else.
- **Fix: WATCH in FIND LAN GAMES showed the main menu over the war.**
- **Fix: COPY INVITE LINK didn't copy over LAN.** Browsers only allow the modern clipboard on https; every copy button now falls back to the older copy command, and failing that shows the link selected, ready for Ctrl+C.
- **Fix: the game lagged when zooming in and out.** While the camera moves, the map is redrawn at most once (softly, then sharp when you stop), and the sea background is cached. In testing, full redraws during a fast zoom went from 9 to 1, and frames from 24 ms to 17 ms.
- **Fix: zooming out fast showed a box of sea** floating on a flat background until the redraw caught up.
- **Fix: a card from a resupply ballooned** as it flew into an empty hand.
- **Fog of war:** when no human can see what a bot is doing, it doesn't wait between moves (a far-off bot's turn now takes about a second), and sounds, encirclement banners and other effects for things you can't see no longer play.
- **Air strikes** are drawn as swept-wing strike jets flying nose first (they were the gunship icon, turned sideways).
- **General Hale** sits higher, clear of UNDO and END TURN. The lobby no longer shows a MISSIONS button (missions are on the front page), and the Esc menu in a mission has **↻ RESTART MISSION**.
- **New rare card: the Mule**, a tandem-rotor heavy-lift helicopter. Attack 1, defence 1, 4 move, and it carries up to 8 Grunts over mountains and water. It's for moving troops, not fighting.
- **Carriers** are slower and lighter: 1 move, attack 2, defence 2.
- **A captured HQ becomes your FOB.** When a siege knocks a commander out, their old capital is a deploy point for whoever took it.
- **Intel ops** cost a quarter of your income (at least $2), so scouting stays a real choice later in a war.
- **🕶 The black market.** Once your income reaches $50 a turn, a round purple **black market** button appears on your cash panel. Every turn it stocks 5 random tactic cards to buy outright for cash (a price for the rarity plus a fifth of your income), so a big economy can turn money into cards. What you don't buy is gone next turn. Bots shop there too.
- **Resupply cards stay worth taking all game.** A card used to cost half your income, so at $200 a turn a common Airstrike cost $100. Now a card costs a little for its rarity plus 15% of your income (never more than half), and the cash you keep shows under each card: at $200 a turn a common card costs $32. Big economies also flip rarer cards: from $30 a turn the odds slide toward rare, epic and legendary (at $150+, about 1 card in 3 is epic or better, up from 1 in 10).
- **Anti-air fires from range, like artillery, but only at aircraft.** Stinger teams reach 1 hex, Scorpions and Skyguards 2, and SAM batteries 3. A shot hits or misses on the dice like a shell. Against ground troops anti-air is now weak: each anti-air unit counts half its attack when it attacks a hex with no aircraft in it.
- **New epic card: the Grumble**, an S-300 long-range SAM launcher. Range 3, moves 2, +6 chips against aircraft, and a 55% chance to shoot down air strikes within 3. The **Sentinel** is the Patriot battery: it moves 1 and is still the only defence against a Trident missile.
- **Artillery hits harder.** A shot that beats the defence by half again kills 2 units (it took double before), and one that beats it by two and a half times kills 3. Against artillery alone, Bunker and FOB walls count for half. The **Hailstorm** MLRS has 9 attack (was 7) and the **Thumper** 4 (was 3). In testing, a ★★★ Hailstorm now kills about 2 of a 5-Grunt stack per shot (1.3 before), and about 0.8 units in a bunker (0.25 before).
- **New mission: Sky Shield** (Hard), on shooting down aircraft with anti-air. The Big Guns briefing explains the new multi-kill hits.
- **Bots use combined arms.** When a bot masses stacks into one attack it now looks for a stack that adds a new kind of unit (troops, armour, air), and brings it in even when the odds are already good.
- **Alliances no longer share vision.** Each side sees only with its own troops and land; an ally's moves out of your sight stay hidden. You still know where your ally's HQ is. Teammates in a team game still share vision.
- **Gifts win bots over.** Giving a bot cash or cards (or a deal that's mostly a gift) raises its mood towards you, more for a gift that's big next to its income.
- **The opening draft shows fog of war** behind it, not the whole map. Markers, trees and flags on the map no longer bob and hop.
- **The Ravager** is redrawn as an Mi-28 and **the Seraph** as a C-130 gunship.
- **Missions:** every mission now pays **100 Valor** on its first clear, and clearing every mission pays **1,000** more. There are now **18 missions** in teaching order. New: **War Chest** (income, resupply, Refineries and Warehouses), **Holding Ground** (holding a fort and your HQ: high ground, digging in, Bunkers, fortifying the HQ), **Forward Base** (FOBs and Depots), **Spoils of War** (ruins, caches, villages, relics and abandoned FOBs), **Air Power** (Airstrikes, Gun Runs, Heli Drops and Flak), **Sea Lanes** (Ports, warships and sea control) and **The Cauldron** (encirclement). Missions you'd already cleared stay unlocked. Bigger "situation" missions are on the way.


**Singleplayer with saves on your account, public wars you can host, a store overhaul, clean chat, and a round of security fixes.**

- **Fix: the game stalled on DEPLOY (and then missions wouldn't start).** On a server running the console dashboard (Sector.exe), the dashboard crashed as soon as someone joined a room. Logging that crash redrew the dashboard, which crashed again, so the server spent all its time writing errors and games stopped moving. The dashboard is fixed, and a dashboard error can no longer loop or hold up a game.
- **PLAY: join an open war, or host your own.** PLAY puts you in a public war that's still open; if none is, it opens a new one with you as host. You can change the settings, add bots and press DEPLOY when you're ready (bots fill the empty seats), and anyone else pressing PLAY joins you until then. The 30-second countdown is gone. **＋ PRIVATE ROOM** is the same but invite-only.
- **Buy anything, any day.** Today's shop still sells its picks at their price, and now everything else (territories, auras, border lines, banners and card versions) can be bought from the Locker any day, for a higher price. **BROWSE EVERYTHING** in the shop takes you there.
- **Every country flag costs the same** (1,500 Valor).
- **Unlock animations.** Buying a look or unlocking a faction plays a reveal: a flash, rays in its rarity colour, sparks, and an **EQUIP NOW** button.
- **30,000 Valor to start, for testing.** Every commander gets it once, new or existing (server hosts: `SECTOR_START_VALOR`, set it to 0 to turn it off).
- **🎮 Singleplayer.** A new button on the front page opens a war of your own with three bots ready to go. **INVITE A FRIEND** (in the lobby or the Esc menu) copies a link; a friend who opens it can take over a bot.
- **Saved wars belong to your account.** Wars you start in a room of your own save themselves to your commander, so signing in on another device brings them with you. You keep your 5 most recent; resume or delete them from your lobby. Older saves move onto the account of the commander who played them.
- **Clean chat and names.** Links and addresses are removed, swearing is masked, fancy-font text shows as plain letters, stacked "zalgo" marks and invisible characters are stripped, and offensive or official-looking names are refused (you're told, and keep your old one).
- **Security hardening.** Fixed a crafted purchase that could turn Valor into an invalid number and make everything free; saves can no longer be loaded or deleted by anyone but their owner; a web address with a hidden character could crash the server. One bad message can no longer stop the server, and oversized messages, floods and too many connections from one address are cut off. Lobby settings only accept the values the menus offer, and pages carry a Content-Security-Policy. `tools/pentest.js` checks all of this.
- **Fix: the Docker image** was missing a file and wouldn't start.
- **Recruits count when they make an account.** A friend who joins with your recruit link now pays out when they sign in with Google or Discord (you get 250 Valor, they get 100), instead of after their first game. Each login belongs to one commander, so every recruit has to be a real account.
- **Missions from anywhere.** Picking a mission while you're sitting in a public war (or someone else's room) takes you out of it into a room of your own, instead of doing nothing.

## v0.10.2

**Accounts with Google and Discord, and fixes for frozen screens, the tutorial and overlapping menus.**

- **🔐 Accounts: sign in with Google or Discord.** Your commander card has **Save your progress** buttons: link your commander (Valor, skins, factions, record) to a Google or Discord login, then sign in on any other device or browser to pick it up there. Signing out starts a fresh guest commander in that browser. The server never sees a password. Server hosts switch each provider on with its keys (see [Hosting → Accounts](HOSTING.md#accounts-sign-in-with-google-and-discord)); until then the buttons don't show.
- **Fix: everything stopped working after pressing Leave straight after DEPLOY.** The "Rolling the battlefield" reel stayed on top of the front page and swallowed every click. Leaving a war now clears every overlay it put up, and the reel never blocks clicks.
- **Fix: a mission (or war) could hang on the enemy's turn**, so End Turn seemed to do nothing. If the previous war in the same room ended with a battle window or overwatch prompt still open, the next war's bots waited for it forever. Every new war, mission and return to the lobby now starts clean.
- **Fix: a dead game screen after the server restarted.** If you were mid-war when the server restarted (an update, say), the game screen stayed up and nothing responded. You're now taken back to the front page with a message.
- **Missions show the whole board.** On smaller screens the camera used to zoom in on your HQ, so in Breakthrough, Beachhead and Hold the Line the objective was off the edge. Every mission now opens with its whole board in view, clear of the HUD.
- **General Hale.** Your mission guide has been promoted and redrawn: a peaked officer's cap with gold braid and a star badge, a grey moustache, a general's stars on his collar and a row of medal ribbons.
- **The tutorial waits for you.** In Basic Training, End Turn is held back until General Hale asks for it (he repeats what he's waiting for), so you can't skip a lesson by accident and run out of turns.
- **Mission Valor is paid once.** Each mission pays its reward on your commander's first clear only; replaying it is just for fun. The missions board shows the reward until your commander has earned it, then ✔ Cleared.
- **General Hale moved to the bottom right**, so he no longer covers the chat, the build bar or the deck. The mission bar now sits under the turn banner instead of overlapping it, and messages appear below it.
- **The game speed buttons** match the other buttons in the top-right row.
- **The deck's label** stays on one line instead of running under the first card.
- **Valor Packs have their own Store tab** (they arrive with accounts), with a guide to earning Valor in the meantime.
- **For developers:** `tools/ui-audit.js` opens every screen and checks every button can be clicked and nothing errors; `tools/fuzz-rooms.js` throws thousands of random actions at a server from several clients and reports any crash.

## v0.10.1

**Factions to unlock, and a pile of front-menu fixes.**

- **🏴 Factions are unlocked with Valor.** Everyone starts with **Iron Covenant**. The other four (Volt Syndicate, Ashen Nomads, Verdant Host, Null Order) are in the new **Store → Factions** tab at 1,500 Valor each, unlocked for good. A room's lobby only lists the factions you own, with a link to the Store for the rest. The server checks it, so a locked faction can't be picked. Bots can still be any faction.
- **The front page holds still.** The war map behind the menu no longer drifts. It's now a still, dimmed, blurred backdrop with no labels or troops, and it only shows on the front page: room lobbies get a clean background.
- **Fix:** leaving a mission left the mission bar and Sergeant Hale on the front page. Leaving any war now clears everything it put on screen, including open battle and overwatch pop-ups.
- **Fix:** after leaving a room the backdrop vanished, leaving a blank screen.
- **Fix:** the room-code box and its JOIN button could overflow onto the leaderboard on some screens.
- **Your faction and colour follow you** from room to room, instead of being re-rolled each time you join one.
- **Rooms close as soon as the last person leaves on purpose** (instead of a bot-only war running on for minutes), and the "wars raging" count only counts wars someone is in.
- **Shorter screens:** the front page is more compact below about 820 pixels tall.

## v0.10.0

**A new .io-style front menu with quick play, private rooms and parties, bots with personalities, ten puzzle missions with a tutorial, skins and crates, and a balance pass backed by data.**

### 🎮 Online play: a new front menu, rooms and parties

- **🎮 A new front menu, built like an .io game.** A live war map drifts behind it. A big **PLAY** button drops you straight into a public war, **＋ PRIVATE ROOM** opens a room with a code to share, and a code box joins a friend's. Your **commander card** shows your banner, territory skin and record, with **CUSTOMIZE** to open the Locker. The **leaderboard** shows the most wins this week and all time, and the **news** strip shows the latest patch notes. The top bar shows who's online and how many wars are running, and ⚙ **Settings** holds volume, music, graphics quality (Low for older machines), reduced motion and bot chatter.
- **🏠 Rooms: many wars on one server.** Public wars have no host and standard settings with a 60-second turn clock. They count down from the first arrival, and bots fill the empty seats when they deploy. Private rooms work like the old lobby, with every setting, saves and bots, plus a code and an invite link (`/?room=CODE`). Reloading the page puts you back in your room. Empty rooms close by themselves, and a private war in progress is saved first. LAN servers keep the classic lobby one click away (**Join the LAN lobby**), and **Find LAN games** still scans your Wi-Fi.
- **👥 Parties.** Start a party, send the invite link, and see everyone's callsign, banner and whereabouts (ready, in a room, at war). Click anyone to see their profile: wins, win rate, kills, hexes taken, missions, and their banner, territory and border. The leader's PLAY or private room takes the whole party along. The leader can hand over the crown or remove someone. Names in a room's lobby and on the leaderboard open profiles too.
- **🎯 Missions from the front menu:** picking a mission opens a private room for it.

### 🤖 Bots

- **🎭 Bots have personalities.** Each bot is a **⚔ Warlord** (attacks early, loves armour, picks on the weakest neighbour), **🛡 Fortress** (bunkers its border, raises its HQ, hard to crack), **💰 Tycoon** (economy first, then a bigger army), **🚁 Sky Marshal** (helicopters and airstrikes), **⚓ Admiral** (ports, warships, beach landings), **🐍 Viper** (makes pacts early, betrays when it pays), **🎲 Wildcard** (long shots, throws in battle cards on a whim) or **🔥 Avenger** (hunts whoever hurt it first). Each bot gets one at random and it stays hidden: you work out who you're up against from how they play. Personalities change how a bot plays, not how strong it is: a Hard Warlord is still a Hard bot.
- **💬 Bots talk.** They taunt you when they win a fight, gloat over your HQ, swear revenge, pitch alliances, apologise (insincerely) when they stab you in the back, and say their last words. Their lines pop up as speech bubbles under their name and in the chat log. Mention a bot by name in chat and it answers back. The host turns personalities (and the chatter) on or off with **Bot personalities** in the war settings.
- **Fix: bots ganging up into one giant alliance.** Pacts chained together until every bot was linked (in 15 of 20 five-bot test games all 5 commanders were in one bloc), leaving a human alone against everyone. Now a bloc holds at most half the commanders still standing (2 at least), for humans and bots alike.
- **🧠 Smarter bots:** an assault planner scores every attack on the board and masses up to three stacks into one pincer instead of trickling units in; a threat map tells them which of their bases, buildings and resources are about to be hit, and they move sturdy stacks there and bunker the chokepoints; they buy for punch per dollar early and punch per slot once rich, and lean defensive when pressed; helicopters strike away from anti-air and riflemen and pull back to safe ground instead of loitering. They still grab land hard while there's land to grab. In 60 head-to-head games the new Hard bots beat the old ones 58% to 42% and ended with half as much land again. Easy bots now attack and defend too (just sloppily), so they're beatable but not boring.
- **Lobby:** a new bot takes the difficulty of the bot above it; fog of war and Pick your HQ are now the recommended defaults.

### 🎯 Missions & tutorial

- **🎯 Missions & tutorial:** ten puzzle missions from the front page or lobby, from Basic Training (Sergeant Hale walks you through moving, deploying and attacking) to the Impossible Lightning War. Each teaches one technique (pincers, bridges and combined arms, helicopter lifts, leapfrogging, artillery, battle cards, beach landings, defence, everything at once) on a fixed board with a goal and a turn limit. Hints are a click away, missions unlock in order, and first clears pay Valor (100 up to 2,500). Every mission's solution is checked by `tools/test-scenarios.js`.

### 🎨 Skins, Valor and crates

- **🎨 New art:** Apache (head-on, with the Longbow radar), Mi-28 Havoc, Black Hawk (troops in the door), an AC-130 side-on with its guns firing, and armour after the real machines: M1 Abrams (Mauler), M18 Hellcat, Maus (Leviathan), Ratte (Titan), M2 Bradley (Bulwark).
- **🎨 More looks, and borders that move:** 24 new territory skins, including 19 countries (Germany, France, Italy, Ireland, Netherlands, Poland, Ukraine, Spain, Sweden, Norway, Denmark, Scotland, Japan, South Korea, China, India, Canada, Brazil, Australia: crosses and emblems are centred on your HQ) and Blueprint, Circuit Board, Splinter Camo, Night Vision and Molten. Auras are now animated light: Neon, Sonar, Frostline, Static, Gold Leaf, Embers, Plasma, Toxic, Prism, Blood Moon, Starfield, Void, Aurora and Solar Flare, each glowing only outward from your land. Border lines were redrawn and there are more of them: Map Boundary, Double Line, Hazard Tape, Steel Plate, Sandbags, Railway, Heavy Chain, Trench Line, Barbed Wire, Dragon's Teeth, Power Lines, Laser Fence.
- **🎖 Valor:** the currency is now Valor, a gold medal. Earning it counts up with a chime and medals fly into your Valor pill.
- **💎 Skin tiers match the card rarities**, Common to Mythic, and the rarer the look, the more it costs. Card skins aren't sold outright: a few rotate through the daily store, and the rest come from **crates** (Field Crate 300 Valor, mostly uncommon/rare with a 0.2% Mythic chance; Elite Crate 1,000, rare or better, 2% Mythic; duplicates pay back 30%). Every card now has a version at every tier: Battle-Worn (uncommon), Foil (rare), Gilded (epic), Blackout (legendary) and a named Mythic, like **Valhalla Grunts** or **Sunrise Tactical Nuke**, with a cosmic picture, drifting stars and shimmering lettering. Card skins show on the board too: a unit whose card wears one gets a matching rim and a gem in its rarity colour, and everyone sees each player's own versions in a fight.
- **📦 Crates, redone:** the Field Crate is an olive supply case with steel corner guards and a stencilled star; the Elite Crate is a black armoured case with gold trim, a glowing emblem and violet light leaking from its vents. On the shelf they float, their seams breathe, and now and then the lid jumps and the latches rattle as if something wants out. They lean toward your pointer. Opening one: the crate drops in and shakes once per rarity step, its seams glowing through the colours (a Mythic shakes five times), the latches spring, the lid blows off in a burst of light and sparks, and the card rises face-down before turning over. Legendary and Mythic pulls flash the screen.
- **🗂 Store and Orders are separate.** The Store has two tabs, TODAY'S SHOP and CRATES. Daily and weekly objectives moved to their own **ORDERS** button next to LOCKER and STORE.
- **🎁 Finish every weekly order for a free Field Crate** (once a week). It waits unopened in Store → Crates until you open it.
- **🛢 Oil rigs redrawn** as proper offshore platforms: legs in the swell, a deck with a helipad, a lattice derrick, a crane and a flare stack.
- **🎨 Skins, coins and the store:** a Locker and a daily Store on the main menu. Territory skins are **one big picture over your whole territory**, not a stamp on every hex: flags drape across all your land and grow with it (Stars & Stripes, Union, Alliance Star with its lines running to your borders, Tricolour, Jolly Roger), and camouflage blobs span several hexes (Woodland, Desert, Arctic, Digital, Tiger Stripe, Dazzle, Topographic, Carbon, Hazard). Border auras glow round your frontier (Neon, Gold Leaf, Frostline with ice crystals, Embers, Static, Void with seeping tendrils), and **border lines** restyle the frontier line itself, always in your colour (Map Boundary, Double Line, Steel Plate, Sandbags, Barbed Wire, Dragon's Teeth, Laser Fence). Plus name banners and Foil, Gilded and Blackout versions of every card. Coins come from finished games (more for winning and fighting well, tapering the more you earn in a day, no hard cap) and from daily and weekly objectives. Recruit links pay 250 coins per friend who finishes a game, and Founder skins are set aside for early accounts. Looks only: nothing changes the game. About 1 bot in 10 wears a skin (bots are still labelled as bots).

### ⚔ Battles

- **⚔ Battle cards are played in the dice panel itself.** Before the roll your battle cards rise up under the fight; click one and it flies into your column, and the other side sees it land in real time. Each side shows whether it's ready.
- **⏩ Human-vs-human fights skip only when both players press Space**, and each sees that the other has.
- **🃏 Battle cards replace the quick-reaction pop-up.** Before any attack's dice roll, attacker and defender can both throw cards in (up to 3 a side) while watching the odds change, and answer each other's cards. Rally and Ambush became battle cards, and five new ones join them: **Hold Fast** and **Fix Bayonets** (common), **Covering Barrage**, **Reserves** and **Steady Nerves** (rare). They come from resupply and supply caches; bots play them too. See [Battle cards](RULES.md#battle-cards).

### ⚖ Balance and rules

- **⚖ Balance, from bot games and exact combat maths** (`node tools/balance-lab.js`):
  - **No more flying doomstacks.** Grunts riding in carriers didn't count toward the stack limit, so a hex could hold 5 Stormcrows and 30 Grunts (or 5 Valkyries and 40). Now no hex ever holds more than 10 units.
  - **Helicopters are thin-skinned.** Wren, Ravager, Stormcrow and Banshee have 1 less ATK and 2 less DEF (Wren 2/0, Ravager 4/1, Stormcrow 3/2), the Valkyrie 1 less DEF, and **Ground Fire** gives every infantry unit +1 chip in any fight against a helicopter. Helicopters still hit hard, but they can't sit on a hex and soak up attacks.
  - **Banshee (Apache) toned down:** ATK 10 → 8, DEF 5 → 2, Hellfire +4 → +3 chips, cost $13 → $14.
  - **Grunts cost $2** (were $1). In real games they traded about twice as well as anything else per dollar, and a bot that only spammed Grunts won 45% of 4-player games.
  - **Lancer costs $5** (was $4): the most cost-efficient unit left.
  - **Conscription deploys 5 Grunts** (was 2).
  - **Less dice luck: every roll is d6 + 2.** Twice the enemy's chips used to lose 1 fight in 4; now it wins about 9 in 10. Even fights stay a coin flip, so good planning wins far more reliably.
  - **Payouts scale with the war:** ruins loot, scrapping a crate, and a maxed card's refund grow with your income, so they're still worth having at round 50.
- **🌊 Rivers:** nobody stands in a river any more. Infantry ford straight across to the far bank (it takes their whole move); vehicles still need a bridge. **Fix:** you can now bridge a river hex that touches your supplied land, without having to claim it with aircraft first.
- **🚁 Troops in a helicopter stay aboard over water:** a helicopter carrying Grunts can hover over the sea, but it can't fly off and leave them there.
- **↶ Undo works in fog of war.** Every move uncovered some fog, which locked it in, so undo almost never worked. Now only spotting enemy troops, land or buildings locks a move in. Undo also hands back the hexes the move captured.
- **👥 Teams:** the lobby shows a column per team and you drag names between them. Teams play in team colours: A in reds, B in blues, C gold, D green.
- **🌫 Fog of war, Pick your HQ:** you no longer see where everyone else set up. Only the hexes you can still pick are shown.
- **Removed:** random map supply drops.
- **📊 Balance report:** [docs/BALANCE.md](https://github.com/Blacksheep909/sector/blob/main/docs/BALANCE.md) has the data behind every change.

### ⚡ Smoother, and fixes

- **🔊 Fix:** enemy airstrikes were silent while a full-screen panel (like the resupply picker) was open. The bombs' sound now plays on its own timer.
- **⚡ Smoother board:** every game update also re-sent the war-room marks, and each one made the whole board redraw, several times a second during play. Now the marks are only sent, and the board only redrawn, when they change.
- **⚡ Smoother panning and zooming:** the board used to be fully redrawn every frame while the camera moved, and on every HUD refresh even when nothing changed. Now the whole map is cached as one image (or the screen plus a margin on huge maps) and just slid and scaled while you pan or zoom. In tests panning went from 11 to 59 fps, zooming from 12 to 54, and the idle board holds a steady 60 with no hitches.
- **Fix:** artillery in a mixed stack (say a Thumper guarding with Grunts) couldn't fire at all, which showed up when shooting across water or a river. The guns in a stack can now fire on their own.
- **Fix:** in fog of war, a fallen commander's land kept showing in their colour on hexes you'd seen before. It now shows as neutral.
- **📦 Supply Drop, rebuilt:** the crate opening is one continuous sequence now. A bigger, smoother reel; the chest drops in as the reel clears (no empty beat); a quick click (or it opens itself after a second); a single charge-up as light leaks from the seam; the lid blows off with a glow round the chest instead of a full-screen white-out; the cards rise out in a clean fan, the empty chest fades away, and the cards turn over by themselves. Fixed: the sunburst drifted in a circle instead of spinning in place, and the glow jumped off-centre.
- **🎴 Resupply flows better:** common cards flip in a quick cascade, picking a card fades the panel out while the card flies to your deck (it used to vanish), and keys work: **1 2 3** take a card, **C** collects. Scrap and maxed-card values on the cards now show the real (income-scaled) amount.
- **✨ Epic, Legendary and Mythic reveals, redone:** the card charges up at the centre (trembling harder as the light builds), turns over in one clean half-turn with a flash, then holds big and face-up for a moment with its title above it before gliding back. It used to spin face-down and only show its face once it had shrunk back into the row, with the card back mirrored mid-spin and the title text covering the art. Click to skip the hold.

## v0.9.20

**The open ocean is actually there now.**

- **Fix: holes in the sea:** the map only laid sea within 2 hexes of land, so on Ocean, Inland Sea and Archipelago maps the open water between far-apart islands had no hexes at all. It showed as dark empty space, and it could cut one sea off from another, so ships couldn't sail across. Now:
  - any gap the map encloses is filled with open sea
  - separate seas are joined by open-water channels, so every sea can be reached by ship from every other
  - Ocean maps have about 15% more hexes, all open water. Map generation still takes milliseconds.
- **Fix:** bots sometimes tried to move a carrier with its Grunts somewhere the group couldn't reach. They now check the move first.

Maps are made when a game starts, so a war already in progress (or a saved one) keeps its old map. Start a new game to get the full ocean.

## v0.9.19

**Helicopters, troop carriers, and vehicles that sound like vehicles.**

- **🚁 Four new helicopters:**
  - **Wren** (rare): a light assault helicopter, like the Little Bird. Fast (5 move), with 2 Grunts riding on its benches.
  - **Ravager** (rare): an armoured attack helicopter with a chin cannon and rocket pods, like the Mi-28. Strafing Run.
  - **Stormcrow** (epic): a utility helicopter with door guns, like the Black Hawk. Carries 6 Grunts.
  - **Banshee** (legendary): a tank-killing attack helicopter, like the Apache. **Hellfire** gives +4 chips against vehicles, on top of Strafing Run.
- **🪖 Troop carriers:** Grunts moving with a carrier ride along at the carrier's speed and over its terrain. Helicopters fly them over mountains and water; APCs drive them.
  - Seats: Wren 2, Bulwark 4, Outrider 4, Stormcrow 6, Valkyrie 8.
  - It's all or nothing: with more Grunts than seats, nobody rides and the group walks.
  - Grunts aboard don't take stack space.
  - A helicopter carrying troops can't stop or launch an attack over water.
  - If a carrier is shot down, passengers who no longer fit in the stack go down with it.
  - The hex panel shows a stack's seats and how many Grunts are aboard.
- **🔊 Every kind of kit moves its own way:**
  - Helicopters climb out with a rotor chop, sway in flight, and kick up rotor wash. Their map tokens have a spinning rotor.
  - Jets streak across with a roar and a contrail.
  - Tanks crawl with a rumble, track clank, dust and a little camera judder.
  - Wheeled vehicles glide with an engine note and dust.
  - Ships bob along with a wake.
  - Infantry still march hex by hex.
- **🎨 Icons closer to the real thing:**
  - The Warden is now a proper E-3 Sentry, with swept wings and the striped radar dome.
  - The Valkyrie is a side-on V-22 Osprey with its nacelles up.
  - The **Ambush** card, which had no picture at all, now shows an M18 Claymore mine.

## v0.9.18

**Turn your bridges, claim old bases, and bots that actually march.**

- **↻ Rotate bridges:** select one of your bridges and press **R**, or click **ROTATE BRIDGE** in the hex panel, to turn it to the next of the hex's three directions. It's free and only changes the look: a bridge is crossable from every side.
- **🚩 Abandoned FOBs replace Old Forts:** the neutral garrisoned forts are gone. In their place are war-torn, abandoned forward bases with no garrison. Drive any unit onto one and it becomes your ★ FOB: a deploy point and supply source, online next turn. Bots go for them too.
- **Fix: bots hoarding troops:** bots used to steer by straight-line distance, so on maps where a mountain ridge or lake sat between them and their target, their troops marched up to it and stopped. New troops piled up behind, and whole regions filled with 10-stacks that never moved. Bots now plan routes around mountains and water, place reinforcements where they can actually reach the front, and step up through their own land instead of standing still. In testing, the share of bot units left idle each turn fell from 34% to 13%.

## v0.9.17

**Bots go for the crates.**

- **Fix: bots ignored supply drops:** a bot only took a crate if a stack's best move happened to land on it, so crates behind their lines sat untouched until they expired. Now, if any bot unit can reach a crate this turn, the bot sends its cheapest one to grab it, without pulling a whole stack off the front. Bots also value crates they'd pass over on the way somewhere.

## v0.9.16

**Grunts are easier to dig out.**

- **⚖ Balance:** Grunts' defence drops from 2 to 1. They still cost $1 and attack at 2, but a hex held only by Grunts is now much easier to break.

## v0.9.15

**No more ping-pong pockets.**

- **Fix: endless encirclement:** a hex walled in entirely by mountains counted as "surrounded" for every commander. Whoever was taking their turn annexed it, so it flipped owners every turn with an ENCIRCLED +1 flash each time. Now a pocket only counts as encircled if it touches your land: hold the ground around it, or the only way in, and it's yours. The same rule applies to sea pockets.

## v0.9.14

**The blueprint holds still.**

- **Fix: blueprint flicker.** While you planned during someone else's turn, the board swapped between the real board and your blueprint every time an enemy unit moved. Your planned stacks, captures and deploys blinked out and back, and tiles faded between colours. Now the board always shows the real state, and your blueprint is drawn on top in light blue:
  - ghost stacks where your orders put them
  - a dashed blue wash on land you'll capture
  - ghost buildings where you'll build
- **Fix:** the blueprint's dashed ring was drawn off-centre on stacks sharing a hex with a building, such as your HQ.
- **Fix:** the blueprint order list could get squeezed to one line by the alerts panel. It now keeps room for your orders, and the alerts panel scrolls instead.

## v0.9.13

**Save your wars and pick them up later.**

- **💾 Saved games:**
  - Every war in progress saves itself a few seconds after each move.
  - The host can also save from the Esc menu (**SAVE GAME**).
  - Pressing **END GAME FOR EVERYONE** keeps the war saved too.
- **Resume from the lobby:** the host sees a **SAVED WARS** list with **RESUME** and delete buttons.
  - Anyone in the lobby with the same callsign as a commander in the save gets their seat back: same army, cash and cards.
  - Seats with nobody back yet are played by bots. Newcomers watch and can **TAKE OVER** any bot.
- Saves are stored in `%APPDATA%\Sector\saves`. The 20 newest are kept, and a war that finishes is removed from the list.
- **💥 One-hit wins land in one go:** on a sure-win attack, your troops now drive straight onto the hex and it goes up in a single blast as they land. Before, they stopped next to it, an explosion played, a second one played, then they stepped in.

## v0.9.12

**The hex count on name cards now matches what wins.**

- **Fix:** the hex count on each commander's card included sea hexes, but Conquest, World War and the time-up winner only count land. A commander could show 220 against a target of 205 and still not have won. The card now shows land hexes. Hover it to see the sea hexes too.

## v0.9.11

**Blitz through empty land, and a clean exit.**

- **⚡ Sweeping advance:** troops used to stop on every enemy hex they captured, so clearing out a beaten rival took forever. Now undefended enemy land doesn't slow you down. Your troops move at full speed through empty enemy hexes and capture every one on the way. They stop when:
  - they take a fortified hex (FOB or Flak)
  - they come next to enemy troops
  - they reach a river

  Bunkers and HQs still have to be attacked. Bots blitz too.
- **🚀 Max speed skips the dice:** on max speed, every fight (even the close ones, and crushing wins) plays as a quick flash on the map. The dice screen never stops the game.
- **Fix:** leaving a game while a move was still animating could paint the old board back behind the main menu. The menu now stays clean.

## v0.9.10

**Artillery moves when it can.**

- **Fix:** clicking an empty enemy hex that your artillery (or warship) could both move onto and shell used to fire at the building on it. Now it moves in and captures the hex, buildings and all. Shelling is still there for empty hexes you can only reach by firing, and for hexes with troops on them.
- **Bots** do the same: they capture empty enemy buildings they can walk into, instead of shelling them.

## v0.9.9

**No more dice for fights you're not in.**

- **🎲 The dice screen is for human fights:** the dice tray and fight screen only play when a human commander is attacking or defending. Bot-vs-bot battles, and bots storming villages and forts, now resolve with a quick clash on the map: a flash, and who won. Watching other players' turns, or a bot-only game, is much faster.

## v0.9.8

**Taking out a rival pays like it should.**

- **💰 Spoils of war scale with the game:** eliminating a commander used to pay a flat $10. Now the conqueror gets all of this, on top of the heartland:
  - $10 plus $2 per round played
  - the fallen commander's whole treasury
  - one turn of their income
  - up to 2 of their tactic cards

  The later the war, the bigger the prize. In testing, a round-20 elimination paid about $86 plus 2 cards.
- The fall banner and the log show what you plundered.

## v0.9.7

**See your friends' land, and tidier bridges.**

- **🤝 Allied land stands out:** every hex your allies hold has a dashed green line just inside its border, so you can see all your friends' territory at a glance. In fog of war, allying with someone also reveals their whole territory and their HQ.
- **🌉 Bridge fixes:**
  - You can't build a bridge on top of an oil rig.
  - The "no bridges side by side" rule now covers river bridges too.
  - If you see bridges sprawling across neighbouring hexes, that's the old bridge model from before v0.9.4. Update (press **U** in the server window) to get the new one, which stays inside its own hex.

## v0.9.6

**Reasons to keep watching the board when it isn't your turn.**

- **🎯 Overwatch:** on your turn, select a stack and press **O**. It gives up its move to watch the hexes around it. If an enemy ends a move next to it (or within range, for artillery), you get a few seconds to choose **FIRE** or **HOLD**, with the hit chance shown. Overwatch fire gets +1 mult, and it's spent after one shot. Bots use overwatch too.
- **📦 Supply drops:** now and then a crate parachutes onto open land, away from the HQs, and everyone sees where it lands. The first unit to reach it grabs cash or a card. Drops last 5 rounds.
- **📡 Radar contacts** (fog of war): when hidden enemy troops move within 2 hexes of your land, a blip shows where they were last seen.
- **⚠ Alerts while you wait:** attacks on you, radar contacts and supply drops are listed in the side panel, each with a **LOOK** button that jumps the camera there.
- **🏁 Conquest progress:** in Conquest and World War, the top-left box shows your hexes against the target, how many you still need, and who's leading.

## v0.9.5

**Know who you're hitting.**

- **⚔ The attack tooltip names the defender:** it shows the commander you'd be fighting by name and colour, with a clear "you are not allied" warning. No more mistaking a rival's land for an ally's. (Attacking an actual ally was never possible: allied land and troops can only be passed through.)
- **Emotes are visible again:** taunts pop up under a commander's name card instead of above it, where they got cut off at the top of the screen.

## v0.9.4

**Speed controls, real rivers, better bridges, and a big bug sweep.**

**Speed controls**
- **A speed strip in the top bar:**
  - **⏸** pauses or resumes.
  - **>**, **>>** and **>>>** pick Normal, Fast and Superspeed.
  - **🚀** adds Max speed once only bots are left.
- **Pause** stops the bots and freezes the turn clock until someone presses **▶**. The host controls the strip, or anyone once only bots are playing.

**Rivers and bridges**
- **Rivers are real obstacles:**
  - Vehicles and artillery can't cross a river without a bridge.
  - Infantry can ford one, but wading in ends their move for the turn.
  - Aircraft fly over.
- **Bridge your rivers:** build a Bridge on a river hex you own to let vehicles across. Bots bridge rivers that block their front.
- **Roads** only cross rivers where there's a bridge.
- **New bridge model:** an arched steel bridge with concrete piers, an asphalt deck with lane markings, and railings in the owner's colour.

**Units and cards**
- **✈ Aircraft can stop over water:** they're flying, so they no longer drop into the sea at the end of a move.
- **🛩 Hornet is now a Common scout drone:** ATK 2, $4.
- **🔊 Gun Run sounds like a real A-10:** the GAU-8 cannon's "BRRRT", shells crackling on the target, then the jet screaming past.
- **💥 Kamikaze Drone** (new Common card): a loitering munition with range 5. It kills a unit on a 4+, or knocks a level off an undefended building. Air defence can shoot it down.
- **🕵 Spy Ring and Embargo:** press **🎯 TARGET** on a rival's name card. You no longer have to find their land in the fog.
- **Stealing makes enemies:** the victim of a Spy Ring is furious with the thief (a big mood drop that bots act on), and everyone else trusts the thief a little less.
- **🛰 Intel ops cost about 15% of your income** (minimum $2), so scouting scales with your economy. The button shows what you can actually afford right now.

**Quality of life**
- **One Enter ends your turn.**
- **💀 Losing units is never silent:** a message tells you what you lost and why (battle, enemy strike, lost at sea, cut off when a pact ended).

**Fixes from a full bug sweep** (thousands of bot turns across every mode, map type, fog and teams setting, plus random invalid moves)
- Bots no longer try to fortify an HQ that's already maxed out.
- The automated browser test no longer leaves hidden browsers running, which had been joining later test lobbies as ghost players.

## v0.9.3

**Plan with your allies, and lend them troops.**

- **🗺 Ally war room:** press **Alt** to switch the war-room view on and off (it's a toggle now, not hold-to-see). In it you can:
  - drag from one hex to another to draw an arrow
  - click a hex to circle it
  - right-click to erase your marks there

  Only you and your allies can see the marks, and only in this view. Use it to plan pincers, call targets and mark danger while you wait.
- **🎁 Troop donations:** on your turn, select a stack and press **GIVE** on an ally's name card. The stack becomes theirs, ready to act on their turn, and bots like you more for it.

## v0.9.2

**Quick decisions are quick, and bombing in the fog behaves.**

- **⚡ Quick decisions pop up:** at a random moment while you wait, a choice appears in the middle of the screen for about 6 seconds. Grab one, or it's gone. They now turn up on about half the rounds instead of every round, so they stay a surprise.
- **🏕 FOBs take reinforcements even when cut off** from your supply network. They still don't supply land until they're reconnected.
- **🐟 Fishing grounds are gone.** The sea pays through sea lanes, oil rigs and shipping lanes.
- **🌫 Bombing in the fog of war:** when you bomb or shell a hex you can't see, you get a damage assessment, meaning you can see the area you hit until the end of the round. Wrecked buildings no longer pop back up from your old memory of the hex. Bombed-out land and bridge wreckage also stay as you last saw them once a hex goes back into the fog.

## v0.9.1

**Allies open their borders.**

- **🤝 Allied passage:** while you're allied, your troops and ships can cross your ally's land and sea, and stop on any of it that's empty. You never capture allied hexes. Hexes where your ally's troops stand can be crossed but not stopped on.
- **🚫 Don't get caught on the wrong side:** when a pact ends, by betrayal or by lapsing without renewal, any troops still standing in the other side's territory are lost. That applies both ways. A betrayal takes effect at the start of the breaker's next turn, and both sides get a warning to pull out first.
- **Bots** use allied land to pass through, but never park troops in it.

## v0.9.0

**Something to do on every turn, not just yours.**

**While you wait**
- **⚡ Reaction cards:** when someone attacks you, you get 7 seconds to answer with **Smoke Screen**, **Fortify**, **Aegis Protocol** or the new **Ambush** card (Common, $1: your defenders get +2 Chips each in that fight). The attack waits for your answer, whether it comes from a human or a bot.
- **🎴 Pick your next resupply early:** your next resupply is dealt as your turn ends, so you can choose a card or full income while the others play. Your next turn starts straight in the action.
- **⚡ Quick decisions:** once a round, while someone else is playing, you get an either/or choice. The options are:
  - +$3 now
  - +1 move for all your units next turn
  - a free Grunt at your HQ
  - +$1 per 4 hexes you hold
  - 4 resupply cards instead of 3
  - every bot warming to you
- **🤝 Diplomacy any time:** propose, accept, renew or break alliances, and trade, even when it isn't your turn.
- **🛰 Intel ops** (fog of war): $2 to scout a 2-hex area anywhere until the end of next round, twice per round. Press **I** or use the panel.
- **📍 Pings and emotes:** ping a hex (⚔ attack, ❗ help, 👁 look) or throw a taunt (👊😂😱🔥💀🏳️) from the bar above the chat.
- **🎲 The defender's die is yours:** when you're attacked, you throw your own die.

**Faster turns**
- **⏱ Time bank** (lobby option): a chess clock instead of a turn timer. 3 or 6 minutes in the bank, plus 20 seconds every turn. Quick turns save time for the big ones.
- **⚡ Auto-resolve:** a fight with 95%+ odds that goes the expected way skips the dice and the long animation.
- **Batch moves:** Shift+drag a box around several stacks, then click a hex to send them all there (each goes as far as it can), or click a red target to attack together.
- **⛏ Dig in:** select a stack and press **G**. It gives up its move for +1 defence until it moves again. It can be queued in the blueprint too, and dug-in stacks show sandbags.

**Fixes**
- **Fog of war hides rival HQs** until you've explored them. Their income pop-ups no longer give them away either.
- The TRADE / ALLY / TAKE OVER buttons sit on their own row and no longer cover a commander's cash.

## v0.8.4

**Bridges you can bomb, fast wheels, rocket artillery, and every icon drawn from the real thing.**

- **🌉 Bridges:**
  - Two bridges can't sit next to each other.
  - Airstrike (on a 3+), Precision Strike and Bunker Buster can hit an enemy bridge, as well as Sabotage. Anyone standing on it goes into the water.
  - A destroyed bridge leaves **wreckage** in the channel. Building a new bridge there costs **$8 more** to clear it.
- **🚙 New light vehicles (Uncommon):**
  - **Jackal**, an up-armoured Humvee with a heavy machine gun ($3, ATK 3, DEF 2, 4 move).
  - **Coyote**, a JLTV scout truck that sees 2 hexes further in the fog of war ($4).
- **🛞 The Wraith hover tank is now the Outrider:** an eight-wheeled Stryker-style fighting vehicle with 5 move, the fastest thing on the ground. It no longer crosses water.
- **🚀 Hailstorm (new Epic):** an M270-style tracked rocket launcher with range 4. A hit also rains rockets on every enemy stack next to the target, killing one unit in each.
- **🪖 Grunts cost $1.**
- **Every icon is a real military machine or piece of kit:**
  - Airstrike is an F-16 dropping bombs, Gun Run an A-10, Heli Drop a UH-60 Black Hawk.
  - Smoke Screen is an M18 grenade, Tactical Nuke a B61 bomb, Aegis Protocol an Aegis destroyer.
  - Forced March is combat boots, Rally a bugle, Blitz a charging tank.
  - EMP is an e-bomb, and Orbital Strike a satellite firing its beam.

## v0.8.3

**Air defence that actually defends, and a missile submarine.**

- **🛡 Air defence shoots down air strikes.** Flak and anti-air vehicles now defend against long-range air attacks the way a bunker defends its hex. Every enemy air-defence asset near the target gets a chance to shoot the strike down (stacking, up to 90%):

  | Asset | Covers | Shoot-down chance |
  |---|---|---|
  | Flak | within its level | 35% ★, 45% ★★, 55% ★★★ |
  | Stinger | its own hex | 25% |
  | Scorpion | 1 hex | 35% |
  | Skyguard | 2 hexes | 50% |
  | Sentinel | 3 hexes | 60% |

  - This applies to Gun Run, Airstrike, Precision Strike, Bunker Buster, Carpet Bombing and Strategic Bombing. Carpet and Strategic Bombing roll for each hex.
  - Precision Strike (a stealth jet) is only 60% as likely to be caught.
  - A downed strike still spends the card.
  - Defended hexes can be targeted now, and the targeting overlay shows the chance your strike gets through.
  - Flak still blocks Heli Drops and EMPs.
- **☢ Nukes can't be stopped.** The Tactical Nuke and the Tsar Bomba ignore air defence, and Flak no longer blocks them.
- **🚀 Trident** (new Legendary submarine, modelled on the Ohio class): fires a missile at any troops or buildings within 8 hexes, over mountains, and a hit kills one extra unit. Only a Sentinel SAM within 3 hexes of the target can intercept it.

## v0.8.2

**Economic warfare: bomb the factories, not just the troops.**

- **💣 Strategic Bombing** (new Rare card, B-52): bombers hit an enemy hex within 6 of your land and all its neighbours. Every Warehouse, Refinery, Depot and Port there loses a level (★ buildings and Ports are destroyed), and that land is **bombed out**: it pays nothing for its owner's next 2 turns. Supply still runs through it.
- **Strikes hit buildings:** Gun Run, Airstrike and Precision Strike can now target an enemy hex with economic buildings and no troops.
  - Gun Run knocks off a level.
  - Airstrike knocks off 1–2 levels.
  - Precision Strike destroys a building outright.
  - Defended hexes still take the hit on their troops.
- **🎯 Artillery and warships shell undefended buildings** in range: every salvo knocks a level off the most valuable one.
- **Bombed-out land** is scorched on the map. Its tooltip and your income line show how long it stays bombed out.
- **Bots wage economic war too:** they shell undefended Warehouses and Refineries, and send the bombers over their rivals' richest land.

## v0.8.1

**A HUD where nothing overlaps, livelier natural maps, and a stronger Quarry Blast.**

- **🧩 Panels can't overlap any more.** The HUD is now split into fixed regions: the top bar, a centre stack under it (turn pill, hints, turn clock, siege and HQ-pick banners), a left column (cash, world event, log and chat), a right column (hex info, blueprint, offers) and a bottom dock (build bar, deck, hand, undo and end turn). Each region is measured live, so a taller top bar or a fuller dock pushes the others out of the way.
- **The hand fits itself.** The more cards you hold, the more they overlap, so the hand always fits between your deck and the buttons. On narrow windows the whole dock shrinks to fit.
- **Fixed:** the cash panel no longer slides down over the log, and long card texts (Precision Strike, Bunker Buster) fit their cards.
- **🗺 Livelier natural maps** (the abstract layouts from v0.8.0 are gone):
  - **About twice as many rivers.** Later rivers join earlier ones, so you get branching tributaries.
  - **Lakes:** a few small inland lakes in the lowlands, which rivers can drain into.
  - **Mountain spurs:** short highland ridges branching off the ranges.
  - All of this stays clear of every HQ.
- **⛏ Quarry Blast brings down two mountains:** the one you target and the one behind it, opening a 2-hex pass.

## v0.8.0

**Faster turns, clearer turns, smarter bots, an economy that can't run away, and a lot of new toys.**

**Turns that move**
- **▶ Whose turn is it?** A pinned pill under the top bar always says whose turn it is. On your turn the screen edge glows in your colour and the browser tab blinks if you're in another window. When you're next, it tells you.
- **⏩ Game speed:** Normal, Fast (the default) or Superspeed, set in the lobby and with the speed button in the top bar. Bot turns fly by. When only bots are left, anyone watching can push it to 🚀 Max.
- **⚑ March orders:** Ctrl+click a far hex (or press **M** and click) to give a stack a standing order. It advances by itself at the start of every turn, and halts on enemy contact or when it arrives. Big late-game armies no longer need moving hex by hex. **Delete** cancels it.
- **Auto-end turn:** when nothing is left to do, your turn ends after a 3-second countdown (press STAY to keep it). You can switch it off in the Esc menu.
- **💤 AFK cover:** a connected player who sits idle through 2 turns gets a bot until they touch anything again. Without a turn timer, a turn with no sign of life ends after 2 minutes.
- **Bot-only games keep running,** even when nobody is watching.

**Controls and visuals**
- **Ctrl+Z works everywhere:** in the blueprint (it takes back the last queued order), mid-animation, from an empty chat box, and on any keyboard layout. When something can't be undone, it tells you why.
- **Tab / Shift+Tab / E** jump to your next stack that can still act.
- **Spent stacks are obvious:** a stack with nothing left to move or fire is faded with a "z" badge.
- **Blueprint orders are light blue:** routes, plus a dashed ring under every queued stack. Blueprint mode no longer draws units twice while other players' moves animate.
- **🌊 Rivers are full water hexes,** flowing toward the sea, instead of a thin line. They still keep their land rules: ford for 2 move, +1 defence. HQs and towns never sit in one.
- **🛣 Roads** link your buildings back to your HQ through your own land, and break when land is captured or cut off.
- **The world-event box** is bright and colour-coded, and pulses when a new event starts.
- **Every vehicle and aircraft looks like a real machine:** Seraph is an AC-130 gunship, Valkyrie a V-22 Osprey, Warden an E-2 Hawkeye, Scorpion a Gepard, Basilisk a HIMARS, Wraith an LCAC hovercraft, Goliath a Sturmtiger, Titan a Ratte.
- **Spam-click to reveal:** a click during a card flip finishes it, and the next flips play at triple speed (resupply, crates and the draft).
- **Fixes:** the crate sunburst stays centred instead of flying off with the chest, dice settle faster, the lobby no longer clips faction names or the LOCAL PLAYER button, and the WAREHOUSE label fits its slot.

**New cards**
- **Anti-air at every level:** Stinger team (Common, +3 AA chips), Scorpion (Uncommon, +4), Skyguard (Rare, +6), and the **Sentinel** SAM battery (Epic), which shoots down aircraft up to 3 hexes away.
- **Airstrikes at every level:** **Gun Run** (Common, kills 1 on a 3+), Airstrike (Uncommon), **Precision Strike** (Rare: always kills the strongest unit and ignores Flak), and **Bunker Buster** (Epic: knocks 2 levels off fortifications and kills up to 2).

**Balance**
- **✈ The aircraft nerf is universal:** every aircraft, gunships included, takes only the hex it lands on. Valkyrie and Seraph get a **Strafing Run** instead (+2 mult attacking ground targets).
- **💰 The economy can't run away:** the Market is now the **Warehouse**, a flat +$2 per level (+$3 next to a resource, Refinery or Port), instead of a trade network that grew quadratically. Refineries pay +$1 per level (+$3 on a resource). Building income pays in full up to $8, half up to $24 and a quarter beyond. Total income past $50 counts at two-thirds. In test games the richest bot dropped from **$1,106 a turn** to about $125.
- **🤝 Alliances last 5 rounds.** In the last 2 rounds both sides can press **RENEW** to extend them 5 more. If either doesn't, the pact lapses peacefully, with no traitor penalty. In Conquest and World War, **allied land counts together**, so allies can win together.
- **🧠 Smarter bots:** each bot picks a war target (whoever betrayed it, the runaway leader, or the weakest neighbour) and pushes that front. Bots mass troops before attacking, reinforce threatened bases first, and buy counters: anti-air against air, tank hunters against armour, siege units against forts. Traitors plan their betrayals: they move a strike force onto the ally's border first and break only when the knife is in reach. They also renew pacts that still pay.
- **🌫 Fog of war fix:** moving into the fog no longer fails when something hidden is in the way. Your troops follow the route as far as it goes, or run into an ambush.

**New map layouts:** Rings, Spiral Galaxy, Shattered Plates, Maze, Mirror and Lattice: bold, abstract shapes alongside the classic continents.

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

