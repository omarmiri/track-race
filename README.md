# Track Race

Track Race is a fast, arcade-style 400m browser racing game built with plain HTML/CSS/JavaScript ES modules.
You race against 5 AI runners, manage stamina, trigger turbo at the right moment, and chase top leaderboard times.

## Features

- 1-lap (400m) oval track with 6 lanes and staggered lane starts.
- Tap-driven running model with cadence, fatigue, recovery, and late-race fade.
- Playable characters (emoji + sprite-sheet racers) with a character picker.
- Race perks before each run:
  - `+Speed`
  - `Turbo 4s CD`
- Turbo system, stamina HUD, and optional banana peel hazard (`B` key).
- Animated crowd + dynamic banner text.
- Results modal with podium standings and best-time panels.
- Supabase-backed scores with localStorage offline fallback.

## Controls

| Action | Keyboard | Mobile | Gamepad |
|---|---|---|---|
| Run | `Space` (tap rhythm) | `Run` button | `A` |
| Turbo | `G` | `Turbo` button | `X` or `RT` |
| Banana Peel | `B` | N/A | N/A |

## Tech Stack

- Vanilla JavaScript (ES modules)
- HTML + Tailwind utility classes
- Custom CSS animations/layout
- Supabase JS client (CDN)
- FingerprintJS (visitor identity)
- Google Analytics (`gtag`)

## Project Structure

```text
track-race/
  assets/
    images/
      backgrounds/
      sprites/
  css/
    game.css
  js/
    main.js         # app bootstrap + modal/race flow wiring
    game.js         # race simulation, AI, stamina/turbo, standings
    input.js        # keyboard/touch/mobile/gamepad input
    highscores.js   # Supabase + local fallback score storage
    characters.js   # racer definitions + rendering helpers
    crowd.js        # crowd animation + rotating sign text
    ui.js           # timer/stamina/turbo HUD updates
    config.js       # core constants
    speed.js        # device-based speed multiplier tuning
  architecture.md   # detailed architecture notes
  index.html
```

## Run Locally

Because the app uses ES modules, serve it over HTTP (do not open `index.html` with `file://`).

### Option 1: Python

```powershell
cd "C:\Dev\Opal Games\track-race"
python -m http.server 8080
```

Open `http://localhost:8080`.

### Option 2: Node (serve)

```powershell
cd "C:\Dev\Opal Games\track-race"
npx serve .
```

## High Scores and Data

`index.html` currently loads Supabase and sets:

- `window.SUPABASE_URL`
- `window.SUPABASE_ANON_KEY`

`js/highscores.js` writes/read scores from:

- Table: `high_scores`
- Visitor table: `visitors`
- Game keys:
  - `track-race-400m-dash`
  - `track-race-400m-hurdles`
- Local fallback keys:
  - `track-race-400m-dash:personal-scores`
  - `track-race-400m-hurdles:personal-scores`

If Supabase is unreachable, personal scores still work locally via `localStorage`.

## Gameplay Notes

- Fast tapping helps early acceleration but increases fatigue.
- Consistent pacing improves recovery versus over-spiking cadence.
- Turbo timing is critical in the final stretch.
- AI racers use style profiles (`steady`, `fast-start`, `strong-finish`) for pace variation.

## Deployment

This is a static site and can be deployed to any static host (GitHub Pages, Netlify, Vercel static output, S3/CloudFront, etc.).

Before production deploy:

1. Confirm Supabase tables and RLS policies are configured.
2. Replace/verify analytics and tracking IDs.
3. Keep API keys at least anon/public-scoped only.

## Development Reference

For deeper engine notes and runtime flow, see [architecture.md](./architecture.md).
