# Feature Gaps

This document tracks behavior described by the contracts that is planned,
partial, or intentionally waiting for a concrete content need. It is not a
parking lot for old systems. When a gap is closed, update the relevant contract,
implementation, and this list in the same change.

**Last reviewed:** 2026-08-07 (beta: energy-sims sole physics path)

## Closed for alpha (do not re-list as open)

- Story mode runtime (`useStoryArc`), arc/beat saves, completion cards, Story Builder arcs.
- Open-world ambient controller exists (start UI still deferred — see below).
- Multi-slot local saves, title Enter / resume, New Game / Restart, dirty prompts.
- Holo-reader MVP: learning document, lessons, completion effects, power-gated stand.
- Inventory stage view + Character inventory reuse.
- Hydro console multi-screen shell + EnergySim adapter path for Part I.
- Process fixtures: **sink** and **water-purifier** runtime.
- Known-area outdoor multi-hop + indoor room multi-hop + door manners.
- Pre-empty wellbeing crisis modal; health-collapse failure panel.
- Structured `milestones` on save; `timeUntil` on story choices.
- Scene `modes`, stand triggers, ambient fallback prose.

## Hydro / EnergySim (beta)

- ~~Rip out legacy JS hydro physics~~ — done for beta (WASM Clearwater Station
  only; host facility inputs remain). Plan:
  [energy-sim-legacy-ripout.md](../plans/energy-sim-legacy-ripout.md).
- Optional: brownout `lightLevel` → indoor media dimming (console already shows grid).
- Host load binding still coarse (lights / holo / EV / kitchen booleans).

## Play Modes And Story Mode

- Explicit **new-game mode chooser** (Story vs Open-world). Alpha always starts Story.
- Player-facing path to start open-world (runtime exists; no title option).
- Harder Story action rails beyond soft prompts (optional for v1).
- Open-world → Story rejoin contract (deferred by design).
- First-class shared Scenes workspace (location + arc projections) — see scene-builder plan.

## Stage Views / Close-Ups

- Video and ride close-up kinds (not in `GAME_VIEW_KINDS` yet).
- Simulation close-up sandbox beyond hydro console.
- Buggy ride presentation (post-alpha).

## Station Electrical Grid

- Author `loadW` (and optional critical flags) on lighting/devices; real balance.
- Deterministic brownout/shed productization beyond coarse host load booleans.
- Optional storage buffer story/state.
- See [station-electrical-grid.md](station-electrical-grid.md).

## Room Fixtures

- Stove / induction process kinds and full kitchen control matrix.
- Broader fixture authoring UX in World Builder as content needs grow.
- See [room-fixtures.md](room-fixtures.md) (sink + purifier already runtime).

## Holo-Reader / Learning

- Author validation warnings for weak lessons.
- Video lesson blocks and richer interaction types.
- Broader lesson library beyond hydro beginner.

## Character, Inventory, Content

- Backpack / eBuggy holders when those holders become playable.
- Simulation outcomes → shared character effects end-to-end where still thin.
- Account store / cross-device character when registration exists.
- Reference-safe renames for IDs that appear in saves (policy + tooling).

## Character Wellbeing

- Forced rest / sleep **workflow** at zero energy (today: `mustRest` filters actions by name only; can soft-lock if no rest action exists).
- Composure effects on available actions / perception (panic non-fatal by design).
- Max health, daily targets, environmental modifiers when Part I needs them.
- Character overview optionally showing derived health.

## Game Time

- Authored story/scenario start clock (Part I still hard-coded noon start).
- Fuller rest/sleep-until UX and Day 1→2 pacing polish.
- World/facility resource integrate-while-away beyond character stat drift.

## Maps / Movement

- Optional “way is blocked” feedback for failed multi-hop.
- Full indoor stand-graph free travel (room graph is current).
- Player-facing full/gameplay map mode toggle (mode field exists).
- Story-selected building entry transition id (entry uses approach `entryFrom` today).

## Control Panel / Hydro

- Generic multi-panel registry beyond hydro shell.
- Finer load binding and discovery-friendly plant names in player copy.
- Field close-ups for intake/valves (stills + actions are alpha bar).

## Authoring / Tooling

- Scene Builder workspace rename and storage cleanup ([scene-builder-workspace.md](../plans/scene-builder-workspace.md)).
- Cull misleading automated tests; keep only invariant-proving tests ([AGENTS.md](../../AGENTS.md)).
- Automated smoke/path coverage for Story loop (optional; not required for alpha call).
