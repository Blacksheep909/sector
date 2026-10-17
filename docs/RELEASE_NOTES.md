## ⬇ How to play

1. Download **`Sector.exe`** below.
2. Double-click it. The game opens in its own window (Edge/Chrome app mode), and a small console window runs the server.
3. Friends on the **same Wi-Fi / LAN** either run `Sector.exe` themselves and use **Join a game → Scan network**, or type the *"Same network"* address shown in the console into any browser.

> The first launch asks for network access: tick **Private networks**. SmartScreen may warn that the exe is unsigned: click *More info → Run anyway*.

## What's new in v0.3

- **Game window.** The exe now opens SECTOR in its own app window instead of a browser tab.
- **Host / Join panel.** Scan your network for games, join by address, or pick a recent server.
- **Esc menu.** Resume, rules, card index, sound, and **leave the game**. A bot takes your seat so the match carries on. The host can end the game for everyone.
- **Building upgrades.** Build the same structure on a hex again to stack it up to ★★★. That includes **fortifying your HQ**.
- **Bigger, clearer build bar.** Labelled tiles, a red price when you're short, and an ▲ badge when something can be upgraded.
- **Pass and play.** The "pass the device" screen now appears only when a local player actually has to act, and hands are hidden during bot turns.
- **Reveal fixes.** No more duplicate "reveal" bars. Epic and Legendary cards fly to the true centre. Background beams fill any screen size.
- **Performance.** The resupply menu runs at full frame rate: the board pauses under overlays, and there's no more full-screen blur or blending.
- **Space.** It only flips cards and throws dice. It never ends your turn.

## The game

SECTOR is a turn-based hex conquest game for 2–6 players, built around:

- procedural maps
- an opening draft
- Resupply picks
- Supply Drop slot machines
- chips × mult dice combat
- navy and bridges
- supply lines and trading
- five factions
- bots on four difficulties

Full rules: [docs/RULES.md](https://github.com/Blacksheep909/sector/blob/main/docs/RULES.md)

`Sector-source.zip` holds the source if you'd rather run `node server.js` on any OS (Node 22+, no dependencies).
