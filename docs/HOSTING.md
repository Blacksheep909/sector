# Hosting SECTOR online

SECTOR is a single Node.js process (`server.js`) with no dependencies. Players only need a browser, and all game traffic is HTTP plus one WebSocket on the same port. That makes it easy to put online: anything that can run Node, or forward a web port, works.

## Rooms: many wars on one server

One server runs any number of **rooms**, each with its own lobby and war. Rooms share nothing but player profiles.

- **PLAY** (quick play) drops you into a **public room** that's filling up, or opens a new one. Whoever opens a public room hosts it: they start from the standard settings (Domination, fog on, a 60-second turn clock), can change them, and press DEPLOY when they're ready; bots fill the empty seats (at least 4 commanders). Anyone else pressing PLAY lands in it until it deploys (up to 6 people). Public wars have no ready-up, no shared-screen players and no missions, and aren't saved.
- **＋ PRIVATE ROOM** opens a room with a 5-letter code. You're the host with every setting. Share the code, or the invite link `https://your-address/?room=CODE`.
- **Parties:** friends group up on the front menu (invite link `/?party=CODE`). When the leader presses PLAY or opens a private room, everyone in the party who's on the front menu comes along.
- **The LAN lobby** (`MAIN`) is the classic one-lobby server: on a LAN server the front menu shows **JOIN THE LAN LOBBY**, and older clients land there too.
- Empty rooms close by themselves: after 90 seconds in the lobby, or 5 minutes for a private war in progress, which is saved first so its host can resume it.


## Going to playsector.io

The server is already shaped for it: each room is a self-contained unit (`createRoom` in `server.js`), and the only shared state is profiles. Two ways to get there, in order:

**Step 1: one Node server behind Cloudflare (works today).**

1. Run SECTOR in public mode (below) on any always-on host: a small VPS, Fly.io, Railway or Render.
2. Add `playsector.io` to a Cloudflare account. Point the DNS at the server with the **proxy on** (orange cloud), or use a named **Cloudflare Tunnel** to the server so no port is open at all.
3. Cloudflare supplies `https`, and the game switches to `wss://` by itself. WebSockets pass through Cloudflare's proxy with no extra setup.
4. Set `SECTOR_PROFILES` to a path on persistent storage so profiles survive restarts.

One process like this comfortably holds many small wars. Scale it up before scaling out.

**Step 2: Cloudflare Workers and Durable Objects (when one server isn't enough).**

- Each **room becomes a Durable Object**: `createRoom()` maps onto it almost one to one, and its timers become DO alarms or in-object timeouts.
- The **router** (`route()`: quick play, codes, parties) becomes a Worker in front, plus one small Durable Object for matchmaking and parties.
- **Profiles** move from `profiles.json` to D1 or KV, and the hand-rolled WebSocket code is replaced by the Workers WebSocket API (with hibernation).
- Static files (`public/`, `shared/`) are served as Worker assets.

**Before opening it to the public:** set up accounts (below), rate limits on joins and chat, a chat filter, and backups of profile data.

## Accounts: sign in with Google and Discord

Players can save their commander (Valor, skins, factions, record) to a Google or Discord login, then sign in on any device to get it back. Without accounts set up, a commander lives in the browser that made it.

Each provider switches on by itself once its two keys are set; the sign-in buttons only appear for the ones that are.

| Variable | What it is |
|---|---|
| `SECTOR_URL` | The game's public address, like `https://playsector.io`. Logins come back to `SECTOR_URL/auth/<provider>/callback`. If unset, the address the player used is used (fine on one machine; set it online). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From a Google OAuth client. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | From a Discord application. |
| `SECTOR_PROFILES` | Where profiles (and their linked logins) are saved. Put it on persistent storage. |
| `SECTOR_START_VALOR` | Valor every commander is given once, new or existing. **30000 for now while the store is tested**; set it to `0` before going live. |

**Google:** in [Google Cloud Console](https://console.cloud.google.com/), create a project, set up the **OAuth consent screen** (External, app name SECTOR, scopes `openid`, `email`, `profile`), then **Credentials → Create credentials → OAuth client ID → Web application**. Add the authorised redirect URI `https://playsector.io/auth/google/callback` (and `http://localhost:3000/auth/google/callback` to test on your own PC). Copy the client ID and secret.

**Discord:** in the [Discord Developer Portal](https://discord.com/developers/applications), create an application, open **OAuth2**, add the redirect `https://playsector.io/auth/discord/callback` (and the localhost one to test), and copy the client ID and secret (**Reset Secret** shows it).

How it works: the player is sent to Google or Discord, approves, and comes back with a one-time code. The server swaps that (with your app's secret) for the player's account ID, name and email, and links it to their commander. The server never sees a password. If that login already has a commander, the browser switches to it; otherwise the commander they're playing is saved to the login. Signing out starts a fresh guest commander in that browser, and signing in again brings the saved one back.

Keep the client secrets secret: set them as environment variables (or your host's secrets), never in the repository. `SECTOR_AUTH_MOCK=1` adds a fake "Test login" for automated tests; never turn it on for a real server.

## Public mode

Whenever the server is reachable from the internet, start it in **public mode**:

```bash
npm run start:public
```

(or `node server.js --public`, or set `SECTOR_PUBLIC=1`). Public mode:

- switches off the host panel (`/host`: stop server, updates, logs),
- never advertises the machine's private network addresses (no "friends on your network join at" list, nothing in `/info`),
- doesn't try to open a browser, and logs plain text instead of drawing the console dashboard.

Even without public mode, the host panel refuses any request that came through a tunnel or proxy, so a tunnel can't expose it by accident.

## Option 1: play from your own PC through a tunnel (free, hides your IP)

A tunnel gives friends a public `https://` address that relays to SECTOR on your PC. Nobody learns your home IP, and you don't touch your router.

**Cloudflare quick tunnel** (no account needed):

1. Install `cloudflared` (Cloudflare's tunnel client).
2. Start SECTOR (`Sector.exe`, or `npm start`).
3. Run: `cloudflared tunnel --url http://localhost:3000`
4. It prints a `https://something.trycloudflare.com` address. Send that to your friends.

The address changes every time. For a permanent address on your own domain, create a named tunnel in a free Cloudflare account. WebSockets work through Cloudflare tunnels with no extra setup.

**Tailscale** is the private alternative: everyone installs Tailscale and joins your tailnet, then opens `http://<your-tailscale-name>:3000`. Nothing is exposed to the internet at all.

## Option 2: an always-on cloud server

Use this when you want the game up without your PC on.

| Host | Cost (check current pricing) | Notes |
|---|---|---|
| **Render** (web service) | Free tier | Sleeps after ~15 idle minutes and takes about a minute to wake, which drops anyone connected. Fine for planned game nights. Start command: `npm run start:public`. |
| **Koyeb** | Free tier (1 small instance) | Deploy from the GitHub repo with the included `Dockerfile`. |
| **Fly.io** | Paid (no ongoing free tier) | Uses the `Dockerfile`. Small machines cost a few dollars a month and stay awake. |
| **Railway** | Usage-based after a trial | Deploy from GitHub; set the start command to `npm run start:public`. |
| **A small VPS** (Hetzner, DigitalOcean, Oracle Cloud's free tier, ...) | ~$0–5 / month | Full control. Run `docker build -t sector . && docker run -d -p 80:3000 sector`, or install Node and run `npm run start:public` under a process manager. Put it behind Cloudflare or Caddy for `https`. |

All of them set `PORT` themselves, and SECTOR reads it. The `Dockerfile` already turns public mode on.

### Things to know before hosting publicly

- **Anyone with the address can press PLAY** and join a public war. Private rooms need their code, so share codes only with the people you want to play.
- **Free tiers sleep.** A sleeping server restarts fresh, and any game in progress is lost (games live in memory).
- **No accounts or passwords:** players reconnect with a token stored in their browser.

## Ports and protocols

| What | Value |
|---|---|
| Port | `PORT` env var, default `3000` (if busy, it tries the next 10 locally) |
| Protocols | HTTP and WebSocket on that one port (no UDP) |
| Health check | `GET /info` returns JSON |
