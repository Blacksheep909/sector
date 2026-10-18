# Hosting SECTOR online

SECTOR is a single Node.js process (`server.js`) with no dependencies. Players only need a browser, and all game traffic is HTTP plus one WebSocket on the same port. That makes it easy to put online: anything that can run Node, or forward a web port, works.

> **One game per server.** A server runs one lobby and one game at a time, and the first person to join becomes host. That's ideal for playing with friends; a public "anyone can join" service would need rooms (planned).

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

- **Anyone with the address can join the lobby**, and the first to join is the host. Share the address only with the people you want to play.
- **Free tiers sleep.** A sleeping server restarts fresh, and any game in progress is lost (games live in memory).
- **No accounts or passwords:** players reconnect with a token stored in their browser.

## Ports and protocols

| What | Value |
|---|---|
| Port | `PORT` env var, default `3000` (if busy, it tries the next 10 locally) |
| Protocols | HTTP and WebSocket on that one port (no UDP) |
| Health check | `GET /info` returns JSON |
