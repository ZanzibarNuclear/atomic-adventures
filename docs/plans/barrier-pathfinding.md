# Barrier Pathfinding — Smarter Open Routes

**Status:** Plan (follow-up to barrier passage openings)  
**Scope:** `game/src/lib/maps/` — travel, barriers, routes  
**Related:** [barrier-passage-openings.md](barrier-passage-openings.md)

## Problem

Direct hex-to-hex chords and coarse side-of-river heuristics break down when:

- Barriers wind through hexes (river cascade, fence runs)
- The same hex column has **parallel corridors** (west bank vs east bank at `q = -2`)
- Openings (bridge, ford) sit at a different **y** than the avatar stand
- A move is geometrically “open” along a bank but blocked by a chord that crosses barrier geometry elsewhere

Recent mid-west fixes (2026-06) addressed two symptoms:

1. Ford used `fromPos.x > riverXAtOpeningY` — wrong side when the avatar y ≠ ford y
2. Return from utility-yard after an east-bank ford failed because destination stands snapped to the west bank

These are patches on a model that still defaults to **straight chords + global east/west filters**.

## Design goal

> A move is allowed when there exists a **walkable path** from stand A to stand B that crosses barriers only at authored openings (or follows an authored corridor).

Players should not need to reason about implementation details (bank column q, chord vs route). Authors should mark **corridors** where parallel travel is intended.

## Current model (summary)

| Layer | Behavior |
|-------|----------|
| Path | Route polyline if marked route connects hexes; else `[fromPos, toPos]` chord |
| Block check | `firstBlockedOnPath` on polyline; openings allow crossing at intersection |
| Special cases | `skipRiverForParallelBankWalk` — both endpoints same side of river |
| Neighbor filter | Preemptive east↔west blocks in `directNeighbors` / `availableMoves` |
| In-hex | `crossPassage` toggles stand across opening |

## Proposed directions (in priority order)

### 1. Same-side bank column stands (done — partial)

When moving between `q = -2` hexes, `resolveNeighborStand` keeps the avatar on the **same river bank** as `fromPos` (west or east offset from center).

**Gap:** Only covers the authored west-bank column. East-bank corridors still rely on chord + skip logic.

### 2. Authored bank corridors (recommended next)

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
- Replaces hard-coded `q = -2` and `skipRiverForParallelBankWalk` over time

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
- [x] Same-side bank stands for `q = -2` column
- [x] `skipRiverForParallelBankWalk` (west and east same-side)
- [ ] Author `west-bank-trail` (or similar) YAML corridor
- [ ] Route builder support for `bank-corridor` kind
- [ ] Remove redundant east↔west preemptive filters once corridors cover Part I
- [ ] Document corridor authoring in `map.yaml` header
