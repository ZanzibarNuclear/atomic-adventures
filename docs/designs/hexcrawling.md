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

**Barriers** are authored map features such as rivers, fences, cliffs, and ravines. They are defined by feature points, usually as polylines, with possible smoothing for curved features. A barrier divides a cell into reachable sub-areas. The avatar may move within a sub-area and along the barrier edge, but may not cross into another sub-area except through an available local passage.

Barriers block path segments that strictly cross them. Walking parallel to a barrier, standing on one side of it, or following its bank/edge does not count as crossing. Endpoint and grazing cases should be handled conservatively: if the visual intent is that the barrier blocks movement, authored geometry and tests should make that unambiguous.

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

River crossings require bank proximity (`isOnRiverBank`). Fence/cliff crossings use perpendicular inset from the nearest barrier segment.

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

All checks use `interHexTravelCtx(ctx)` which sets `openings: []`. In the current Part I implementation, adjacent movement never consumes passages; passages are separate `crossPassage` actions.

**Step 2 — `resolveDestinationStand`**

Preferred stands: `resolveArrivalStand` (routes) → authored → `toPos` → center → `hexInteriorCandidates` → `standBeforeFirstHit` → `entryPoint`. This approximates the intended destination stand priority, but does not yet explicitly model the reachable sub-area or barrier-midpoint fallback described above.

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
- **Grazing / endpoint gaps** — a path can pass near a fence endpoint without counting as a crossing if the intersection falls outside the barrier segment’s y/x extent. This is geometrically correct but can surprise authors if fence segments are short (see Open issues).

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

**Stale comment in `map.yaml` (lines 35–38):** Header still says “direct hex moves — marked routes pass through openings.” That described the **old** model. Inter-hex travel ignores openings; update the header when editing the map file.

### Test harnesses

| Harness                                                                  | Use when                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`travelWorld.js`](../../game/src/lib/maps/testing/travelWorld.js)       | Pure geometry — `evaluateNeighborMove`, no gate UI filters          |
| [`gameplayTravel.js`](../../game/src/lib/maps/testing/gameplayTravel.js) | Full `useOutdoorWorld` + `gameState` — gate puzzle, `moveTo`, flags |

### Regression tests (representative)

| Test file                                                 | Covers                                                 |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `useTravelBarriers.test.js`                               | Current resolver, geometry, `canOffer` vs `canEnter`   |
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

## Open issues

Issues below are **known gaps, ambiguities, or doc/code mismatches** as of the current `game/` implementation. Resolve these before treating the system as “complete.”

### Highest-priority corrections

1. **Make reachable sub-areas explicit.** The resolver should determine the barrier-bounded sub-area containing the avatar or entry border, then use that sub-area for border reachability and destination stand selection. The current sample/chord approach is useful but incomplete.

2. **Offer and execute from the same authority.** The movement options shown to the player and the code path that executes a move must use the same reachability and gameplay rules. UI-only filters are allowed for presentation, but they must not be the only thing preventing illegal movement. Initial locked-gate and passage-guard consistency is implemented; continue this pattern for future gates.

3. **Separate geometry from gameplay gates.** Geometry answers "can this stand reach that border or point without illegal barrier crossing?" Gameplay answers "is this gate unlocked, hole discovered, route allowed, or puzzle state satisfied?" Both must be checked before an option is offered or executed.

4. **Make passage scope unambiguous.** Part I passages are explicit local actions (`crossPassage`). If a future route combines passage crossing with adjacent movement, that route must name and traverse the local passage instead of relying on a generic opening exemption.

5. **Codify destination fallback.** When preferred stands are blocked, the fallback should choose a stable stand in the entry-side sub-area, preferably near the midpoint of the blocking barrier segment. The current `hexInteriorCandidates` / `standBeforeFirstHit` behavior should be revised or documented as a temporary approximation.

6. **Unify passage-crossing stands.** Gate, bridge, ford, hole, stair, and future passage types should all use the same "near the passage, far side, consistent inset" placement rule, with authored overrides only for exceptional geometry.

### Geometry and stand placement

1. **No explicit reachable-region model** — The current resolver does not build the accessible sub-area defined by cell borders plus barrier geometry. This is the biggest gap relative to the design above and explains many shaky edge cases around rivers, fences, and non-straight bank movement.

2. **Fence segment endpoints** — `segmentIntersection` uses finite segments. A path can slip past a short fence segment if the intersection lies outside the segment’s extent (e.g. chord passes above/below the fence line’s y-range). Prefer long-enough barrier segments in YAML; add regression tests when tuning fences.

3. **Keep curved barrier collision aligned with visuals** — Smooth barrier features should use the same sampled curve for collision that the player sees. Add regression coverage when changing smoothing or route/feature model generation.

4. **`north-bend → gate-woods` vs `mid-west → gate-woods`** — Both can enter `gate-woods`, but stand selection depends on approach direction. Route approach from the north can land at the authored gate approach (north of fence) when that path is barrier-clear; western approach should land south of the fence.

5. **`hexInteriorCandidates` ordering** — Sorted by barrier clearance then distance from `fromPos` (departure), not from border entry. May affect which accessible-side stand is chosen when multiple interior points are valid.

6. **Barrier-side fallback does not match the design yet** — The desired fallback is in the entry-side sub-area near the midpoint of the blocking barrier segment. Current fallback points are sample-driven and can be hard to reason about.

7. **Passage-crossing separation needs continued regression coverage** — `standAcrossOpening` now uses one shared inset/separation rule for all passage types. Keep tests around bridges, fords, gates, and holes so authored openings continue to visibly clear the barrier while remaining near the opening.

### API and naming

8. **Clarify helper naming around `canReachHex`** — `canReachHex` means enterable, not "clean arrival without `blockedKind`." Rename or document in UI code comments (partially done in play panel).

9. **Keep deleted predicates out** — `canOfferNeighbor` and `canReachNeighbor` were removed from `useTravelBarriers.js`; avoid reintroducing separate movement predicates unless there is a clear new gameplay contract.

10. **Stale comment in `useAvatarStand.js`** — References `resolveNeighborArrivalStand` which does not exist; should point to `resolveDestinationStand` in `useTravelBarriers.js`.

### Gameplay vs geometry

11. **Continue checking gameplay gates in execution paths** — The compound gate is now enforced by `canReachHex` / `moveTo`; future story gates should follow the same pattern.

12. **West-bank drive filter is hardcoded** — `isWestOfRiverAt` + `drive` / `road-fork` only in `availableMoves`, not in `directNeighbors` or `canReachHex`. Intentional design filter, but not expressed in map data.

13. **`crossPassage` guard coverage** — `crossPassage` now re-checks `shouldOfferPassageCrossing`; add regressions for locked/hidden/unreachable passages as more content is added.

14. **Compound gate north/south** — Uses opening y coordinate, not fence polyline. Fragile if gate or fence moves in YAML.

### Content and docs

15. **`map.yaml` header contradicts this doc** — Lines 35–38 describe openings on direct hex moves; should be updated to match hexcrawling contract.

16. **`barrierPassageJourney.test.js`** — Referenced in old plans and `storyJourneySmoke.test.js` comment but **file does not exist**; smoke coverage split between `storyJourneySmoke.test.js` (gameplay) and scattered unit tests.

17. **`web/` prototype divergence** — `web/src/composables/useTravelBarriers.js` still uses `openingAllows` on inter-hex paths. Re-port from `game/` or mark prototype as non-authoritative for movement.

### Persistence and tooling

18. **No save round-trip test** for `discoveredOpenings` (serialized in snapshots, not asserted in tests).

19. **Builder opening serialization** — No `serializeOpening` for hole/ford/bridge in builder (fast follow).

20. **`buildMovePath` `moveOpts`** — Accepts `{ barriers, size }` but does not read them; barriers applied only in `resolveMove`.

### Barrier kinds

21. **Cliff / ravine / stair** — In `BARRIER_OPENINGS` table but no dedicated passage UX like river banks; generic segment blocking and `standAcrossOpening` perpendicular inset only. Untested on Part I map?

22. **`openingAllows` on inter-hex** — Still exported and unit-tested in `useTravelBarriers.test.js` for disc matching; not used by `firstBlockedOnPath` during travel. Keep for `crossPassage` tests or move to passage module?

### Resolved design decisions

| Decision | Resolution |
| -------- | ---------- |
| Passage use | Part I passages are explicit, player-driven `crossPassage` actions. The player may cross back and forth and may choose another direction instead. |
| Story triggers | Story maps to cells. Entering a cell is enough to trigger cell-level story/description, even if the avatar stops at an in-cell barrier. |
| UI/execution consistency | `moveTo` and movement option generation must enforce the same gameplay gates. |
| Movement predicates | Use one authoritative adjacent-move resolver. Delete redundant predicates unless a new gameplay contract requires them. |
| Curved barriers | Collision should use the same sampled curve the player sees. |
| Barrier-adjacent stands | Walking along or standing beside a barrier should keep a small visible gap so the avatar does not stand on the barrier. |

---

## Document history

| Date    | Change                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06 | Initial source-of-truth doc; consolidates `barrier-pathfinding.md` and `barrier-passage-openings.md`; aligned to `game/` two-step implementation |
| 2026-06 | Moved to `docs/designs/hexcrawling.md`; references updated                                                                                       |
