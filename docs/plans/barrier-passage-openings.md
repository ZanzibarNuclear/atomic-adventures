# Barrier Passage Openings — Gate, Hole, Ford, Bridge

**Status:** Implemented (Part I map)  
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

[`barrierPassageJourney.test.js`](../game/src/lib/maps/testing/barrierPassageJourney.test.js) walks:

1. `trailhead → east-pines → far-pines → north-bend → road-fork → upper-gorge` (via `river-access-drive` route)
2. `upper-gorge → north-west` (bridge)
3. `north-west → gate-woods → mid-west` (fence blocks direct `north-west → mid-west`)
4. Search ford at `mid-west`
5. `mid-west → utility-yard`

When this test passes, all four opening kinds are wired correctly.

## Implementation checklist

- [x] Write this plan
- [x] `resolveOpeningAt` / hex-anchored `at` in `useBarrierOpenings.js`
- [x] `outdoor.discoveredOpenings` + save/load
- [x] Author hole, ford, bridge in `map.yaml`; tune bridge coords
- [x] `HexPassageLayer` symbols (gate, hole, ford, bridge)
- [x] Outdoor search action in play panel
- [x] Forest tree exclusions for all opening kinds
- [x] Unit tests + smoke test journey
- [ ] Builder `serializeOpening` for hole/ford/bridge (fast follow)
- [ ] Sync to `web/` prototype (optional)
- [ ] Outdoor gate lock open/closed state (later)
- [ ] Fence cutter item (later)

## Out of scope (later)

- Player-cut holes with fence cutter
- Builder UI for placing openings
- Story beats for search success prose
