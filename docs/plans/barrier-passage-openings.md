# Barrier Passage Openings — Gate, Hole, Ford, Bridge

**Status:** Implemented (Part I map) — verified 2026-06-16  
**Scope:** `game/` — playable vertical slice  
**Related:** [part-i-alpha-slice.md](part-i-alpha-slice.md)

## Overview

Fence and river barriers block direct hex travel except at authored **openings**: gate/hole (fence) and bridge/ford (river). Each opening has a precise world position, map symbol, and discovery rules (obvious vs search-revealed).

## Design decisions

| Opening | Visibility | Travel | Reveal |
|---------|------------|--------|--------|
| Gate | Obvious | Always passable | Hex discovered |
| Bridge | Obvious | Always passable | Hex discovered |
| Hole | Hidden | Passable after search | Search in hex |
| Ford | Hidden | Passable after search* | Search in hex |

\*Ford at `mid-west` is authored at the river waypoint; bank-column `standAt` offsets keep most moves parallel to the river. Search demonstrates the ford; `mid-west → utility-yard` uses the west-bank column without a river crossing.

Hole crossing (confirmed): pre-cut breach at `south-pines`; discover → passable. Fence cutter deferred.

## Placement

Openings use point features in [`game/content/world/map.yaml`](../game/content/world/map.yaml):

```yaml
- id: upper-gorge-bridge
  kind: bridge
  hex: upper-gorge
  visibility: obvious
  at: { x: -155, y: -113 }   # tuned to path–river intersection
  label: Bridge
```

`at` accepts hex-anchored coords (`{ hex, dx, dy }`) or raw `{ x, y }` via [`resolveOpeningPosition`](../game/src/lib/maps/composables/useBarrierOpenings.js).

**Tuning workflow:** run travel tests / smoke test; adjust `at` until `openingAllows` passes for the intended neighbor move.

## Authored openings (Part I)

| ID | Kind | Hex | Notes |
|----|------|-----|-------|
| `compound-gate` | gate | `gate-woods` | Existing compound gate |
| `south-pines-hole` | hole | `south-pines` | Fence breach; search to reveal |
| `upper-gorge-bridge` | bridge | `upper-gorge` | Cross to `north-west` |
| `mid-west-ford` | ford | `mid-west` | Search to reveal |

`river-access-drive` was promoted from feature-only to a **marked route** so `road-fork → upper-gorge` follows the drive polyline (avoids false river chord blocks).

## Code map

| Concern | File |
|---------|------|
| Opening resolution + discovery filter | [`useBarrierOpenings.js`](../game/src/lib/maps/composables/useBarrierOpenings.js) |
| Path intersection checks | [`useTravelBarriers.js`](../game/src/lib/maps/composables/useTravelBarriers.js) |
| `discoveredOpenings` state + search | [`useOutdoorWorld.js`](../game/src/lib/maps/composables/useOutdoorWorld.js) |
| Save/load | [`useGameState.js`](../game/src/composables/useGameState.js) |
| Search UI | [`usePlayPanel.js`](../game/src/composables/usePlayPanel.js) |
| Map symbols | [`HexPassageLayer.vue`](../game/src/lib/maps/components/hex/HexPassageLayer.vue) |
| Marker visibility | [`useHexMapPlacements.js`](../game/src/lib/maps/composables/useHexMapPlacements.js) |

## Smoke test (end-to-end)

[`barrierPassageJourney.test.js`](../game/src/lib/maps/testing/barrierPassageJourney.test.js) is the primary smoke file. Run with:

```bash
npm run test -- barrierPassageJourney
```

### Northern approach + west bank (bridge + ford)

1. `trailhead → east-pines → far-pines → north-bend → road-fork → upper-gorge` (via `river-access-drive` route)
2. Cross `upper-gorge-bridge` in-hex, then `upper-gorge → north-west`
3. West-bank column: `north-west → mid-west` (hex-center `north-west → mid-west` is blocked by the river — not a fence issue)
4. Search ford at `mid-west` (`mid-west-ford` hidden until search)
5. `mid-west → utility-yard` on the west bank (no ford crossing required)

### Southern fence openings (same file)

6. `gate-woods → south-pines` through `compound-gate`
7. `lower-stand → south-pines` blocked until `south-pines-hole` is discovered

When this file passes, all four opening kinds are wired correctly.

### Related tests (not duplicated in smoke)

| Test file | Covers |
|-----------|--------|
| [`openingDiscovery.test.js`](../game/src/lib/maps/testing/openingDiscovery.test.js) | `travelOpenings` filter, hole reveal |
| [`usePassageCrossing.test.js`](../game/src/lib/maps/testing/usePassageCrossing.test.js) | Bridge stand flip, ford UI gating |
| [`westBankColumn.test.js`](../game/src/lib/maps/testing/westBankColumn.test.js) | Play-mode west-bank column + UI labels |
| [`roadForkUpperGorge.test.js`](../game/src/lib/maps/testing/roadForkUpperGorge.test.js) | Drive route lands on east bank at `upper-gorge` |
| [`fenceRegression.test.js`](../game/src/lib/maps/testing/fenceRegression.test.js) | No accidental fence leaks at default stands |

## Implementation checklist

Verified 2026-06-16 against `game/` sources and `npm run test` (92 tests passing).

- [x] Write this plan
- [x] `resolveOpeningPosition` / hex-anchored `at` in `useBarrierOpenings.js` *(plan previously said `resolveOpeningAt`; actual export is `resolveOpeningPosition`)*
- [x] `outdoor.discoveredOpenings` + save/load in [`useGameState.js`](../game/src/composables/useGameState.js) (`captureSnapshot` / `applyOutdoorSnapshot`)
- [x] Author hole, ford, bridge in `map.yaml`; tune bridge coords
- [x] `HexPassageLayer` symbols (gate, hole, ford, bridge)
- [x] Outdoor search action in play panel (`buildOutdoorSearchActions`, `search:barrier` handler)
- [x] Forest tree exclusions for all opening kinds (`openingExclusions` in `forestTreePlacement.js`)
- [x] Unit tests + smoke test journey *(smoke test extended to cover full west-bank leg + gate/hole cases)*
- [ ] Save/load round-trip test for `discoveredOpenings` *(state is serialized but not yet asserted in tests)*
- [ ] Builder `serializeOpening` for hole/ford/bridge (fast follow — no implementation yet)
- [ ] Sync to `web/` prototype (optional — `web/` still uses legacy `travelOpenings` without discovery)
- [ ] Outdoor gate lock open/closed state (later)
- [ ] Fence cutter item (later)
- [ ] Story beats for search success prose (later — search works mechanically, no narrative hook)

## Review notes (2026-06-16)

**What works:** All four opening kinds are authored, rendered, filtered by discovery, integrated with travel barriers, searchable from the play panel, persisted in save snapshots, and covered by tests. The northern approach route and west-bank column play correctly end-to-end.

**Smoke test gap (fixed):** The smoke test previously stopped at `upper-gorge → north-west`. Steps 3–5 and gate/hole cases were only covered in scattered unit tests. The smoke file now includes the full west-bank leg plus gate and hole assertions.

**Plan correction:** Step 3 is not `north-west → gate-woods → mid-west`. `gate-woods` is east of the river; from `north-west` the player stays on the west bank and walks `north-west → mid-west` directly after crossing the bridge.

**Minor gaps to consider:**

- No automated test reloads a save and asserts `discoveredOpenings` survives round-trip.
- `web/` prototype lacks discovery/search — intentional deferral but diverges from game.
- Ford search reveals the crossing UI; the west-bank `utility-yard` leg does not require using the ford (by design).

## Out of scope (later)

- Player-cut holes with fence cutter
- Builder UI for placing openings
- Story beats for search success prose
