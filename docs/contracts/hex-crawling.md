# Hexcrawling Design

**Status:** Source of truth for outdoor hex-map movement in the playable game  
**Scope:** `game/` — `game/src/lib/maps/` and the SQLite `outdoor-main` world document  
Outdoor play is **adjacent-step hexcrawling**: the player is represented by an avatar standing at a specific point inside one hex cell. From that point, the player may move within the current cell, cross an available local passage in that cell, follow a marked route, or move to a neighboring hex when the shared border is reachable. Multi-hex auto-pathfinding is not defined yet, but the feature is allowable and welcome given the time and motivation to implement it.

---

## Purpose

This document defines how movement on the hex map (**hexcrawling**) is supposed to work in Atomic Adventures.

Goals:

1. **One contract** for adjacent travel, route following, barriers, and in-hex crossings so behavior is predictable across any hex map. The way this works must be agnostic from how any particular hex map is defined.
2. **Regression prevention** — document the approach we are taking, how the game should work from the player's perspective, to prevent unwanted behaviors and regressions.
3. **Clarity** — maintain separation of concerns. map geometry (what are the areas), handling of map features (like authored stand points, barriers and crossings, and landmarks), and gameplay logic (in-game conditions satisfied that allow an action?).
4. **Implementation alignment** — define the desired behavior first, then record where `game/` already matches it and where the implementation is still approximate, shaky, or wrong.

**Canonical code location:** `game/src/lib/maps/`. Treat `game/` as authoritative. Our primary focus is on building the integrated game.

---

## How Movement Works

### Directions

In hex map view, the avatar is always standing in one hex cell. "Avatar" and "player" are used interchangeably in this document: the player is where the avatar stands. This stand position is part of the movement state, not decoration. It determines which barriers are nearby, which side of a barrier the player is on, which passages are available, and which neighboring borders can be reached.

Each cell has up to 6 neighboring cells. At the edges of the map, a cell may have fewer than six neighbors. Because the map is drawn with north up, movement labels may use the usual compass words: north, northeast, east, southeast, south, southwest, west, northwest. The six actual neighboring hexes are still the geometry underneath; north and south labels are allowed when the destination is unambiguous, such as when the avatar is off-center, following a route, or approaching a particular border.

A move can also be directional without being a simple center-to-center neighbor step. A route defines a specific way to go. The avatar can follow a road, driveway, path, or trail even when that route bends inside the cell and exits in a direction different from the straight compass vector to the neighboring hex.

Within a cell, the avatar can move toward a landmark, an authored stand point, a barrier, an opening, or a border. The avatar can also move along a barrier without crossing it, such as walking along a riverbank or fence line.

The avatar can cross a barrier only at an available local passage in the same cell, such as a gate, bridge, ford, hole, or stair. Availability is gameplay state: found, unlocked, open, story-allowed, and so on.

### Core Idea: Reachable Borders, Then Safe Stand

Every movement option must be valid from the avatar's current stand position. The game must never offer or execute a move that makes the avatar cross a barrier illegally, appear on an unreachable side of a barrier, or stand in a place that contradicts the route just taken.

For adjacent hex movement, the contract is:

1. **Offer only reachable borders.** A neighboring hex is a valid movement option only when the avatar can reach the shared border with that neighbor from the current stand.
2. **Use the chosen path shape.** The reachability path may be a straight segment, a marked route polyline, a walk along a barrier, or a computed path around a barrier inside the reachable sub-area. A straight chord is only one candidate, not the definition of movement.
3. **Respect barriers.** A path may not cross a barrier unless it crosses at an available local passage in the same cell and the movement being resolved explicitly uses that passage.
4. **Enter through the reachable border.** If the avatar can reach the shared border, the cell on the other side is reachable. The move enters the destination cell through that border, not through its center or an arbitrary stand.
5. **Choose a safe destination stand.** After entry, the avatar stands in the best reachable place inside the destination cell. If a barrier divides the cell, first identify the barrier-bounded sub-area entered through the shared border and choose the stand inside that area.
6. **The stand decides the active hex.** The active hex after a move is whichever hex contains the final stand (`hexAtPoint(stand)`), not merely the hex the player clicked.

If no path from the current stand reaches the intended border, the movement option must not be shown. If a programmatic movement attempt is made anyway, it must fail without moving through the barrier; the avatar may remain at the current stand or stop on the current side of the blocking barrier, depending on the interaction.

### What blocks movement

**Barriers** are authored map features such as rivers, fences, cliffs, and ravines. They are defined by feature points, usually as polylines, with possible smoothing for curved features. Collision should use the same sampled curve the player sees. A barrier divides a cell into reachable sub-areas. The avatar may move within a sub-area and along the barrier edge, but may not cross into another sub-area except through an available local passage.

Barriers block path segments that strictly cross them. Walking parallel to a barrier, standing on one side of it, or following its bank/edge does not count as crossing. A stand is not safe merely because a path to it does not strictly cross the barrier: the stand itself must have visible clearance from every barrier. The avatar must never finish on or touching a barrier. Barrier-adjacent stands should keep a small visible gap so the avatar does not stand on top of the barrier. Endpoint and grazing cases should be handled conservatively: if the visual intent is that the barrier blocks movement, authored geometry and tests should make that unambiguous.

**Local passages** are authored openings in a barrier inside a cell: gate, hole, bridge, ford, stair, and future equivalents. A passage can allow the avatar to cross that local barrier when the passage is available and the avatar is close enough or otherwise eligible to use it. After crossing any passage type, the avatar should stand near the passage on the far side, separated from the barrier by a consistent inset that is large enough for the player to see that the avatar is through the passage.

Inter-hex travel should not treat openings as vague global exemptions. If a move crosses a barrier at a passage, the path must actually go through that passage in the same cell. In Part I, the player-facing model is explicit: crossing a barrier at a gate, bridge, ford, or hole is normally its own local movement action, after which adjacent movement is evaluated from the new stand. A future route may combine passage use and border movement into one authored route move, but it must still respect the same local-passage rule.

### Destination Stand Priority

When the player chooses an adjacent move, first determine the reachable entry point or entry segment on the shared border. Then determine whether barriers divide the destination cell and which barrier-bounded sub-area contains that entry. All destination stand candidates must be reachable within that entered sub-area and must have visible clearance from its barriers.

1. **Route stand.** If following a marked route, stand on the route where it naturally places the avatar inside the destination cell: an authored route target, route endpoint, or stable point along the route in that cell.
2. **Authored stand point in the entered sub-area.** If the destination cell has one or more authored preferred stand points, choose the best one that is reachable from the entry border without crossing a barrier and has safe barrier clearance. A stand point on the other side of a barrier does not apply to this arrival.
3. **Barrier-side area stand.** If a barrier divides the destination cell, this is a special case handled before the generic center default. Choose a stable point roughly central to the entered sub-area formed by the barrier and cell borders, with safe visible clearance from the barrier. This may be an authored point, a computed interior point, or a point beside the barrier when the movement naturally ends there.
4. **Barrier-adjacent stop.** If the intended path or preferred target meets a barrier, standing near the relevant barrier segment on the entered side is acceptable, inset by the normal visible gap. Do not place the avatar directly on the intersection or barrier line.
5. **Hex center default.** In a cell that is not divided by a barrier, or when the center is clearly inside the entered sub-area with safe barrier clearance, the center is the final common stand after route, authored, and barrier-side conditions have been considered. It does not mean “try the center first.”
6. **Border entry.** If no better stable stand can be found, stand just inside the destination cell at the reachable border entry, adjusted as needed to preserve barrier clearance.

The presence of a barrier through a cell is itself a special condition. The resolver must not accept the center merely because the center is technically reachable or because a path to it does not register a strict crossing. A center that lies on, touches, or crowds a river, fence, cliff, or ravine is not a valid stand.

### Finding Reachable Paths

Reachability cannot depend only on the straight chord from current stand to target. For example, a curvy river might block direct access to a border that is perfectly accessible by walking around or along the river, the way a real person would.

The resolver should use an appropriate algorithm like one or more of the following:

1. **Known path geometry** — follow an authored route polyline, road, trail, driveway, or explicit walk segment when one is the intended move.
2. **Simple direct path** — try a straight segment to the border or stand target.
3. **Accessible sub-area search** — search within the current barrier-bounded sub-area for a path to the intended border or stand.
4. **Perimeter sweep** - One method is to trace the perimeter of the sub-area defined by the barrier and cell borders, taking note of each border that is found. Once the trace returns to the starting point, the list of available borders is complete.

However this is accomplished, it needs to be consistent and accurate. This does not require a full global pathfinder. It does require local reasoning about the part of the cell the avatar can actually occupy.

### Routes

Marked routes (`trail`, `road`, `drive`, etc.) are authored walkable paths. Route movement uses the same reachability and stand-placement contract, with the route polyline as the primary path shape:

- **Offering:** A route move is shown only if the avatar can legally reach and follow the route to the relevant border or destination stand.
- **Path:** `buildMovePath` slices the route samples between the current position and the destination hex.
- **Stand:** Destination placement prefers standing on the route in the destination hex when the route continues there.
- **Label:** Route move labels use the **path tangent** at the hex exit (e.g. “Go northeast”), not the hex-center compass vector.

### In-hex passage (`crossPassage`)

In Part I, passage crossing is modeled as a local movement action. The player chooses an action such as “Cross the bridge” or “Go through the gate.” The avatar stays in the same hex; the stand moves to the far side of the barrier at the opening. Subsequent adjacent movement is then evaluated from that new stand.

The stand rule is the same for every passage type:

1. **Stay near the passage.** Crossing should not send the avatar to the hex center, an authored cell stand, or a distant route point. The new stand should remain visually tied to the opening just used.
2. **Stand on the far side.** The new stand must be in the reachable sub-area on the opposite side of the barrier from the previous stand.
3. **Use a consistent inset.** The avatar should be offset from the barrier by the same passage-crossing separation everywhere unless a specific passage needs an authored override. The inset must be far enough that the sprite/icon visibly clears the barrier.
4. **Keep the stand legal.** If the ideal inset point would leave the cell, overlap another barrier, or land in an unreachable sub-area, choose the nearest legal point that preserves "near the passage, on the far side."

| Opening | Visibility | Passage                      | Notes                                          |
| ------- | ---------- | ---------------------------- | ---------------------------------------------- |
| Gate    | Obvious    | When opened                  | Compound gate: player open/close state         |
| Bridge  | Obvious    | Always (when on river bank)  |                                                |
| Hole    | Hidden     | After search reveals it      | Pre-cut breach at `south-pines`                |
| Ford    | Hidden     | After search                 | Also demonstrates river crossing at `the-flats` |

River crossings require bank proximity (`isOnRiverBank`). All passage crossings use the same placement rule: near the opening, on the far side, with consistent visible separation from the barrier.

### Movement options the player sees

From the current hex, the play panel combines:

1. **Route moves** — destinations reachable via marked routes (`availableMoves`).
2. **Direct moves** — adjacent hexes not already covered by a route (`directNeighbors`).
3. **Passage crossings** — in-hex `crossPassage` actions (`availablePassageCrossings`).
4. **Passage toggle actions** — open/close actions for gates at the current barrier.
5. **Passage unlock actions** — optional authored actions for a passage whose requirements are not yet satisfied.

**Deduping:** If a neighbor is reachable by route, it is omitted from direct moves.

Passage requirements affect whether the local crossing action is available. They do not add map-specific filters to route or adjacent movement. Ordinary barrier geometry remains responsible for preventing movement through the locked passage.

Action button edge colors should reflect the same map feature kind and palette
used by the map legend when the action corresponds to a visible terrain, route,
barrier, or passage. For example, forest/open walking uses the forest green,
roads use the road color, trails use the trail color, rivers use the river
color, and fences/gates use the fence color. Story choices should not get a
special "preferred path" color; story text can suggest a best path, but the UI
must preserve player agency by not visually marking story choices as the
correct route.

### Player state relevant to movement

| Field                | Meaning                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| `currentId`          | Active hex                                                                             |
| `stand` `{ x, y }`   | Avatar position in world pixels                                                        |
| `discovered`         | Hexes revealed on the map (fog)                                                        |
| `mode`               | Map view mode: `gameplay` (default) or `full` — see [map-viewport.md](map-viewport.md) |
| `discoveredOpenings` | Hidden openings revealed by search                                                     |
| `lastBlocked`        | Barrier kind that blocked the last failed move                                         |
| `atBarrier`          | Barrier kind the avatar is considered “at” (status lines, search, crossings)           |
| `traveling`          | Short animation guard (~650ms) after `moveTo`                                          |

---

## Current Implementation Details

This section describes the current `game/` implementation. It is not the full design contract above. Where this section disagrees with **How Movement Works**, the design contract is authoritative and the implementation should be corrected.

### End-to-end flow

```
Play panel movement options
  → route moves (availableMoves) + direct moves (directNeighbors)
  → each filtered by canEnterNeighbor → resolveMove

moveTo(hexId)
  → canReachHex → canEnterNeighbor → resolveMove
  → applyMove(hexId, stand, atBarrier, lastBlocked)

crossPassage(openingId)
  → shouldOfferPassageCrossing → standAcrossOpening (same hex)
  → apply authored on_cross effects
```

### Code map

| Concern                                          | File                                                                                 | Key exports                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Orchestration, state, `moveTo`                   | [`useOutdoorWorld.js`](../../game/src/lib/maps/composables/useOutdoorWorld.js)       | `moveTo`, `canReachHex`, `moves`, `directMoves`, `crossPassage`, `travelBarrierCtx` |
| Current adjacent-move resolver, barrier geometry | [`useTravelBarriers.js`](../../game/src/lib/maps/composables/useTravelBarriers.js)   | `resolveMove`, `canEnterNeighbor`, `firstBlockedOnPath`, `firstBlockedOnPathInHex`  |
| Routes, move lists                               | [`useRoutes.js`](../../game/src/lib/maps/composables/useRoutes.js)                   | `availableMoves`, `directNeighbors`, `buildMovePath`, `routeLegBetween`             |
| Stand hints (`toPos`)                            | [`useAvatarStand.js`](../../game/src/lib/maps/composables/useAvatarStand.js)         | `resolveAvatarPosition`, `resolveNeighborStand`, `hexCenterStand`                   |
| In-hex crossings                                 | [`usePassageCrossing.js`](../../game/src/lib/maps/composables/usePassageCrossing.js) | `standAcrossOpening`, `availablePassageCrossings`, `shouldOfferPassageCrossing`     |
| Opening models, discovery                        | [`useBarrierOpenings.js`](../../game/src/lib/maps/composables/useBarrierOpenings.js) | `travelOpenings`, `hiddenOpeningsInHex`, `resolveOpeningPosition`                   |
| Passage requirements and effects                 | [`usePassageState.js`](../../game/src/lib/maps/composables/usePassageState.js)       | `filterAvailablePassages`, `applyPassageUnlock`, `applyPassageCrossEffects`         |
| Barrier-adjacent stands, status                  | [`useBarrierStand.js`](../../game/src/lib/maps/composables/useBarrierStand.js)       | `BARRIER_STAND_INSET`, `barrierHintAtStand`, `isNearBarrierKind`                    |
| Hex geometry                                     | [`useHexGeometry.js`](../../game/src/lib/maps/composables/useHexGeometry.js)         | `pixelToHex`, `hexDistance`, `axialToPixel`                                         |
| Play panel wiring                                | [`usePlayPanel.js`](../../game/src/composables/usePlayPanel.js)                      | `getMovementOptions`, `buildOutdoorStatusLines`                                     |
| Save/load                                        | [`useGameState.js`](../../game/src/composables/useGameState.js)                      | outdoor snapshot includes `stand`, `discoveredOpenings`                             |

### `resolveMove` (current two-phase resolver)

**Step 1 — `findReachableBorderEntry`**

1. If `walkPath` is barrier-clear, walk backward for the last point in the destination hex that is **near the shared edge** (`distance ≤ size × 0.2`).
2. Else try direct chords to `toPos` (if near edge) and shared-edge inside samples (five points along edge at t = 0.15…0.85, nudged inward).
3. Else partial interpolation from `fromPos` toward each inside-edge sample (t = 0.1…0.9).
4. Else run a local cell-bounded search from the current stand to shared-edge samples, with conservative clearance around joined barrier endpoints.

All checks use `interHexTravelCtx(ctx)` which sets `openings: []`. In the current Part I implementation, adjacent movement never consumes passages; passages are separate `crossPassage` actions.

**Step 2 — `resolveDestinationStand`**

The resolver first detects barriers that intersect the destination cell. Route and authored targets are accepted only when they are reachable from the entry point and have the normal visible barrier clearance.

- **Barrier-free cell:** route/authored target → requested target → center → best interior candidate.
- **Barrier-divided cell:** route/authored target in the entered sub-area → requested target when safe → reachable interior candidates ranked by clearance from both barriers and cell borders → barrier-adjacent stop → center only when it is genuinely safe and reachable in the entered sub-area → border entry.

This is a sampled approximation of the entered sub-area rather than an explicit polygon decomposition. It deliberately treats the hex center as a late candidate, not the first successful point in a barrier-divided cell.

`standInDestinationHex` rejects targets outside the destination hex (via `pixelToHex` + hex coord map).

**Failure — `resolveBlockedDeparture`**

If step 1 fails, stop before the first barrier hit along `walkPath` or the chord `[fromPos, toPos]` in the departure hex.

**Result**

```javascript
{
  stand,           // final world position
  activeHexId,     // hexAtPoint(stand, toHex.id)
  blockedKind,     // non-null if stopped at in-hex barrier in destination
  path,            // approach + optional stand leg
}
```

### Movement authority

Adjacent move options and execution use one geometry authority:

- `resolveMove` computes the actual stand, active hex, and barrier stop.
- `canEnterNeighbor` means `resolveMove(...).activeHexId === toHex.id`.
- Entering a hex is enough for map/story purposes even when destination placement stops the avatar at an in-hex barrier.
- A "clean arrival" with no `blockedKind` can be derived from `resolveMove` where needed; it is not a separate movement predicate.

### `resolveNeighborStand` vs final stand

`resolveNeighborStand(from, to, …)` returns a **naive target** for path building: the first authored stand if present, else hex center. It **ignores** `fromPos` and `barrierCtx`. The actual stand after `resolveMove` may differ (accessible side, route point, etc.).

### Barrier crossing geometry

- **`segmentIntersection`** — hit must lie on both segments (finite segments, not infinite lines).
- **`pathCrossesBarrier`** — endpoints on opposite sides of the barrier line (`sideOfLine`).
- **`PATH_ORIGIN_EPS` (0.02)** — ignores hits at the start of a segment so the avatar does not block itself.
- **Grazing / endpoint gaps** — a path can pass near a fence endpoint without counting as a crossing if the intersection falls outside the barrier segment’s y/x extent. This is geometrically correct but can surprise authors if fence segments are short (see Implementation Punch List).
- **Passage side checks** — passage eligibility and far-side placement use the same sampled barrier segment at the opening. On a curved river or fence, the segment nearest the avatar may have a different tangent and must not be substituted for the opening-local segment.

### `travelBarrierCtx`

```javascript
{
  barriers: barrierSegments(featureModels),  // fence, river, cliff, ravine polylines
  allOpenings: travelOpenings(...),          // discovered passages, including locked
  openings: filterAvailablePassages(...),    // passages whose authored requirements pass
}
```

`allOpenings` supports locked-passage actions and markers; `openings` drives crossing availability.

### Authored passage locks

1. **Requirement** — a passage may define `require` using the shared flag condition format. Until satisfied, it is omitted from `ctx.openings` and cannot be crossed.
2. **Unlock action** — a passage may define `unlock` with player-facing `label` / `status` text and `set_flags`. The action is offered only from the same eligibility position that would allow crossing the passage.
3. **Crossing effects** — a passage may define `on_cross.set_flags`, applied after a successful crossing.
4. **Adjacent movement** — no passage ID, hex ID, destination ID, or coordinate-side heuristic participates in route or adjacent-move eligibility. The barrier itself blocks illegal movement.

Gates use explicit player state for open/closed behavior. In gameplay, a gate crossing is available only while its `passageStates[gateId]` value is `true`; opening and closing the gate updates that state and save/load preserves it like door state.

### Opening discovery

- **Obvious** openings always in `travelOpenings`.
- **Hidden** openings added after `searchBarrier()` appends id to `discoveredOpenings`.
- Search is offered when `atBarrier` or `lastBlocked` matches the opening’s barrier kind.

### Part I authored openings

| ID                   | Kind   | Hex           | Role                                                                                |
| -------------------- | ------ | ------------- | ----------------------------------------------------------------------------------- |
| `compound-gate`      | gate   | `gate-woods`  | In-hex passage; player opens/closes it                                              |
| `south-pines-hole`   | hole   | `south-pines` | Search → `crossPassage` → then `lower-stand`                                        |
| `upper-gorge-bridge` | bridge | `upper-gorge` | `crossPassage` → then `lower-gorge`                                                  |
| `the-flats-ford`      | ford   | `the-flats`    | Search → `crossPassage`; bank walk to `utility-yard` without ford on inter-hex path |

### Authoring Snapshot Reference

**Hex `stands` forms:**

```yaml
stands:
  - id: gate
    label: "Gate"
    at: { x: -81, y: -76 }                  # fixed world coords
  - id: entrance
    at: { from: landmark, dx: 0.1, dy: 0 }  # beside building icon
  - id: river-bank
    at: { dx: -0.3, dy: 0.1 }               # offset from hex center
```

**Openings:**

```yaml
- id: upper-gorge-bridge
  kind: bridge
  hex: upper-gorge
  visibility: obvious
  at: { x: -155, y: -113 }
```

Optional crossing effects are authored on the passage itself:

```yaml
on_cross:
  set_flags: [compound.gate-passed]
```

**Tuning:** Adjust opening `at` until **`crossPassage`** places the avatar correctly and journey tests pass. In the current Part I implementation, do not tune openings against neighbor moves; adjacent movement does not consume openings.

### Test harnesses

| Harness                                                                  | Use when                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [`travelWorld.js`](../../game/src/lib/maps/testing/travelWorld.js)       | Pure geometry — `evaluateNeighborMove`, no gameplay flags             |
| [`gameplayTravel.js`](../../game/src/lib/maps/testing/gameplayTravel.js) | Full `useOutdoorWorld` + `gameState` — passage locks, `moveTo`, flags |

### Regression tests (representative)

| Test file                                                 | Covers                                                  |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `useTravelBarriers.test.js`                               | Current resolver, geometry, enterability                |
| `midWestGateWoods.test.js`                                | `the-flats → gate-woods` enters south of fence           |
| `midWestFord.test.js`                                     | West-bank arrival clearance; search → ford action; crossing and adjacent walks |
| `openingDiscovery.test.js`                                | Hole → `crossPassage`, not opening bypass on neighbors  |
| `compoundGateGameplay.test.js`                            | Gate lock UI, passage, south moves after cross          |
| `storyJourneySmoke.test.js`                               | Mainline journey with gameplay stack                    |
| `barrierStatus.test.js`                                   | Status lines, `atBarrier`, hole before `lower-stand`    |
| `usePassageCrossing.test.js`                              | Bridge/ford stand flip, bank gating                     |
| `usePassageState.test.js`                                 | Generic passage requirements, unlocks, crossing effects |
| `useGameState.test.js`                                    | Stand and discovered-opening save/load round trips      |
| `useMapBuilder.test.js`                                   | Passage feature serialization for builder export        |
| `gateWoodsDeparture.test.js`, `westBankGateWoods.test.js` | Gate-woods / west-bank columns                          |
| `landmarkReachability.test.js`                            | Landmark stands vs barriers                             |
| `mapMovementAudit.test.js`                               | All 54 directed adjacencies across 23 canonical barrier-side states; passages both ways |

Run: `npm run test` from repo root.

For the map-specific movement matrix and a row-by-row diagnostic report, run:

```bash
npm run test:movement
```

In a development game build, use **Show movement audit** above the outdoor map. The overlay uses the same checked-in state manifest as the automated test: green paths are expected valid moves, gray dashed paths are expected blocked directions, and red paths indicate a mismatch in entry, stand safety, barrier crossing, or arrival region. Select one canonical state to inspect overlapping paths clearly.

### Worked examples

| Scenario                                    | Border reachability                                            | Destination stand                                                            |
| ------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Open terrain                                | Chord or route to shared edge                                  | Authored stand or center                                                     |
| `the-flats → gate-woods`                     | Reach east border without crossing compound fence              | Stand south of fence (center or accessible side)                             |
| `north-bend → gate-woods` via compound road | Follow route polyline to border                                | Route stand / gate approach **if** barrier-clear from entry (north of fence) |
| `south-pines → lower-stand`                 | Blocked west of fence until `crossPassage('south-pines-hole')` | Stand in `lower-stand`                                                       |
| `road-fork → upper-gorge`                   | Follow `river-access-drive`                                    | Stand on drive at east bank                                                  |
| `upper-gorge → lower-gorge`                  | Inter-hex movement after bridge crossing                       | West-bank stand in `lower-gorge`                                              |
| `lower-gorge → the-flats`                   | Enter on the west side of the river                             | Stable west-side area stand with visible river clearance                     |

### Northern approach (play sequence)

1. `origin → … → road-fork → upper-gorge` via `river-access-drive`
2. `crossPassage('upper-gorge-bridge')`, then `upper-gorge → lower-gorge`
3. West bank: `lower-gorge → the-flats` (river blocks center chord — use bank geometry / shared edge)
4. Search ford at `the-flats`; `the-flats → utility-yard` on west bank without requiring ford on inter-hex path
5. Southern fence: `crossPassage` through gate/hole where needed before inter-hex steps

---

## Implementation Punch List

These are the remaining movement tasks. Completed work and standing maintenance rules belong in the contract and test inventory above, not in this list.

### Geometry and stands

1. **As needed: replace sampled local search with explicit reachable sub-areas.** Try this when authored geometry exposes a failure that the current resolver cannot handle reliably, such as a U-shaped barrier, three or more barrier-bounded areas in one cell, a narrow corridor, an endpoint-connected enclosure, or an approach-dependent stand that requires walking around a barrier end. The upgrade should determine the entry-side sub-area, use it for border reachability and stand selection, prefer the barrier-side stand described above, and make endpoint blocking topological rather than sample-dependent. Do not undertake this deeper rewrite without a concrete failing map case or content requirement. **Implementation plan:** [reachable-sub-areas.md](../plans/reachable-sub-areas.md).

---

## Document history

| Date    | Change                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06 | Initial source-of-truth doc; consolidates `barrier-pathfinding.md` and `barrier-passage-openings.md`; aligned to `game/` two-step implementation |
| 2026-06 | Renamed to `docs/designs/hex-crawling.md`; references updated                                                                                   |
| 2026-06 | Moved to `docs/design/hex-crawling.md` alongside other design contracts                                                                         |
| 2026-06 | Moved to `docs/contracts/hex-crawling.md`; top-level `design/` renamed to `game-design/`                                                        |
| 2026-06 | Deleted superseded plans `barrier-pathfinding.md` and `barrier-passage-openings.md`                                                              |
