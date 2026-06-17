# Barrier Pathfinding — Adjacent Movement Contract

**Status:** Active design + implementation guide  
**Scope:** `game/src/lib/maps/` — travel, barriers, routes  
**Related:** [barrier-passage-openings.md](barrier-passage-openings.md)

## Problem

Direct hex-to-hex chords and coarse side-of-river heuristics break down when:

- Barriers wind through hexes (river cascade, fence runs)
- The same hex column has **parallel corridors** (west bank vs east bank at `q = -2`)
- Openings (bridge, ford) sit at a different **y** than the avatar stand
- A move is geometrically “open” along a bank but blocked by a chord that crosses barrier geometry elsewhere

Earlier mid-west fixes (2026-06) addressed two symptoms:

1. Ford used `fromPos.x > riverXAtOpeningY` — wrong side when the avatar y ≠ ford y
2. Return from utility-yard after an east-bank ford failed because destination stands snapped to the west bank

Those fixes were patches on a model that defaulted to **straight chords + global east/west filters**. The current implementation uses a generic shared-edge fallback for barrier-following adjacent movement.

## Design goal

> A move is allowed when there exists a **walkable adjacent step** from stand A into the neighboring hex that crosses barriers only at authored openings.

Players should not need to reason about implementation details (bank column q, chord vs route). Authors should only need to mark routes, barriers, openings, and preferred stand points.

## Movement priority order

Adjacent outdoor movement resolves in this order:

1. **Authored route first.** If a trail, road, drive, or other route connects the current hex to the neighbor, movement follows that route geometry.
2. **Authored stand points are preferred.** If the destination hex has `standAt`, that is the preferred arrival stand. It is used when reachable without crossing a closed barrier.
3. **Closed barriers truly block movement.** A move is rejected when every plausible adjacent entry into the destination hex would cross a barrier without an allowed opening.
4. **Shared-edge barrier-following fallback.** When the preferred stand/center path is blocked, sample the shared edge between the two hexes. If the avatar can reach an entry point on that edge and can stand just inside the destination hex on the same side of the barrier, allow the move.
5. **Center-to-center remains the default.** When no route, authored stand, barrier, or opening affects the move, the avatar moves to the destination hex center.

The shared-edge fallback is a recovery path for barrier-adjacent movement, not the default. It should not replace ordinary center-to-center walking on open terrain.

## Current model (summary)

| Layer | Behavior |
|-------|----------|
| Path | Route polyline if marked route connects hexes; else `[fromPos, toPos]` chord |
| Block check | `firstBlockedOnPath` on polyline; openings allow crossing at intersection |
| Special cases | Shared-edge fallback for blocked direct adjacent moves that are mostly parallel to the blocking barrier |
| Neighbor filter | Route/direct candidates defer to `canEnterNeighbor` / `resolveMove`; broad east↔west filters have been removed |
| In-hex | `crossPassage` toggles stand across opening |

## Generic adjacent fallback

When the route/stand/center path is blocked, the movement resolver should:

1. Compute the shared edge between the adjacent hexes.
2. Sample several points along that edge, excluding exact corners.
3. Nudge each sample slightly into the destination hex.
4. Keep samples reachable from the current stand without crossing a closed barrier.
5. Prefer the authored destination `standAt` if it is reachable from that sample.
6. Otherwise stand at the nudged inside-edge point.

This works for fences, rivers, cliffs, ravines, and future barrier kinds because it relies on the same barrier segment + opening geometry used everywhere else.

## Proposed directions (in priority order)

### 1. Shared-edge adjacent fallback (done)

When a preferred direct stand/center path is blocked, `resolveMove` samples the shared edge between the neighboring hexes. If the avatar can reach an inside-edge sample without crossing a closed barrier, the move is allowed.

This replaces the previous q-specific bank-column workaround.

### 2. Authored bank corridors (optional later)

Add optional route kind or feature flag:

```yaml
routes:
  - id: west-bank-trail
    kind: bank-corridor
    side: west   # west | east
    points: [...]  # polyline hugging the bank
```

- Movement between hexes touched by the corridor uses the **corridor polyline** as path (like `river-access-drive`)
- `firstBlockedOnPath` sees a path that never crosses the river
- Useful only when designers want an explicit visible/authored corridor rather than implicit adjacent barrier-following

**Authoring workflow:** trace the walkable bank in builder; smoke test with journey tests per corridor.

### 3. Path sampling instead of chords

For direct hex moves without a marked route:

1. Build a small path: stand → (optional corridor waypoint) → destination stand
2. Waypoints from: same-side bank offset, hex `standAt`, or corridor nearest point
3. Run barrier check on polyline, not single chord

Avoids false blocks/opens when the chord crosses a barrier segment far from the actual walk.

### 4. Side detection at path endpoints only

Replace global `isEastOfRiverAt(from) && isWestOfRiverAt(to)` filters with:

- Compute `toPos` via same-side / corridor rules first
- Let `canOfferNeighbor` + `firstBlockedOnPath` be the single gate
- Keep only rules that encode **game design** (e.g. hide `river-access-drive` from west bank)

Ford/bridge crossings already use side at **fromPos.y** (fixed 2026-06).

### 5. Reachability graph (later)

For complex maps, precompute per-hex **stand regions** (west bank, east bank, interior) and legal edges:

- Direct step within region
- Opening edge (bridge, ford, gate, hole)
- Route edge (marked polylines)

Movement UI queries the graph; barrier geometry stays authoritative for new hexes until recomputed.

## Testing strategy

| Test | Asserts |
|------|---------|
| `midWestFord.test.js` | One-click ford; east-bank round trip utility-yard ↔ mid-west |
| `midWestMove.test.js` | West-bank column without ford |
| `barrierPassageJourney.test.js` | Full northern approach + west column |
| Future corridor tests | Path follows YAML polyline; no chord cross |

Add regression any time a **move is offerable but path crosses a barrier** without an opening (the utility-yard return bug class).

## Out of scope

- Full A* around barrier polygons
- Automatic corridor inference from river geometry
- Multi-hex paths beyond adjacent steps (auto-travel wayfinding)

## Checklist

- [x] Fix ford side detection (`isWestOfRiverAt` / `isEastOfRiverAt`, not x vs riverX at ford y)
- [x] Same-side bank stands for `q = -2` column _(removed after generic fallback covered it)_
- [x] `skipRiverForParallelBankWalk` (west and east same-side) _(removed after generic fallback covered it)_
- [x] Implement shared-edge fallback for adjacent moves
- [x] Remove hard-coded river-bank column behavior
- [x] Remove redundant east↔west preemptive filters once generic fallback covers Part I
- [x] Add orientation-agnostic barrier-following regression tests
- [ ] Author `west-bank-trail` (or similar) YAML corridor only if future map design needs explicit walkable bank routes
- [ ] Route builder support for `bank-corridor` kind only if authored corridors become necessary
