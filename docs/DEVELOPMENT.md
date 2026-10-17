# Development

## Layout

```
server.js            HTTP + hand-rolled WebSocket server (no dependencies): lobby, game, bots, timers.
                     When packaged as Sector.exe it serves the client from embedded assets.
shared/engine.js     All game rules. Runs on the server (authoritative) and in the browser
                     (move previews, combat odds, Blueprint simulation).
shared/bot.js        Heuristic AI: drafting, economy, naval play, attacks, trade replies, difficulty.
public/index.html    Page shell.
public/main.js       Client: networking, lobby, HUD, deck/build bars, combat + dice tray, trading,
                     Blueprint, pass & play, event animations.
public/cards.js      Card faces, resupply menu, Supply Drop crates + reel, opening draft, deck-replace picker,
                     hover-to-enlarge, card index, rarity-based reveal animations.
public/render.js     2.5D canvas board: tilted hex prisms, territory borders, units, particles, camera.
public/art.js        Procedural vector art for units, tactics, structures, factions, and card illustrations.
public/audio.js      Synthesized sound effects (WebAudio).
public/style.css     UI styling and animation.
tools/sim.js         Headless bot-vs-bot games: node tools/sim.js <mode> <players> <games>
tools/maps.js        ASCII preview of every map archetype: node tools/maps.js 4
tools/gen-cards.js   Regenerates docs/CARDS.md from the engine data.
tools/build-exe.js   Builds dist/Sector.exe (Node single-executable application).
tools/cdp.js         Tiny headless Edge/Chrome driver over the DevTools protocol (no deps).
tools/screenshots.js Plays a scripted game and saves the README screenshots to docs/img.
tools/e2e-pass.js    End-to-end pass & play test: two local humans plus a bot, through the draft and first turn.
```

## How a turn flows

1. A client sends `{t:'act', action}` over the WebSocket.
2. The server runs `engine.applyAction(state, playerId, action)`. That returns `{ok, events}` or an error.
3. The server broadcasts `{t:'state', state: engine.view(state, viewer), events}` to every client. `view()` hides other players' hands and the active player's draft offer.
4. Each client plays the events as animations (moves, captures, combat, …), then swaps in the new state.

Bots run on the server through the same `applyAction` path, one action at a time, with delays so humans can watch.

## Testing

```
node tools/sim.js domination 4 10   # 10 four-bot games; reports failed actions and winners
node tools/maps.js 4                # eyeball map generation

# browser tests (headless Edge; pass a Chrome path as the first argument to use Chrome instead)
PORT=3011 SECTOR_NO_OPEN=1 node server.js &      # fresh server
node tools/e2e-pass.js
PORT=3010 SECTOR_DEV=1 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js &
node tools/screenshots.js
```

In the browser console, `Cards.demoReveal(['grunt','valkyrie','seraph'])` stages a reveal so you can tune the flip animations.

Run the server with `SECTOR_DEV=1` to enable autoplay. A client can then send `{t:'autoplay', on:true}`, and the bot AI plays that seat. This is handy for watching long games and animations.

## Environment variables

| Variable | Effect |
|---|---|
| `PORT` | Port to listen on (default 3000). If it's taken, the server tries the next 10 ports. |
| `SECTOR_DEV=1` | Enables autoplay. |
| `SECTOR_FAST=1` | Bots act about 4× faster, for tests. |
| `SECTOR_OPEN=1` | Opens the browser on start. This is always on for the exe. |
| `SECTOR_NO_OPEN=1` | Never opens the browser. |
