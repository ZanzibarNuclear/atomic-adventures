# Barrier Passage Openings — Gate, Hole, Ford, Bridge

> **Superseded:** Consolidated into [hexcrawling.md](../designs/hexcrawling.md). This file is kept for historical reference only.

**Status:** Superseded  
**Scope:** `game/` — playable vertical slice  
**Related:** [hexcrawling.md](../designs/hexcrawling.md), [part-i-alpha-slice.md](part-i-alpha-slice.md)

## Overview

**Barriers** (fence, river, cliff, ravine) block movement along paths. **Openings** (gate, hole, bridge, ford) are authored points where the player may **cross a barrier within the same hex** using `crossPassage`.

Openings are **not** general exemptions on inter-hex travel paths. Adjacent hex movement uses the two-step border-then-stand model in [barrier-pathfinding.md](barrier-pathfinding.md): barriers always block path segments during steps 1 and 2 unless the geometry simply does not cross them. An opening inside a hex (e.g. the compound gate in `gate-woods`) does **not** let the avatar “cut through” that barrier when walking into a **neighbor** hex.

**Exception (rare):** An opening placed exactly on the **shared border** between two hexes could matter for inter-hex travel in a future extension. Part I does not rely on this; all four opening kinds are used for in-hex passage.

## Design decisions

| Opening | Visibility | In-hex travel (`crossPassage`) | Reveal         |
| ------- | ---------- | ------------------------------ | -------------- |
| Gate    | Obvious    | Passable when unlocked / story | Hex discovered |
| Bridge  | Obvious    | Always passable                | Hex discovered |
| Hole    | Hidden     | Passable after search          | Search in hex  |
| Ford    | Hidden     | Passable after search\*        | Search in hex  |

\*Ford at `mid-west` is authored at the river waypoint. Search demonstrates the ford; `mid-west → utility-yard` resolves as adjacent movement along the west bank **without** using the ford opening on the inter-hex path.

Hole crossing (confirmed): pre-cut breach at `south-pines`; discover → `crossPassage` to the east side of the fence → then `lower-stand` is reachable. Fence cutter deferred.

## Placement

Openings use point features in [`game/content/world/map.yaml`](../game/content/world/map.yaml):

```yaml
- id: upper-gorge-bridge
  kind: bridge
  hex: upper-gorge
  visibility: obvious
  at: { x: -155, y: -113 } # tuned for crossPassage stand flip
  label: Bridge
```

`at` accepts hex-anchored coords (`{ hex, dx, dy }`) or raw `{ x, y }` via [`resolveOpeningPosition`](../game/src/lib/maps/composables/useBarrierOpenings.js).

**Tuning workflow:** run travel / passage tests and smoke journeys; adjust `at` until **`crossPassage`** places the avatar correctly on the far side of the barrier and discovery/search UI behaves as intended. Do **not** tune openings against `openingAllows` on neighbor moves — that workflow is superseded (see [barrier-pathfinding.md — Superseded documentation](barrier-pathfinding.md#superseded-documentation-do-not-follow)).

## Authored openings (Part I)

| ID                   | Kind   | Hex           | Notes                                                |
| -------------------- | ------ | ------------- | ---------------------------------------------------- |
| `compound-gate`      | gate   | `gate-woods`  | `crossPassage` north ↔ south of fence; story lock    |
| `south-pines-hole`   | hole   | `south-pines` | Fence breach; search then `crossPassage`             |
| `upper-gorge-bridge` | bridge | `upper-gorge` | `crossPassage` then `upper-gorge → north-west`       |
| `mid-west-ford`      | ford   | `mid-west`    | Search then `crossPassage`; bank walk to utility-yard |

`river-access-drive` was promoted from feature-only to a **marked route** so `road-fork → upper-gorge` follows the drive polyline (two-step route contract).

## Code map

| Concern                               | File                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| Opening resolution + discovery filter | [`useBarrierOpenings.js`](../game/src/lib/maps/composables/useBarrierOpenings.js)   |
| Inter-hex path checks (no openings)   | [`useTravelBarriers.js`](../game/src/lib/maps/composables/useTravelBarriers.js)     |
| In-hex `crossPassage` + `openingAllows` | [`usePassageCrossing.js`](../game/src/lib/maps/composables/usePassageCrossing.js) |
| `discoveredOpenings` state + search   | [`useOutdoorWorld.js`](../game/src/lib/maps/composables/useOutdoorWorld.js)         |
| Save/load                             | [`useGameState.js`](../game/src/composables/useGameState.js)                        |
| Search UI                             | [`usePlayPanel.js`](../game/src/composables/usePlayPanel.js)                        |
| Map symbols                           | [`HexPassageLayer.vue`](../game/src/lib/maps/components/hex/HexPassageLayer.vue)    |
| Marker visibility                     | [`useHexMapPlacements.js`](../game/src/lib/maps/composables/useHexMapPlacements.js) |

`openingAllows` remains exported from `useTravelBarriers.js` for **passage crossing** and tests; it is **not** called from `firstBlockedOnPath` during inter-hex travel.

## Smoke test (end-to-end)

[`barrierPassageJourney.test.js`](../game/src/lib/maps/testing/barrierPassageJourney.test.js) is the primary smoke file. Run with:

```bash
npm run test -- barrierPassageJourney
```

### Northern approach + west bank (bridge + ford)

1. `trailhead → east-pines → far-pines → north-bend → road-fork → upper-gorge` (via `river-access-drive` route)
2. `crossPassage('upper-gorge-bridge')` in-hex, then `upper-gorge → north-west`
3. West-bank column: `north-west → mid-west` (hex-center `north-west → mid-west` is blocked by the river — not a fence issue)
4. Search ford at `mid-west` (`mid-west-ford` hidden until search)
5. `mid-west → utility-yard` on the west bank (no ford crossing required on the inter-hex path)

### Southern fence openings (same file)

6. `gate-woods → south-pines` — use `crossPassage('compound-gate')` when north of the fence; inter-hex move does not pass through the gate opening automatically
7. `lower-stand → south-pines` blocked until `south-pines-hole` is discovered; from `south-pines`, `crossPassage` through the hole before `lower-stand` when west of the fence

When this file passes, all four opening kinds are wired correctly for **in-hex passage** plus the unified adjacent-move contract.

### Related tests (not duplicated in smoke)

| Test file                                                                               | Covers                                          |
| --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [`openingDiscovery.test.js`](../game/src/lib/maps/testing/openingDiscovery.test.js)     | `travelOpenings` filter, hole → `crossPassage`  |
| [`usePassageCrossing.test.js`](../game/src/lib/maps/testing/usePassageCrossing.test.js) | Bridge stand flip, ford UI gating               |
| [`midWestFord.test.js`](../game/src/lib/maps/testing/midWestFord.test.js)               | Ford `crossPassage` + adjacent bank walks       |
| [`midWestGateWoods.test.js`](../game/src/lib/maps/testing/midWestGateWoods.test.js)       | `mid-west → gate-woods` enters south of fence   |
| [`roadForkUpperGorge.test.js`](../game/src/lib/maps/testing/roadForkUpperGorge.test.js) | Drive route lands on east bank at `upper-gorge` |
| [`fenceRegression.test.js`](../game/src/lib/maps/testing/fenceRegression.test.js)       | No accidental fence leaks at default stands     |

## Implementation checklist

Verified against `game/` sources; re-verify after movement contract changes with `npm run test`.

- [x] Write this plan
- [x] `resolveOpeningPosition` / hex-anchored `at` in `useBarrierOpenings.js`
- [x] `outdoor.discoveredOpenings` + save/load in [`useGameState.js`](../game/src/composables/useGameState.js)
- [x] Author hole, ford, bridge in `map.yaml`; tune bridge coords for `crossPassage`
- [x] `HexPassageLayer` symbols (gate, hole, ford, bridge)
- [x] Outdoor search action in play panel
- [x] Forest tree exclusions for all opening kinds
- [x] Unit tests + smoke test journey
- [x] Document opening scope vs inter-hex travel ([barrier-pathfinding.md](barrier-pathfinding.md))
- [ ] Save/load round-trip test for `discoveredOpenings`
- [ ] Builder `serializeOpening` for hole/ford/bridge (fast follow)
- [ ] Outdoor gate lock open/closed state (later)
- [ ] Fence cutter item (later)
- [ ] Story beats for search success prose (later)

## Review notes

**What works:** All four opening kinds are authored, rendered, filtered by discovery, searchable, persisted, and covered by tests. Inter-hex travel uses barrier geometry only; openings activate via `crossPassage`.

**Plan correction:** Step 3 of the northern journey is not `north-west → gate-woods → mid-west`. `gate-woods` is east of the river; from `north-west` the player stays on the west bank and walks `north-west → mid-west` directly after crossing the bridge in `upper-gorge`.

**Minor gaps:**

- No automated save round-trip for `discoveredOpenings`.
- `web/` prototype still uses opening bypass on paths — intentional divergence until ported from `game/`.

## Out of scope (later)

- Player-cut holes with fence cutter
- Builder UI for placing openings
- Story beats for search success prose
- Border-mounted openings as inter-hex gate (not used in Part I)
