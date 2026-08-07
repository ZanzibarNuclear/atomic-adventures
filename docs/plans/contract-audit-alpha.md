# Contract audit — alpha release (2026-08-06)

**Status:** Audit complete; high-priority contracts updated same day  
**Scope:** `docs/contracts/*` vs playable `game/` runtime

## Method

Cross-checked contracts against save/play UI, wellbeing, maps/doors, story arcs,
milestones, time, fixtures, hydro/console, and feature-gaps. Prefer **code +
SQLite content** over stale “limitations” lists when they disagree.

## Punchlist — contracts updated this pass

| Document | What changed |
| --- | --- |
| [play-modes-and-story-mode.md](../contracts/play-modes-and-story-mode.md) | Multi-slot save lifecycle; title always Story; story shape includes arc completion fields; open-world chooser marked deferred |
| [hex-crawling.md](../contracts/hex-crawling.md) | Multi-hop BFS/time; openings on routes + known multi-hop; code map |
| [indoor-stands.md](../contracts/indoor-stands.md) | Room-graph free travel; locked always blocks multi-hop; exterior key rules |
| [story-beats.md](../contracts/story-beats.md) | Limitations rewritten for shipped vs open |
| [milestones.md](../contracts/milestones.md) | Structured saves current; impl map → useStoryArc |
| [time.md](../contracts/time.md) | `timeUntil` implemented; impl map fixed |
| [character-wellbeing.md](../contracts/character-wellbeing.md) | Status sentences + Health dialog (not “vitals bar”) |
| [feature-gaps.md](../contracts/feature-gaps.md) | Closed-for-alpha section; remaining true gaps only |

## Punchlist — remaining contract drift (lower priority)

| Document | Issue | Suggested action |
| --- | --- | --- |
| [hex-viewport.md](../contracts/hex-viewport.md) | Still describes fixed hex box; code has avatar focus, zoom/pan | Document `useHexMapCamera` / `gameplayViewBox` |
| [world-local-transitions.md](../contracts/world-local-transitions.md) | Story-picked transition first; validation “eventually” | Document `entryFrom` → default only; validation done in building-model |
| [control-panel.md](../contracts/control-panel.md) | “Later electrical” understates station-grid screen | Acknowledge coarse grid panel; keep loadW/shed as open |
| [hydro-simulator.md](../contracts/hydro-simulator.md) | “Adapter landing” language | Mark EnergySim adapter as primary path |
| [room-fixtures.md](../contracts/room-fixtures.md) | Status “specified” | Partial: sink + purifier |
| [stage-views.md](../contracts/stage-views.md) | Enum lists video/ride | Align with `GAME_VIEW_KINDS` |
| [character-inventory.md](../contracts/character-inventory.md) | “Future game-clock” sentence | Point at live `gameTime.js` |
| [station-electrical-grid.md](../contracts/station-electrical-grid.md) | Mostly aspirational (OK if status says so) | Keep as target; don’t claim productized loadW |

## Unexpected divergences (code ≠ contract intent, not just stale docs)

| Topic | Contract / intent | Code | Severity for alpha |
| --- | --- | --- | --- |
| Open-world start | Explicit mode choice | Always Story from UI | Accept for alpha; gap for v1 polish |
| Zero energy | Force rest/sleep mode | Name filter only (`mustRest`) | Medium — can soft-lock |
| Console end beats | “Check console” step | `connect-power` may auto-complete console beats | Medium — playtest P0-1 |
| Kitchen eat path | Real satiety/hydration | Story choice flags vs garage-gated item path | Medium — playtest P0-2 |
| Locked free travel | Once said unlockable sides might path | Locked never multi-hops (correct stop-at-threshold) | Docs fixed |
| Exterior unlock without key | freeFrom exterior | Fixed in code (2026-08); was a real bug | Closed |

## Alpha call

Alpha is **good enough for external try** if the Story survival→hydro loop is
playable and save slots work. Remaining P0s are content/path trust, not missing
pillars. See [getting-to-alpha.md](getting-to-alpha.md).
