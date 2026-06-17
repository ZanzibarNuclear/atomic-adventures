# Hexcrawling Design

**Status:** Source of truth for outdoor hex-map movement in the playable game  
**Scope:** `game/` — `game/src/lib/maps/` and `game/content/world/map.yaml`  
**Supersedes:** [`docs/plans/barrier-pathfinding.md`](../plans/barrier-pathfinding.md), [`docs/plans/barrier-passage-openings.md`](../plans/barrier-passage-openings.md) (historical; safe to delete when no longer linked)

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

**Ignore the prototype:** Everything under `web/` is part of an early mapping prototype (outdoor and indoor) that is quickly becoming outdated. We will delete or refresh it at some point.

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
4. **Enter through the reachable border.** If the avatar can reach the shared border, the cell on the other side is reachable. The move enters the destination cell through that border, not through its center or an arbitrary `standAt`.
5. **Choose a safe destination stand.** After entry, the avatar stands in the best reachable place inside the destination cell. Barriers inside the destination cell can restrict that placement.
6. **The stand decides the active hex.** The active hex after a move is whichever hex contains the final stand (`hexAtPoint(stand)`), not merely the hex the player clicked.

If no path from the current stand reaches the intended border, the movement option must not be shown. If a programmatic movement attempt is made anyway, it must fail without moving through the barrier; the avatar may remain at the current stand or stop on the current side of the blocking barrier, depending on the interaction.

### What blocks movement

**Barriers** are authored map features such as rivers, fences, cliffs, and ravines. They are defined by feature points, usually as polylines, with possible smoothing for curved features. Collision should use the same sampled curve the player sees. A barrier divides a cell into reachable sub-areas. The avatar may move within a sub-area and along the barrier edge, but may not cross into another sub-area except through an available local passage.

Barriers block path segments that strictly cross them. Walking parallel to a barrier, standing on one side of it, or following its bank/edge does not count as crossing. Barrier-adjacent stands should keep a small visible gap so the avatar does not stand on top of the barrier. Endpoint and grazing cases should be handled conservatively: if the visual intent is that the barrier blocks movement, authored geometry and tests should make that unambiguous.

**Local passages** are authored openings in a barrier inside a cell: gate, hole, bridge, ford, stair, and future equivalents. A passage can allow the avatar to cross that local barrier when the passage is available and the avatar is close enough or otherwise eligible to use it. After crossing any passage type, the avatar should stand near the passage on the far side, separated from the barrier by a consistent inset that is large enough for the player to see that the avatar is through the passage.

Inter-hex travel should not treat openings as vague global exemptions. If a move crosses a barrier at a passage, the path must actually go through that passage in the same cell. In Part I, the player-facing model is explicit: crossing a barrier at a gate, bridge, ford, or hole is normally its own local movement action, after which adjacent movement is evaluated from the new stand. A future route may combine passage use and border movement into one authored route move, but it must still respect the same local-passage rule.

### Destination Stand Priority

When the player chooses an adjacent move, first determine the reachable entry point or entry segment on the shared border. Then choose the destination stand from that entry position.

1. **Route stand.** If following a marked route, stand on the route where it naturally places the avatar inside the destination cell: an authored route target, route endpoint, or stable point along the route in that cell.
2. **Authored stand point.** If the destination cell has one or more authored preferred stand points, choose the best one that is reachable from the entry border without illegally crossing a barrier.
3. **Hex center.** If no authored stand is reachable, use the center of the destination cell when it is reachable within the same accessible sub-area.
4. **Barrier-side stand.** If preferred stands and center are blocked by a barrier inside the destination cell, stand inside the reachable sub-area created by the barrier and the nearest borders to the entry point. Prefer a stable point near the midpoint of the blocking barrier segment within that sub-area, inset slightly on the accessible side.
5. **Border entry.** If no better stable stand can be found, stand just inside the destination cell at the reachable border entry.

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
| Gate    | Obvious    | When unlocked / story allows | Compound gate: puzzle + flags                  |
| Bridge  | Obvious    | Always (when on river bank)  |                                                |
| Hole    | Hidden     | After search reveals it      | Pre-cut breach at `south-pines`                |
| Ford    | Hidden     | After search                 | Also demonstrates river crossing at `mid-west` |

River crossings require bank proximity (`isOnRiverBank`). All passage crossings use the same placement rule: near the opening, on the far side, with consistent visible separation from the barrier.

### Movement options the player sees

From the current hex, the play panel combines:

1. **Route moves** — destinations reachable via marked routes (`availableMoves`).
2. **Direct moves** — adjacent hexes not already covered by a route (`directNeighbors`).
3. **Passage crossings** — in-hex `crossPassage` actions (`availablePassageCrossings`).
4. **Story / puzzle actions** — e.g. “Solve the puzzle to unlock” at the locked compound gate.

**Deduping:** If a neighbor is reachable by route, it is omitted from direct moves.

**Gameplay gates (not geometry):**

- **Locked compound gate** — while in `gate-woods`, north of the gate, and gate not passed: southward moves and `west-slope` are unavailable. The UI and `moveTo` must enforce the same rule.
- **West-bank drive** — while west of the river, hide route moves that are `drive` kind or target `road-fork` (`availableMoves` only).

### Player state relevant to movement

| Field                | Meaning                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `currentId`          | Active hex                                                                   |
| `stand` `{ x, y }`   | Avatar position in world pixels                                              |
| `discovered`         | Hexes revealed on the map (fog)                                              |
| `discoveredOpenings` | Hidden openings revealed by search                                           |
| `lastBlocked`        | Barrier kind that blocked the last failed move                               |
| `atBarrier`          | Barrier kind the avatar is considered “at” (status lines, search, crossings) |
| `traveling`          | Short animation guard (~650ms) after `moveTo`                                |

---

## Current Implementation Details

This section describes the current `game/` implementation. It is not the full design contract above. Where this section disagrees with **How Movement Works**, the design contract is authoritative and the implementation should be corrected.

### End-to-end flow

```
Play panel movement options
  → route moves (availableMoves) + direct moves (directNeighbors)
  → each filtered by canEnterNeighbor → resolveMove
  → gameplay gates

moveTo(hexId)
  → canReachHex → gameplay gates + canEnterNeighbor → resolveMove
  → applyMove(hexId, stand, atBarrier, lastBlocked)

crossPassage(openingId)
  → shouldOfferPassageCrossing → standAcrossOpening (same hex)
  → markCompoundGatePassed when compound-gate
```

### Code map

| Concern                                          | File                                                                                 | Key exports                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Orchestration, state, `moveTo`                   | [`useOutdoorWorld.js`](../../game/src/lib/maps/composables/useOutdoorWorld.js)       | `moveTo`, `canReachHex`, `moves`, `directMoves`, `crossPassage`, `travelBarrierCtx`                                        |
| Current adjacent-move resolver, barrier geometry | [`useTravelBarriers.js`](../../game/src/lib/maps/composables/useTravelBarriers.js)   | `resolveMove`, `canEnterNeighbor`, `firstBlockedOnPath`, `firstBlockedOnPathInHex` |
| Routes, move lists                               | [`useRoutes.js`](../../game/src/lib/maps/composables/useRoutes.js)                   | `availableMoves`, `directNeighbors`, `buildMovePath`, `routeLegBetween`                                                    |
| Stand hints (`toPos`)                            | [`useAvatarStand.js`](../../game/src/lib/maps/composables/useAvatarStand.js)         | `resolveAvatarPosition`, `resolveNeighborStand`, `hexCenterStand`                                                          |
| In-hex crossings                                 | [`usePassageCrossing.js`](../../game/src/lib/maps/composables/usePassageCrossing.js) | `standAcrossOpening`, `availablePassageCrossings`, `shouldOfferPassageCrossing`                                            |
| Opening models, discovery                        | [`useBarrierOpenings.js`](../../game/src/lib/maps/composables/useBarrierOpenings.js) | `travelOpenings`, `hiddenOpeningsInHex`, `resolveOpeningPosition`                                                          |
| Barrier-adjacent stands, status                  | [`useBarrierStand.js`](../../game/src/lib/maps/composables/useBarrierStand.js)       | `BARRIER_STAND_INSET`, `barrierHintAtStand`, `isNearBarrierKind`                                                           |
| Compound gate story                              | [`useCompoundGate.js`](../../game/src/lib/maps/composables/useCompoundGate.js)       | `filterOpeningsForGateState`, `isNorthOfCompoundGate`, gate flags                                                          |
| Hex geometry                                     | [`useHexGeometry.js`](../../game/src/lib/maps/composables/useHexGeometry.js)         | `pixelToHex`, `hexDistance`, `axialToPixel`                                                                                |
| Play panel wiring                                | [`usePlayPanel.js`](../../game/src/composables/usePlayPanel.js)                      | `getMovementOptions`, `buildOutdoorStatusLines`                                                                            |
| Save/load                                        | [`useGameState.js`](../../game/src/composables/useGameState.js)                      | outdoor snapshot includes `stand`, `discoveredOpenings`                                                                    |

### `resolveMove` (current two-phase resolver)

**Step 1 — `findReachableBorderEntry`**

1. If `walkPath` is barrier-clear, walk backward for the last point in the destination hex that is **near the shared edge** (`distance ≤ size × 0.2`).
2. Else try direct chords to `toPos` (if near edge) and shared-edge inside samples (five points along edge at t = 0.15…0.85, nudged inward).
3. Else partial interpolation from `fromPos` toward each inside-edge sample (t = 0.1…0.9).
4. Else run a local cell-bounded search from the current stand to shared-edge samples, with conservative clearance around joined barrier endpoints.

All checks use `interHexTravelCtx(ctx)` which sets `openings: []`. In the current Part I implementation, adjacent movement never consumes passages; passages are separate `crossPassage` actions.

**Step 2 — `resolveDestinationStand`**

Preferred stands: `resolveArrivalStand` (routes) → authored → `toPos` → center → `hexInteriorCandidates` → `standBeforeFirstHit` → `entryPoint`. Preferred stands use the local cell-bounded search when direct reachability is blocked. Interior fallback samples are still direct-check only. This approximates the intended destination stand priority, but does not yet explicitly model the reachable sub-area or barrier-midpoint fallback described above.

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

`resolveNeighborStand(from, to, …)` returns a **naive target** for path building: destination `standAt` if authored, else hex center. It **ignores** `fromPos` and `barrierCtx`. The actual stand after `resolveMove` may differ (accessible side, route point, etc.).

### Barrier crossing geometry

- **`segmentIntersection`** — hit must lie on both segments (finite segments, not infinite lines).
- **`pathCrossesBarrier`** — endpoints on opposite sides of the barrier line (`sideOfLine`).
- **`PATH_ORIGIN_EPS` (0.02)** — ignores hits at the start of a segment so the avatar does not block itself.
- **Grazing / endpoint gaps** — a path can pass near a fence endpoint without counting as a crossing if the intersection falls outside the barrier segment’s y/x extent. This is geometrically correct but can surprise authors if fence segments are short (see Implementation Punch List).

### `travelBarrierCtx`

```javascript
{
  barriers: barrierSegments(featureModels),  // fence, river, cliff, ravine polylines
  allOpenings: travelOpenings(...),          // includes hidden until discovered
  openings: filterOpeningsForGateState(...), // compound-gate removed when locked
}
```

`allOpenings` is used for north/south gate heuristics; `openings` drives passage UI.

### Compound gate layers

1. **Opening filter** — locked gate removes `compound-gate` from `ctx.openings` → no “Go through the gate” in passage list.
2. **Move gate** — north of gate → reject south moves and `west-slope` in both move lists and `moveTo`.
3. **Puzzle UI** — `atLockedCompoundGate` → solve puzzle action.
4. **`crossPassage('compound-gate')`** — sets `compound.gate-passed` flag.
5. **Position heuristic** — in `gate-woods`, south of gate opening y → treated as gate passed even without flag.

North/south of gate uses **y vs gate opening y**, not fence segment geometry.

### Opening discovery

- **Obvious** openings always in `travelOpenings`.
- **Hidden** openings added after `searchBarrier()` appends id to `discoveredOpenings`.
- Search is offered when `atBarrier` or `lastBlocked` matches the opening’s barrier kind.

### Part I authored openings

| ID                   | Kind   | Hex           | Role                                                                                |
| -------------------- | ------ | ------------- | ----------------------------------------------------------------------------------- |
| `compound-gate`      | gate   | `gate-woods`  | In-hex passage; story lock                                                          |
| `south-pines-hole`   | hole   | `south-pines` | Search → `crossPassage` → then `lower-stand`                                        |
| `upper-gorge-bridge` | bridge | `upper-gorge` | `crossPassage` → then `north-west`                                                  |
| `mid-west-ford`      | ford   | `mid-west`    | Search → `crossPassage`; bank walk to `utility-yard` without ford on inter-hex path |

### Authoring reference (`map.yaml`)

**Hex `standAt` forms:**

```yaml
standAt: { x: -81, y: -76 }              # fixed world coords
standAt: { from: landmark, dx: 0.1, dy: 0 } # beside building icon
standAt: { dx: -0.3, dy: 0.1 }             # offset from hex center
```

**Openings:**

```yaml
- id: upper-gorge-bridge
  kind: bridge
  hex: upper-gorge
  visibility: obvious
  at: { x: -155, y: -113 }
```

**Tuning:** Adjust opening `at` until **`crossPassage`** places the avatar correctly and journey tests pass. In the current Part I implementation, do not tune against neighbor-move `openingAllows`; adjacent movement does not consume openings.

### Test harnesses

| Harness                                                                  | Use when                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`travelWorld.js`](../../game/src/lib/maps/testing/travelWorld.js)       | Pure geometry — `evaluateNeighborMove`, no gate UI filters          |
| [`gameplayTravel.js`](../../game/src/lib/maps/testing/gameplayTravel.js) | Full `useOutdoorWorld` + `gameState` — gate puzzle, `moveTo`, flags |

### Regression tests (representative)

| Test file                                                 | Covers                                                 |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `useTravelBarriers.test.js`                               | Current resolver, geometry, enterability               |
| `midWestGateWoods.test.js`                                | `mid-west → gate-woods` enters south of fence          |
| `midWestFord.test.js`                                     | Ford `crossPassage`; west-bank adjacent walks          |
| `openingDiscovery.test.js`                                | Hole → `crossPassage`, not opening bypass on neighbors |
| `compoundGateGameplay.test.js`                            | Gate lock UI, passage, south moves after cross         |
| `storyJourneySmoke.test.js`                               | Mainline journey with gameplay stack                   |
| `barrierStatus.test.js`                                   | Status lines, `atBarrier`, hole before `lower-stand`   |
| `usePassageCrossing.test.js`                              | Bridge/ford stand flip, bank gating                    |
| `gateWoodsDeparture.test.js`, `westBankGateWoods.test.js` | Gate-woods / west-bank columns                         |
| `landmarkReachability.test.js`                            | Landmark stands vs barriers                            |

Run: `npm run test` from repo root.

### Worked examples

| Scenario                                    | Border reachability                                            | Destination stand                                                            |
| ------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Open terrain                                | Chord or route to shared edge                                  | Authored stand or center                                                     |
| `mid-west → gate-woods`                     | Reach east border without crossing compound fence              | Stand south of fence (center or accessible side)                             |
| `north-bend → gate-woods` via compound road | Follow route polyline to border                                | Route stand / gate approach **if** barrier-clear from entry (north of fence) |
| `south-pines → lower-stand`                 | Blocked west of fence until `crossPassage('south-pines-hole')` | Stand in `lower-stand`                                                       |
| `road-fork → upper-gorge`                   | Follow `river-access-drive`                                    | Stand on drive at east bank                                                  |
| `upper-gorge → north-west`                  | Inter-hex movement after bridge crossing                       | West-bank stand in `north-west`                                              |

### Northern approach (play sequence)

1. `trailhead → … → road-fork → upper-gorge` via `river-access-drive`
2. `crossPassage('upper-gorge-bridge')`, then `upper-gorge → north-west`
3. West bank: `north-west → mid-west` (river blocks center chord — use bank geometry / shared edge)
4. Search ford at `mid-west`; `mid-west → utility-yard` on west bank without requiring ford on inter-hex path
5. Southern fence: `crossPassage` through gate/hole where needed before inter-hex steps

### Out of scope (current game)

- Multi-hex auto-travel / A\* around barrier polygons
- Player-cut holes (fence cutter item)
- Builder UI for placing openings
- Border-mounted openings as inter-hex gates (Part I)
- Separate player vs author builds (builder is role-gated in the same `game/` app)

---

## Implementation Punch List

These are the remaining movement tasks. They are written as things to do, not open design questions.

### Geometry and stands

1. **Replace local grid search with explicit reachable sub-areas.** Determine the barrier-bounded sub-area containing the avatar or destination entry border, then use that sub-area for border reachability and destination stand selection. The current local cell-bounded grid search is useful but still an approximation.

2. **Replace sample-driven destination fallback.** When preferred stands are blocked, choose a stable stand in the entry-side sub-area, preferably near the midpoint of the blocking barrier segment. The current `hexInteriorCandidates` / `standBeforeFirstHit` behavior is a temporary approximation.

3. **Make fallback ordering entry-aware.** `hexInteriorCandidates` currently sorts by barrier clearance and distance from the departure point. Destination fallback should prioritize the reachable sub-area from the border entry.

4. **Harden barrier endpoint handling.** A path can slip past a short finite segment when the visual intent is that the barrier blocks movement. Joined barrier endpoints currently use conservative local-search clearance; replace this with explicit sub-area topology and cover tuned fence endpoints with regressions.

5. **Keep smooth barrier collision aligned with visuals.** Smooth barrier features should use the same sampled curve for collision that the player sees. Add regression coverage around smoothing and feature-model generation.

6. **Preserve approach-dependent stands.** Route approach from `north-bend` can land at the gate approach north of the fence; western approach from `mid-west` should land south of the fence. Keep this covered as the resolver changes.

### Movement authority and gates

7. **Keep one adjacent-move authority.** `resolveMove` / `canEnterNeighbor` should remain the source of truth for offering and executing adjacent moves. Do not reintroduce separate `canOfferNeighbor` / `canReachNeighbor`-style predicates without a new gameplay contract.

8. **Consider renaming `canReachHex`.** `canReachHex` means enterable, not "clean arrival without `blockedKind`." A local code comment now documents this; a future rename could make it self-explanatory.

9. **Move hardcoded route gates into data.** The west-bank drive filter (`isWestOfRiverAt` + `drive` / `road-fork`) is intentional but hardcoded in `availableMoves`; express it in map data or route metadata.

10. **Use the same gate path for future gameplay locks.** The compound gate now gates both UI and `moveTo`; future story/puzzle gates should follow that pattern.

### Passages and openings

11. **Keep passage stand regressions broad.** `standAcrossOpening` uses one shared inset/separation rule. Maintain tests for bridge, ford, gate, hole, stair, and future passage kinds so crossings visibly clear the barrier while staying near the opening.

12. **Add direct-call passage guard tests.** `crossPassage` re-checks `shouldOfferPassageCrossing`; add regressions for locked, hidden, wrong-hex, stale-status, and not-near-barrier attempts.

13. **Decide the home for `openingAllows`.** It is still exported and unit-tested in `useTravelBarriers.test.js`, but inter-hex travel does not use it. Move it to the passage module or delete it if no longer needed.

14. **Exercise non-Part-I passage kinds.** Cliff / ravine / stair entries exist in `BARRIER_OPENINGS` but have little dedicated UX or test coverage.

### Content, docs, and tooling

15. **Clean stale smoke-test references.** `barrierPassageJourney.test.js` is referenced in old comments/plans but does not exist. Either create that smoke test or update references to the current coverage split.

16. **Keep `web/` marked non-authoritative.** The prototype still uses older movement assumptions. Re-port from `game/` only when intentionally refreshing the prototype.

17. **Add save/load round-trip coverage for openings.** `discoveredOpenings` is serialized, but the round trip is not directly asserted.

18. **Add builder serialization for openings.** Builder export still needs full serialization for hole/ford/bridge/stair-style openings.

---

## Document history

| Date    | Change                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06 | Initial source-of-truth doc; consolidates `barrier-pathfinding.md` and `barrier-passage-openings.md`; aligned to `game/` two-step implementation |
| 2026-06 | Moved to `docs/designs/hexcrawling.md`; references updated                                                                                       |
