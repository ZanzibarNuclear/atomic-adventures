# Barrier Pathfinding — Adjacent Movement Contract

> **Superseded:** Consolidated into [hexcrawling.md](../designs/hexcrawling.md). This file is kept for historical reference only.

**Status:** Superseded  
**Scope:** `game/src/lib/maps/` — travel, barriers, routes  
**Related:** [hexcrawling.md](../designs/hexcrawling.md), [barrier-passage-openings.md](barrier-passage-openings.md)

## Problem

Direct hex-to-hex chords and coarse side-of-river heuristics break down when:

- Barriers wind through hexes (river cascade, fence runs)
- The same hex column has **parallel corridors** (west bank vs east bank at `q = -2`)
- A move is geometrically “open” along a bank but blocked by a chord that crosses barrier geometry elsewhere
- In-hex openings (gate, hole, ford, bridge) were incorrectly treated as exemptions on **inter-hex** travel paths

Earlier mid-west fixes (2026-06) addressed symptoms of a model that defaulted to **straight chords + global east/west filters + opening bypass on paths**. The current implementation uses a **two-step border-then-stand** resolver.

## Design goal

> Adjacent hex movement is a **two-step** process: (1) reach the shared border with the destination hex without crossing a barrier, then (2) enter the destination hex and stand in the best reachable place inside that hex.

Players should not need to reason about implementation details (bank column q, chord vs route). Authors mark routes, barriers, openings, and preferred stand points; the resolver applies one consistent contract everywhere.

## Two-step movement model

### Step 1 — Reach the shared border

**Question:** Can the avatar reach the shared edge with the intended destination hex?

- The approach path may follow **any polyline that does not cross a barrier** — a straight chord is fine to try first, but it is not required.
- **Marked routes** use their authored geometry as the approach path when the full polyline is barrier-clear up to the destination hex.
- When the direct chord is blocked, sample the **shared edge** between the two hexes (inside-edge nudges, partial chords along the edge).
- **Passage openings do not apply** on inter-hex paths. Barriers always block path segments during adjacent travel. (Openings are for in-hex `crossPassage` — see [barrier-passage-openings.md](barrier-passage-openings.md).)
- If no barrier-clear path reaches the shared border, the move **stops in the departure hex** before the blocking barrier.

### Step 2 — Cross in and find a stand

**Question:** From a point just inside the destination hex on the shared border, where should the avatar stand?

Priority order:

1. **Route stand** — when following a marked route, stand on the route where it enters the destination hex.
2. **Authored `standAt`** — when a barrier-clear path exists from the border entry to the authored stand **inside the destination hex**.
3. **Intended arrival point (`toPos`)** — same rule as authored stand (must be inside the destination hex).
4. **Hex center** — when reachable without crossing a barrier.
5. **Accessible side of a blocking barrier** — interior samples and `standBeforeFirstHit` along paths toward the preferred targets above; stand on the entry side of any barrier that blocks those targets.
6. **Border entry** — last resort when nothing else is reachable.

The **active hex** is whichever hex contains the final stand point (`hexAtPoint(stand)`), not merely the intended destination.

### Routes

Route-following moves use the **same two-step contract**:

- Step 1 follows the **route polyline** to the shared border (not a shortcut chord).
- Step 2 prefers standing **on the route** in the destination hex when the route continues there.
- Route moves are only offered when step 1 succeeds from the current stand.

### In-hex passage (`crossPassage`)

**Separate from inter-hex travel.** When the avatar deliberately crosses a barrier **within the same hex** (gate, hole, bridge, ford), `crossPassage` flips the stand to the opposite side of that barrier at the opening. This is how locked gates, fence holes, and river crossings work without treating openings as global path exemptions.

## Movement priority (offer + resolve)

When evaluating or executing an adjacent move:

1. **Authored route first** — if a marked route connects the hexes, build the path from route geometry.
2. **Two-step resolver** — `findReachableBorderEntry` then `resolveDestinationStand` in [`useTravelBarriers.js`](../../game/src/lib/maps/composables/useTravelBarriers.js).
3. **Neighbor filters** — gameplay rules (e.g. locked compound gate UI) may hide moves; geometry is still authoritative via `canEnterNeighbor` / `canReachNeighbor`.

## Implementation map

| Layer | Behavior |
|-------|----------|
| Step 1 | `findReachableBorderEntry` — walk polyline, shared-edge samples, partial chords; `firstBlockedOnPath` with openings stripped (`interHexTravelCtx`) |
| Step 2 | `resolveDestinationStand` — route stand → authored → `toPos` → center → accessible-side fallback |
| Block check | `firstBlockedOnPath` — barriers block; **no** `openingAllows` on travel paths |
| Routes | `buildMovePath` + route stand via `resolveArrivalStand` |
| In-hex | `crossPassage` in [`usePassageCrossing.js`](../../game/src/lib/maps/composables/usePassageCrossing.js) |
| Active hex | `hexAtPoint(finalStand)` |

## Examples

| Scenario | Step 1 | Step 2 |
|----------|--------|--------|
| Open terrain | Chord to shared edge | Authored stand or center |
| Fence between hexes | Shared-edge sample reachable along west side | Stand in destination on accessible side of fence |
| `mid-west → gate-woods` | Reach east border without crossing in-hex compound fence | Stand south of fence (center or accessible side); **not** at gate approach north of fence unless that path is barrier-clear from the approach direction |
| `south-pines → lower-stand` with fence on border | Blocked from west of fence until `crossPassage('south-pines-hole')` | Then border reachable; stand in `lower-stand` |
| `road-fork → upper-gorge` via drive | Follow route polyline to border | Stand on drive end in `upper-gorge` |

## Testing strategy

| Test | Asserts |
|------|---------|
| `midWestGateWoods.test.js` | `mid-west → gate-woods` enters hex south of compound fence |
| `midWestFord.test.js` | Ford is in-hex `crossPassage`; adjacent bank walks without ford |
| `passageGuards.test.js` | Direct-call guards for locked, hidden, wrong-hex, stale-status, and not-near-barrier passage attempts |
| `passageToggle.test.js` | Reversible in-hex passage crossing and refreshed travel options |
| `storyJourneySmoke.test.js` | Full story path stays unblocked across the current slice |
| `useTravelBarriers.test.js` | Two-step stand selection; openings irrelevant to `firstBlockedOnPath` |
| `usePassageCrossing.test.js` | Passage availability and shared crossing inset for bridge, ford, gate, and hole |

Add regression when a **move is offerable but step 1 crosses a barrier**, or when **step 2 places the stand on the wrong side of an in-hex barrier** relative to the approach direction.

## Superseded documentation (do not follow)

The following **older statements are wrong** under the unified model. They remain in git history or parallel copies; this file supersedes them.

| Location | Superseded claim |
|----------|------------------|
| **This file (prior revision)** | “A move is allowed when there exists a walkable adjacent step that crosses barriers only at authored openings.” |
| **This file (prior revision)** | `firstBlockedOnPath` table row: “openings allow crossing at intersection” for adjacent travel |
| **This file (prior revision)** | Priority list item implying openings affect inter-hex entry |
| [`barrier-passage-openings.md`](barrier-passage-openings.md) (prior overview) | “Fence and river barriers block direct hex travel **except at authored openings**” |
| [`barrier-passage-openings.md`](barrier-passage-openings.md) (prior tuning) | “Adjust `at` until `openingAllows` passes for the intended **neighbor move**” |
| [`web/src/composables/useTravelBarriers.js`](../../web/src/composables/useTravelBarriers.js) | Prototype still applies `openingAllows` on path checks — **diverges from game**; port from `game/` when syncing |

## Out of scope

- Full A* around barrier polygons
- Automatic corridor inference from river geometry
- Multi-hex paths beyond adjacent steps (auto-travel wayfinding)

## Checklist

- [x] Two-step border-then-stand resolver in `game/`
- [x] Strip openings from inter-hex path checks
- [x] Shared-edge fallback for step 1
- [x] Route stand preference in step 2
- [x] `mid-west → gate-woods` regression
- [x] Document unified contract (this file)
- [x] Update [barrier-passage-openings.md](barrier-passage-openings.md) opening scope
- [ ] Port two-step model to `web/` prototype when next syncing map code
