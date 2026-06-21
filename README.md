# Streamer Economy War — Setup Guide

Two pieces:

1. **`streamer-economy-war/`** — the browser game (host free on GitHub Pages)
2. **`discord-bot/`** — a Discord bot that posts random events/polls, pins them, and enforces one vote per person

They optionally talk to each other through the same Firebase Realtime Database.

---

## 1. Firebase setup (do this first — both pieces need it)

1. Go to https://console.firebase.google.com → **Add project** (free tier is plenty).
2. In the left sidebar: **Build → Realtime Database → Create Database**.
   - Pick a region close to you.
   - Start in **test mode** for a quick one-off stream event (anyone can read/write — fine for a casual game). For anything public long-term, lock it down (see "Securing it" below).
3. Go to **Project settings (gear icon) → General → Your apps → Web app (`</>`)**. Register an app (no hosting needed). Copy the `firebaseConfig` object it gives you.
4. Paste those values into `streamer-economy-war/firebase-config.js`, replacing the placeholders.
5. Note your **databaseURL** (looks like `https://your-project-default-rtdb.firebaseio.com`) — you'll need it for the bot's `.env` too if you want them synced.

### Securing it (optional but recommended if public)
Realtime Database → Rules, replace with something like:
```json
{
  "rules": {
    ".read": true,
    ".write": true,
    "game": { ".write": true },
    "poll": { ".write": true }
  }
}
```
For a single livestream event, test-mode rules (open for ~24 hrs) are usually fine — just don't leave it open forever.

---

## 2. The web game

### Run locally
Just open `streamer-economy-war/index.html` in a browser. No build step — it's plain HTML/JS using Firebase's CDN SDK.

### Deploy free on GitHub Pages
1. Create a new GitHub repo, push the contents of `streamer-economy-war/` to it.
2. Repo → **Settings → Pages → Source: Deploy from branch → main / root**.
3. Your game is live at `https://yourusername.github.io/your-repo/`.

### How people use it
- **Admin tab**: enter the password from `ADMIN_PASSWORD` in `firebase-config.js`, set a streamer code (e.g. `NINJA2026`), start the game timer. Toggle **🔥 Auto Events: ON** to have random events/polls fire automatically every 1.5–4 minutes (tunable in `firebase-config.js` via `MIN_EVENT_SECONDS`/`MAX_EVENT_SECONDS`) for as long as that admin tab stays open. You can also fire any event or poll manually on demand.
- **Join tab**: streamers enter the code + their name to create their player.
- **Player tab**: a sticky HUD up top always shows your name, cash, the countdown timer, and your **net worth** (top right, large and gold so it's never hidden). Below that:
  - **Buy businesses** and collect their income.
  - **Invest** in crypto/stocks/bonds and cash out anytime.
  - **Player Actions** — this is the "action-packed" layer:
    - 🎲 **Risk It** — gamble any amount of your cash, 50/50 double-or-nothing.
    - 🦹 **Sabotage** — attempt to steal cash from a random rival; if you get caught you pay a fine.
    - 🧠 **Trivia Rush** — answer a quick question for a cash bonus.
    - 🤝 **Send Cash** — gift money to a specific rival (form alliances, then betray them later for drama/clips).
  - All actions have short cooldowns (shown live) so people can't spam them.
- **Viewer Vote tab**: whenever an automatic or manual poll fires, anyone watching can vote (one vote per browser). A live ticker banner up top announces every event, win, steal, and poll result in real time across all tabs.
- **Leaderboard**: live everywhere, sorted by net worth (cash + business value + investment value).

### Tuning the economy
Edit `firebase-config.js`:
- `STARTING_CASH`
- `BUSINESSES` (cost / income per minute)
- `INVESTMENTS` (risk labels)
- `ACTIONS` (cooldowns for Risk/Sabotage/Trivia/Gift), `STEAL_AMOUNT`, `STEAL_FAIL_FINE`, `STEAL_SUCCESS_CHANCE`, `TRIVIA_BONUS`, `TRIVIA_QUESTIONS`
- `DIRECT_EVENTS` / `POLL_EVENTS` and `MIN_EVENT_SECONDS` / `MAX_EVENT_SECONDS` for the auto-event engine

---

## 3. The Discord bot

This posts random events to a channel, **pins** them, and only counts the **first** numeric reply (`1`, `2`, `3`, `4`...) per user as their vote. After the timer it tallies votes, announces the winner, and unpins.

### Create the bot
1. https://discord.com/developers/applications → **New Application** → **Bot** tab → **Add Bot**.
2. Under **Privileged Gateway Intents**, enable **Message Content Intent** (required to read vote replies).
3. Copy the bot **Token**.
4. **OAuth2 → URL Generator**: scopes `bot`, permissions `Send Messages`, `Read Message History`, `Manage Messages` (needed to pin/unpin), `Add Reactions`. Open the generated URL to invite it to your server.
5. In Discord, enable **Developer Mode** (User Settings → Advanced), right-click your event channel → **Copy Channel ID**.

### Configure
```
cd discord-bot
cp .env.example .env
```
Fill in `.env`:
- `DISCORD_TOKEN` — from step 3 above
- `EVENT_CHANNEL_ID` — from step 5 above
- `MIN_INTERVAL_MINUTES` / `MAX_INTERVAL_MINUTES` — how often random events fire (matches the "every 5–10 minutes" spec by default)
- `VOTE_DURATION_SECONDS` — how long a poll stays open
- `FIREBASE_DB_URL` / `FIREBASE_DB_SECRET` — optional. If set, poll/event outcomes automatically update player cash/investments in the same database the web game reads — no admin click needed. Leave blank to run Discord-only (you trigger the matching effect manually from the Admin tab instead).

### Run it
```
npm install
npm start
```
Keep it running anywhere that stays online during your stream (your PC, a Raspberry Pi, Railway/Render free tier, etc.).

### What it does
- Every 5–10 min (configurable), it either:
  - **Fires a direct event** (Government Grant, Market Crash, Tech Boom) — announced immediately, no vote.
  - **Starts a poll** (disaster type, crypto up/down, who gets the bonus) — pins the message, viewers type a number, bot reacts ✅ to the first vote and ❌ if someone tries to vote twice.
- After the vote window, it posts results, picks the winner (random tiebreak), unpins the original poll, and — if Firebase is configured — applies the effect to all players automatically.

### Customizing events
Edit the `DIRECT_EVENTS` and `POLL_EVENTS` arrays at the top of `discord-bot/index.js` to add/remove event types or change percentages.

---

## Quick mental model

```
Players:    cash, businesses, investments  → stored in Firebase /players
Viewers:    vote on events                  → /poll (web) and Discord chat (bot)
Admin:      start round, trigger events,
            end game, declare winner        → web Admin tab
Winner:     highest net worth when the
            timer runs out                  → cash + business value + investment value
```
