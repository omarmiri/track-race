# Track Race Architecture (Current)

## Overview
`track-race/` is a modular browser game built as ES modules loaded from `index.html`.

Current core behavior:
- 400m one-lap oval race with 6 lanes (player + 5 AI).
- Tap-driven running with stamina curve, fatigue, recovery, turbo, and lane-staggered starts.
- Character selection, pre-race setup modal, in-race HUD, and results modal with podium + best times.
- Supabase-backed score storage with local fallback.

## Directory Layout
- `track-race/index.html`: DOM structure, third-party scripts, modal scaffolding, control buttons.
- `track-race/css/game.css`: layout, animations, responsive rules, control/button states.
- `track-race/js/`
  - `main.js`: bootstrap, modal orchestration, UI wiring, race lifecycle hooks.
  - `game.js`: track geometry, game state, simulation loop, physics/stamina/turbo logic.
  - `input.js`: keyboard/touch/gamepad input and mobile viewport gesture guards.
  - `characters.js`: character definitions and sprite/emoji rendering helpers.
  - `crowd.js`: crowd strip animation and multi-banner text overlays.
  - `ui.js`: timer/turbo/stamina HUD updates.
  - `highscores.js`: Supabase + local scores, modal/results score rendering.
  - `config.js`, `speed.js`: tunable constants and device speed multiplier.
- `track-race/assets/images/`: runner sprites + bleachers sheet.
- `track-race/levels/`: reserved.

## Runtime Flow
1. `index.html` loads CDN scripts (GA, Supabase, Tailwind), CSS, and `js/main.js`.
2. `main.js:init()` runs on `DOMContentLoaded`.
3. Character modal opens first (`#character-modal`).
4. After character pick, pre-race modal (`#game-modal`) opens:
   - player chooses race perk (`+Speed` or `Turbo 4s CD`).
5. Start race:
   - `setPlayerRacePerk(...)` in `game.js`.
   - `startGame()` resets state, computes geometry, starts RAF loop.
6. Per-frame:
   - `gameLoop()` steps simulation and updates HUD/render/camera.
7. Finish:
   - `endGame(...)` dispatches `raceFinished` event.
8. `main.js` receives `raceFinished`:
   - saves score,
   - renders podium and best-times panel,
   - opens results modal.

## Main UI Layers
- Top HUD (`#top-bar`): back/scores/change buttons, timer, stamina bar, turbo status.
- Character modal (`#character-modal`): character picker grid.
- Game modal (`#game-modal`):
  - pre-race state,
  - results state,
  - race perk selector,
  - start/race-again/change-character actions.
- Track scene (`#track-area > #track-world`): crowd, track, infield, finish line, runners.
- Mobile controls (`#btn-run`, `#btn-turbo`) with pressed visual states.
- High-score modal (`#highscores-modal`).

## Game Simulation (`game.js`)
### Track + Camera
- Track is generated procedurally from viewport (`computeTrackGeometry`).
- 6 lanes with dynamic lane lines and staggered start markers.
- Runner placement uses parametric oval progress (`getPointOnTrack`).
- Camera follows player after start threshold.

### Race State
- Player + AI state includes:
  - position, speed,
  - turbo readiness/active windows,
  - stamina, extra fatigue, second wind,
  - tap cadence and short run-boost window.
- AI runners are instantiated as:
  - main CPU (`#computer`) + 4 extra CPU DOM runners.

### Pace/Stamina Model
- Baseline stamina: 0m->400m piecewise curve (`STAMINA_CURVE_POINTS`).
- Tap input creates short acceleration pulses and adds fatigue tax.
- Fatigue cap grows with distance; steady pacing can recover some fatigue.
- Speed target by race phase:
  - accel zone,
  - peak zone,
  - controlled middle,
  - late-race fade.
- AI styles (slight cadence variation only):
  - `steady`, `fast-start`, `strong-finish`.

### Perks
`setPlayerRacePerk(perk)` supports:
- `speed`: slight player accel/max-speed multipliers.
- `turbo`: player turbo cooldown reduced to `4000ms`.

CPU always uses base tuning (no player perk bonuses).

### Turbo + Banana
- Turbo:
  - boosts speed via time-limited bonus,
  - updates turbo HUD countdown,
  - player cooldown depends on selected perk.
- Banana peel:
  - optional hazard dropped ahead of player,
  - AI can slip and slow temporarily.

## Input System (`input.js`)
- Keyboard:
  - `Space` => run tap (repeat suppressed),
  - `G` => turbo,
  - `B` => banana.
- Mobile buttons:
  - pointer/touch handlers prevent default zoom/scroll,
  - visual pressed class (`.is-pressed`) while active.
- Mobile viewport lock:
  - disables gesture zoom/double tap,
  - tracks dynamic viewport height CSS var.
- Gamepad:
  - A = run, X/RT = turbo,
  - polling loop with modal-aware gating.

## Character Rendering (`characters.js`)
- `characters` map mixes emoji and sprite-sheet characters.
- `updateRunnerAppearance(...)` attaches selected character to runner DOM.
- `renderCharacterThumbnail(...)` renders modal/podium previews.

## Crowd System (`crowd.js`)
- Animates 3-frame bleachers sprite sheet on interval.
- Creates per-tile banner overlays so repeated banners each get centered text.
- `updateCrowdSignText(...)` updates all visible banners (e.g., `GO <CHARACTER>`).

## Scores + Persistence (`highscores.js`)
- Supabase client from global CDN (`window.supabase`).
- Visitor ID from a locally generated ID stored on the device/browser (`window.visitorId`).
- Writes to `high_scores` table with event-specific `game_name` values:
  - `track-race-400m-dash`
  - `track-race-400m-hurdles`
- Reads personal/global top scores.
- Offline/error fallback uses event-specific localStorage keys:
  - `track-race-400m-dash:personal-scores`
  - `track-race-400m-hurdles:personal-scores`
- Results modal supports Personal/Global toggle.

## External Integrations
Loaded in `index.html`:
- Google Analytics (`gtag`).
- A first-party locally generated visitor ID for score ownership.
- Supabase JS CDN.
- Tailwind CDN (utility styling still used).

## Key Custom Events
- `raceFinished` (dispatched by `game.js`, consumed by `main.js`):
  - `timeMs`, `winner`, `playerFinished`, `standings`.

## Notes for Future Changes
- Keep DOM IDs stable: modules directly query by ID.
- `game.js` owns authoritative race state; UI modules should not mutate physics state.
- If adding perks/rules, route through `setPlayerRacePerk(...)` + `configureRaceTuning()`.
- If adding new crowd banners, update `crowd.js` tile overlay logic rather than hardcoded single overlay.

