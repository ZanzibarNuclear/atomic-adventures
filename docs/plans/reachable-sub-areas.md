# Reachable Sub-Areas — Implementation Plan

**Status:** Preserved plan (not started)  
**Scope:** `game/src/lib/maps/` — replaces sampled `pathInHex` grid search with explicit sub-area geometry  
**Source of truth for movement contract:** [docs/designs/hex-crawling.md](../designs/hex-crawling.md)
**Punch list item:** Geometry and stands §1 — *replace sampled local search with explicit reachable sub-areas*

## Overview

Outdoor hex movement today uses `pathInHex` in `useTravelBarriers.js`: a fixed grid BFS inside the hex polygon. That works for Part I but is **sample-dependent** — it can miss narrow corridors, mis-classify barrier endpoints, and re-search for every shared-border sample.

This plan introduces **explicit reachable sub-areas**: the connected free region containing the avatar inside one hex, derived from the hex polygon minus barrier segments. Border reachability, in-hex paths, and destination stands all read from that region.

Inter-hex movement still **never consumes passages**; `crossPassage` only changes which sub-area the stand occupies, then geometry is recomputed.

---

## Problem

| Failure mode | Why grid search breaks |
| ------------ | ---------------------- |
| U-shaped fence | Grid may miss the narrow corridor between arms |
| 3+ compartments in one hex | Wrong component if samples don't land in the corridor |
| Barrier endpoint grazing | `segmentClearsBarrierJunctions` is heuristic, not topological |
| "Which borders can I reach?" | Requires a separate `pathInHex` per border sample |

The design contract wants: **one entry-side sub-area** → **reachable borders from its perimeter** → **stands chosen inside that region**.

---

## Design principle

Treat each hex as a **simple polygon** (the cell) minus **open barrier segments** (walls you cannot cross). The avatar occupies **one connected face** of that arrangement:

```
stand → locate face → sub-area polygon → reachable borders + paths + stands
```

---

## Architecture

New module; thin integration into the existing resolver:

```
game/src/lib/maps/composables/
  useReachableSubArea.js   ← NEW (geometry only, no Vue)
  useTravelBarriers.js     ← call sub-area APIs instead of pathInHex grid
```

```mermaid
flowchart TD
  subgraph inputs
    stand[stand position]
    hex[hex + size]
    barriers[barrier segments in hex]
  end

  subgraph subarea [useReachableSubArea]
    clip[clip barriers to hex]
    arrange[build arrangement / split at crossings]
    face[locate face containing stand]
    poly[sub-area boundary polygon]
    borders[reachable shared-border segments]
    graph[visibility walk graph in face]
  end

  subgraph consumers [useTravelBarriers]
    step1[findReachableBorderEntry]
    step2[resolveDestinationStand]
    blocked[resolveBlockedDeparture]
  end

  stand --> face
  hex --> clip
  barriers --> clip
  clip --> arrange --> face --> poly
  poly --> borders
  poly --> graph
  borders --> step1
  graph --> step2
  face --> blocked
```

### Current code map (integration targets)

| Concern | File | Replace / wrap |
| ------- | ---- | -------------- |
| In-hex grid walk | `useTravelBarriers.js` → `pathInHex` | `pathInSubArea` |
| Border samples | `reachableSharedBorderEntries` | `reachableBorderEntries` from sub-area |
| Destination stands | `resolveDestinationStand` | `standReachableFromEntry` uses sub-area paths |
| Interior fallbacks | `hexInteriorCandidates` | Sample only inside `subArea.polygon` |
| Barrier midpoint | `barrierMidpointStand` | Midpoint of blocking segment **clipped to sub-area boundary** |

---

## Core API

```javascript
// useReachableSubArea.js

/**
 * The connected free region containing `stand` inside `hex`.
 * Returns null if stand is outside the hex.
 */
export function reachableSubArea(hex, stand, ctx, size) {
  return {
    faceId,           // stable id for caching (hexId + barrier hash + stand bucket)
    polygon,          // CCW outer ring — sub-area boundary
    reachableBorders, // [{ neighborHexId, edgePoint, insidePoint }]
  }
}

/** Point-to-point walk staying inside the sub-area (replaces pathInHex). */
export function pathInSubArea(subArea, from, to, ctx) → Point[] | null

/** Whether `to` lies in the same sub-area as `from`. */
export function canReachInSubArea(subArea, from, to, ctx) → boolean

/**
 * All shared-border entry options reachable from `fromPos` in `fromHex`
 * without crossing a barrier.
 */
export function reachableBorderEntries(fromHex, toHex, fromPos, ctx, size)
```

---

## Algorithm (per hex, per stand)

### Step 1 — Clip geometry to the hex

```javascript
function clipBarriersToHex(hex, size, ctx) {
  const ring = hexPolygon(hex, size)
  return barrierList(ctx)
    .flatMap((seg) => clipSegmentToConvexPolygon(seg, ring))
}
```

Use the same sampled barrier curves as rendering (`buildRouteModels` → `barrierSegments`). Clipping is against the hex polygon, not axis-aligned bounds.

### Step 2 — Build a planar arrangement

Collect **nodes**:

- Hex corners (6)
- All clipped barrier endpoints
- Intersection points (barrier × barrier, barrier × hex edge)

Split every segment at nodes → **edges**. Each edge is either:

- a **hex-boundary edge** (walkable along the border), or
- a **barrier edge** (not crossable)

Complexity is O(n²) in segments per hex; n is tiny (Part I: ≤ 4 barriers × ~20 samples).

### Step 3 — Locate the face containing the stand

**A. Flood fill / point-in-polygon (robust point location)**

```javascript
function faceContainingPoint(stand, faces) {
  for (const face of faces) {
    if (pointInPolygon(stand, face.ring)) return face
  }
  return null
}
```

Faces are extracted by walking closed loops in the arrangement (DCEL or half-edge walk). At our scale, enumerating minimal cycles is acceptable.

**B. Perimeter trace (design doc method #4)**

Once the face is known, its boundary is the perimeter trace. `reachableBorders` = boundary arcs that lie on a **hex-to-neighbor shared edge**:

```javascript
function bordersFromFace(face, hex, hexById, size) {
  const entries = []
  for (const neighbor of adjacentHexes(hex)) {
    const shared = sharedHexEdge(hex, neighbor, size)
    const overlap = intersectPolylineWithSegment(face.ring, shared)
    for (const span of overlap) {
      entries.push({
        neighborHexId: neighbor.id,
        edgePoint: midpoint(span),
        insidePoint: nudgeInward(span, neighbor, size),
      })
    }
  }
  return entries
}
```

If a border segment is part of the face boundary, it is reachable — no per-sample grid walk.

### Step 4 — Paths inside the face

Build a **visibility graph** on the face polygon:

**Nodes:** stand, target, all face vertices, hex corners on the face, barrier endpoints on the face boundary.

**Edges:** segment AB is valid iff:

1. AB lies inside the face (midpoint ∈ face), and
2. AB doesn't cross any barrier segment (`pathClear([A,B], ctx)`)

Run A* or BFS (graphs are small). Replaces grid BFS in `pathInHex`.

### Step 5 — Topological endpoint blocking

Under sub-areas, a barrier endpoint on the face boundary is a **vertex** of the sub-area polygon. "Squeezing past" an endpoint requires a face edge along the barrier — if geometry doesn't leave a gap, no face exists there, so no path, border, or stand. This replaces `PATH_ORIGIN_EPS` / `segmentClearsBarrierJunctions` heuristics for sub-area reasoning.

---

## Integration sketch

### `findReachableBorderEntry`

```javascript
function findReachableBorderEntry({ fromHex, toHex, fromPos, walkPath, ctx, size, ... }) {
  // 1. route / chord attempts unchanged (fast paths)

  const subArea = reachableSubArea(fromHex, fromPos, interHexTravelCtx(ctx), size)
  if (!subArea) return null

  // 2. topological border list
  for (const border of subArea.reachableBorders) {
    if (border.neighborHexId !== toHex.id) continue
    const approach = pathInSubArea(subArea, fromPos, border.edgePoint, ctx)
    if (!approach) continue
    if (!pathClear([border.edgePoint, border.insidePoint], ctx)) continue
    return { entryPoint: border.insidePoint, approachPath: [...approach, border.insidePoint] }
  }
  return null
}
```

### `resolveDestinationStand`

```javascript
const destArea = reachableSubArea(toHex, entryPoint, travelCtx, size)

// route stand: unchanged (trust route polyline when walkPath.length > 2)
// authored / center / midpoint: must land in destArea via pathInSubArea
for (const target of preferred) {
  const stand = pathInSubArea(destArea, entryPoint, target, travelCtx)?.at(-1)
    ?? standBeforeFirstHit(...) // only if hit inside destArea
  if (stand) return { stand, blockedKind: null }
}
```

---

## Caching

`reachableSubArea` is pure geometry. Cache keyed by:

```
`${hex.id}:${barrierVersion}:${quantize(stand, size/8)}`
```

Invalidate when map features change (builder) or on hex crossing. Reduces cost when `canReachHex` runs for every option in `getMovementOptions`.

---

## Migration strategy

The punch list says: don't rewrite until a concrete failing case exists. Land in phases:

| Phase | What | Gameplay risk |
| ----- | ---- | ------------- |
| **0** | Add `useReachableSubArea.js` + synthetic tests (U-hex, 3-compartment hex) | None |
| **1** | Shadow mode: run sub-area + grid in tests; assert agreement on Part I `map.yaml` | CI only |
| **2** | Flip `pathInHex` → `pathInSubArea` behind `useSubAreaResolver` flag | Reversible |
| **3** | Remove grid BFS after shadow parity + one authored torture hex in `map.yaml` | Cleanup |

No Part I behavior change until phase 2, and only if shadow parity holds.

---

## Test harness

New file: `game/src/lib/maps/testing/reachableSubArea.test.js`

| Test | Asserts |
| ---- | ------- |
| U-shaped fence | Stand in left arm reaches west border, not east, without passage |
| Three compartments | Stand in pocket — only passage or backtrack |
| Endpoint at hex corner | Grid false-positive cases fail under sub-area |
| Part I shadow parity | `subArea.reachableBorders` matches current `offeredMoves` for all default stands |

Keep `travelWorld.js` as integration oracle; add `evaluateNeighborMoveSubArea(world, …)` for side-by-side comparison.

Run: `npm run test` from repo root.

---

## File layout

```
useReachableSubArea.js
  clipBarriersToHex()
  buildArrangement(hex, clippedSegments)
  extractFaces(arrangement)
  faceAtPoint(faces, point)
  bordersOnSharedEdges(face, hex, neighbors, size)
  buildVisibilityGraph(face)
  pathInFace(face, from, to, ctx)           // exported as pathInSubArea
  reachableSubArea(hex, stand, ctx, size)   // main export
  reachableBorderEntries(...)               // replaces grid border walk
```

Target size: ~250–350 lines of geometry, no Vue — same pattern as `useHexGeometry.js`.

---

## Out of scope

- Multi-hex polygon pathfinding (still not defined)
- Merging passages into inter-hex travel
- Replacing `segmentIntersection` / `pathCrossesBarrier` — sub-areas consume the same barrier segments
- Indoor grid / `utility-station.yaml` cliff wall (separate system)

---

## Agent notes (follow this plan later)

1. Read [hex-crawling.md](../designs/hex-crawling.md) movement contract before coding.
2. Implement phase 0 only first; do not flip gameplay until shadow tests pass.
3. Edit `game/src/lib/maps/`, not `web/`.
4. Run `npm run test` after each phase.
5. When phase 2 lands, update the "Current Implementation Details" section in `hex-crawling.md` and trim punch list item §1.
