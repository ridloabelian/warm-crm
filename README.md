# Warm CRM

A local-first, offline-capable personal relationship companion that helps you stay genuinely connected with close friends and family in real life — with a warm notebook aesthetic, local SQLite ownership, and zero creepy scraping or cloud telemetry.

---

## Philosophy

- **100% Local & Private**: Every circle, person, memory, and life date lives in a single SQLite file on your machine (`./data/warm-crm.db` by default). There is no cloud sync, no account login, and no external network call or telemetry.
- **Anti-Guilt Weekly Ritual**: Instead of an endless red backlog of overdue contacts, Warm CRM surfaces at most **3 people per week** sorted by warmth decay relative to their circle cadence.
- **Real-Life Focus**: Low-pressure IRL activity ideas and human conversation starters tailored to shared interests and neighborhoods — never auto-sent robotic messages.
- **True Data Ownership**: 1-click full export and restore in **JSON**, **Spreadsheet CSV**, or raw **SQLite (`.sqlite`)**.

---

## Tech Stack

- **Backend**: TypeScript + [Hono](https://hono.dev/) + `@hono/node-server` + SQLite (`better-sqlite3`)
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + Lucide icons
- **Desktop Packaging**: Ready for [Tauri v2](https://tauri.app/) (`src-tauri/tauri.conf.json`)
- **Testing**: `vitest` (unit + API + backup roundtrip suites)

---

## Quick Start

```bash
npm install
npm start
```

Open **http://127.0.0.1:3333** in your browser.

On first launch, `npm start` builds the client bundle if needed, creates `./data/warm-crm.db`, and seeds optional realistic sample friends & family so you can explore the Weekly Ritual right away. You can remove the sample data in one click from the top banner or the **Data Ownership** tab without touching any people you've added yourself.

### Useful Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Build client if needed and launch the local server at `http://127.0.0.1:3333` |
| `npm run dev` | Start single-port local dev server (Hono `/api/*` + Vite HMR) |
| `npm run build` | Build production client (`dist/client/`) and compile server (`dist/server/`) |
| `npm run serve` | Run the compiled production server (`node dist/server/index.js`) |
| `npm run typecheck` | Typecheck both client and server TypeScript projects |
| `npm test` | Run all Vitest unit and API integration tests |

---

## Core MVP Features

1. **Intentional Circles & Custom Cadence**
   - Default Dunbar-inspired circles: **Inner 5** (14d), **Close 15** (30d), **Extended 50** (90d), and **Family** (21d).
   - Click any circle's cadence to customize its catch-up rhythm, or set a per-person cadence override.

2. **Warm Weekly Ritual ("Who to Reach Out To")**
   - Surfaces up to **3 overdue people** sorted by warmth decay and upcoming life dates.
   - Displays the thread from your last catch-up (e.g., *"Last met for coffee at Heart Roasters Oct 12 — talked about her new pottery studio and dad's surgery"*), upcoming life dates, and a gentle **Snooze 1w** option.

3. **Low-Pressure IRL Meetup Prompts**
   - Generates grounded meetup ideas (neighborhood coffee, park walk, weeknight noodles, Sunday walk-and-talk phone call) using shared interests, city/neighborhood, and open follow-up threads.
   - Includes copyable human reach-out starters — ideas only, never auto-sent.

4. **Keyboard-First Quick Log (`Cmd+K` / `Ctrl+K`)**
   - Type naturally in under 10 seconds:
     - `Had dinner with Arif — he's moving apartments next month`
     - `Met Maya at Heart Coffee Oct 12 — talked about her new pottery studio`
     - `Called Auntie Elena yesterday: visiting next month; follow up: bake pandan cake`
   - Automatically matches existing people (or offers 1-click inline creation), extracts activity kind, date, venue, summary, and follow-up thread.

5. **1-Click JSON / CSV / SQLite Backup & Restore**
   - Export or restore your complete database as `.json`, `.csv` (compatible with Excel/Numbers while preserving full history), or a clean standalone `.sqlite` file generated via SQLite `VACUUM INTO`.

---

## Configuration & Tauri Desktop Packaging

### Environment Variables

- `PORT` (default `3333`) — Local HTTP port
- `HOST` (default `127.0.0.1`) — Bind address (loopback by default for privacy)
- `WARM_CRM_DB_PATH` (default `./data/warm-crm.db`) — Path to your local SQLite database file
- `WARM_CRM_NO_INITIAL_SAMPLE` (`1` to start with a blank slate on first run)

### Desktop Readiness (Tauri v2)

`src-tauri/tauri.conf.json` configures Warm CRM for desktop packaging (`dist/client` frontend bundle + `http://127.0.0.1:3333` dev URL + loopback-only CSP). In a Tauri desktop wrapper, point `WARM_CRM_DB_PATH` to the OS app data directory and launch `dist/server/index.js` as a local sidecar.
