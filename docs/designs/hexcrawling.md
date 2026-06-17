# Hexcrawling Design

**Status:** Source of truth for outdoor hex-map movement in the playable game  
**Scope:** `game/` — `game/src/lib/maps/` and `game/content/world/map.yaml`  
**Supersedes:** [`docs/plans/barrier-pathfinding.md`](../plans/barrier-pathfinding.md), [`docs/plans/barrier-passage-openings.md`](../plans/barrier-passage-openings.md) (historical; safe to delete when no longer linked)

Outdoor play is **adjacent-step hexcrawling**: from one hex the player moves within the cell it is in or to a **neighboring** hex (hex distance 1), stands at a position inside that hex, and may cross **barriers within the same hex** via deliberate passage actions. Multi-hex auto-pathfinding is not be defined yet, but the feature is allowable and welcome given the time and motivation to implement it.

---

## Purpose

This document defines how movement on the hex map (**hexcrawling**) is supposed to work in Atomic Adventures.

Goals:

1. **One contract** for adjacent travel, route following, barriers, and in-hex crossings so behavior is predictable across any hex map. The way this works must be agnostic from how any particular hex map is defined.
2. **Regression prevention** — document the approach we are taking, how the game should work from the player's perspective, to prevent unwanted behaviors and regressions.
3. **Clarity** — maintain separation of concerns. map geometry (what are the areas), handling of map features (like authored stand points, barriers and crossings, and landmarks), and gameplay logic (in-game conditions satisfied that allow an action?).
4. **Implementation alignment** — record what `game/` actually does today, including known gaps and open questions.

**Canonical code location:** `game/src/lib/maps/`. Treat `game/` as authoritative. Our primary focus is on building the integrated game.

**Ignore the prototype:** Everything under `web/` is part of an early mapping prototype (outdoor and indoor) that is quickly becoming outdated. We will delete or refresh it at some point.

---

## How Movement Works

### Directions

In hex map view, the avatar is always standing in one of the hex cells (a.k.a. cell). Each cell has up to 6 neighboring cells. At the edges of the map, a cell may have fewer than six neighbors. That means there could be six directions of travel that are normal to the borders of the cell the avatar is in. We show a row orientation, so the typical directions are: northeast, east, southeast, southwest, west, northwest. In addition, we can use north and south as long as the destination cell is unamibiguous (as when the avatar stands off-center or is following a route).

In addition, we need to understand and follow implicit directions. A route defines a specific way to go. An avatar can follow a route in a direction, and the route may turn and point in a different direction. That is fine.

Within a cell, we can move toward a landmark or a barrier or an author stand point.

We can move along a barrier without crossing it. For instance, we can walk along the riverbank or along a fence.

We can move across a barrier at an opening, as long as the opening is available (found, unlocked, open, etc).

### Core idea: two-step adjacent moves

Every move to an **adjacent** hex is resolved in two steps:

| Step                                 | Question                                                                                                        | Success                                   | Failure                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| **1 — Reach the shared border**      | Can the avatar reach the shared edge with the destination hex along a path that **does not cross any barrier**? | Continue to step 2                        | Stop in the **departure** hex before the blocking barrier                             |
| **2 — Stand in the destination hex** | From a point just inside the destination hex on that border, where should the avatar stand?                     | Enter destination hex at the chosen stand | Rare fallback: border entry only, or stop at an in-hex barrier on the accessible side |

The **active hex** after a move is whichever hex contains the **final stand** (`hexAtPoint(stand)`), not merely the hex the player clicked.

Paths in step 1 may be a straight chord, a **marked route polyline**, or a **shared-edge sample** (including partial chords along the edge). A straight chord is a valid first attempt but not required.

### What blocks movement

**Barriers** — authored polylines (`fence`, `river`, `cliff`, `ravine`) — block any path segment that **strictly crosses** them (endpoints on opposite sides of the barrier line). Parallel walks along one side do not count as crossings.

**Passage openings** (`gate`, `hole`, `bridge`, `ford`, `stair`) do **not** exempt barriers on inter-hex paths. They matter only for **`crossPassage`**: a deliberate action to cross a barrier **within the same hex** and stand on the opposite side.

> **Authoring rule:** An opening inside a hex (e.g. the compound gate in `gate-woods`) does not let the avatar “use the gate” when walking into a **neighbor** hex. If the fence blocks the border approach, the player must `crossPassage` first, or approach from a direction where step 1 can reach the border without crossing the barrier.

**Future (not used in Part I):** An opening placed exactly on the **shared border** between two hexes could participate in inter-hex travel. No Part I content relies on this.

### Step 2 stand priority

From the border entry point inside the destination hex, pick a stand in this order:

1. **Route stand** — when following a marked route, stand on the route where it enters the destination hex (midpoint in hex, route endpoint, or authored route target).
2. **Authored `standAt`** — if a barrier-clear path exists from entry to that point **and** the point lies inside the destination hex.
3. **Intended arrival (`toPos`)** — same rules as authored stand (typically center or destination `standAt` from `resolveNeighborStand`).
4. **Hex center** — if reachable without crossing a barrier.
5. **Accessible side of a blocking barrier** — interior samples and `standBeforeFirstHit` toward the targets above; stop just inside the destination on the near side of the barrier.
6. **Border entry** — last resort.

When a barrier blocks the preferred targets, the avatar should end on the **accessible side** of that barrier **inside the destination hex** (e.g. `mid-west → gate-woods` enters south of the compound fence, not at the gate approach north of the fence, unless a barrier-clear path from that approach direction exists).

### Routes

Marked routes (`trail`, `road`, `drive`, etc.) use the **same two-step contract**:

- **Offering:** A route move is shown only if step 1 succeeds when following the route polyline.
- **Path:** `buildMovePath` slices the route samples between the current position and the destination hex.
- **Stand:** Step 2 prefers standing **on the route** in the destination hex when the route continues there.
- **Label:** Route move labels use the **path tangent** at the hex exit (e.g. “Go northeast”), not the hex-center compass vector.

### In-hex passage (`crossPassage`)

Separate from inter-hex travel. The player chooses an action such as “Cross the bridge” or “Go through the gate.” The avatar **stays in the same hex**; stand moves to the far side of the barrier at the opening.

| Opening | Visibility | Passage                      | Notes                                          |
| ------- | ---------- | ---------------------------- | ---------------------------------------------- |
| Gate    | Obvious    | When unlocked / story allows | Compound gate: puzzle + flags                  |
| Bridge  | Obvious    | Always (when on river bank)  |                                                |
| Hole    | Hidden     | After search reveals it      | Pre-cut breach at `south-pines`                |
| Ford    | Hidden     | After search                 | Also demonstrates river crossing at `mid-west` |

River crossings require **bank proximity** (`isOnRiverBank`). Fence/cliff crossings use perpendicular inset from the nearest barrier segment.

### Movement options the player sees

From the current hex, the play panel combines:

1. **Route moves** — destinations reachable via marked routes (`availableMoves`).
2. **Direct moves** — adjacent hexes not already covered by a route (`directNeighbors`).
3. **Passage crossings** — in-hex `crossPassage` actions (`availablePassageCrossings`).
4. **Story / puzzle actions** — e.g. “Solve the puzzle to unlock” at the locked compound gate.

**Deduping:** If a neighbor is reachable by route, it is omitted from direct moves.

**Gameplay filters (not geometry):**

- **Locked compound gate** — while in `gate-woods`, north of the gate, and gate not passed: hide southward moves and `west-slope` from move lists (`filterGateMoves`). Geometry may still allow some of these via `moveTo` if called directly (see Open issues).
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

## Implementation details

### End-to-end flow

```
Play panel movement options
  → route moves (availableMoves) + direct moves (directNeighbors)
  → each filtered by canEnterNeighbor → resolveMove
  → filterGateMoves (UI only)

moveTo(hexId)
  → canReachHex → canEnterNeighbor → resolveMove
  → applyMove(hexId, stand, atBarrier, lastBlocked)

crossPassage(openingId)
  → standAcrossOpening (same hex)
  → markCompoundGatePassed when compound-gate
```

### Code map

| Concern                             | File                                                                                 | Key exports                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Orchestration, state, `moveTo`      | [`useOutdoorWorld.js`](../../game/src/lib/maps/composables/useOutdoorWorld.js)       | `moveTo`, `canReachHex`, `moves`, `directMoves`, `crossPassage`, `travelBarrierCtx`                                        |
| Two-step resolver, barrier geometry | [`useTravelBarriers.js`](../../game/src/lib/maps/composables/useTravelBarriers.js)   | `resolveMove`, `canEnterNeighbor`, `canReachNeighbor`, `canOfferNeighbor`, `firstBlockedOnPath`, `firstBlockedOnPathInHex` |
| Routes, move lists                  | [`useRoutes.js`](../../game/src/lib/maps/composables/useRoutes.js)                   | `availableMoves`, `directNeighbors`, `buildMovePath`, `routeLegBetween`                                                    |
| Stand hints (`toPos`)               | [`useAvatarStand.js`](../../game/src/lib/maps/composables/useAvatarStand.js)         | `resolveAvatarPosition`, `resolveNeighborStand`, `hexCenterStand`                                                          |
| In-hex crossings                    | [`usePassageCrossing.js`](../../game/src/lib/maps/composables/usePassageCrossing.js) | `standAcrossOpening`, `availablePassageCrossings`, `shouldOfferPassageCrossing`                                            |
| Opening models, discovery           | [`useBarrierOpenings.js`](../../game/src/lib/maps/composables/useBarrierOpenings.js) | `travelOpenings`, `hiddenOpeningsInHex`, `resolveOpeningPosition`                                                          |
| Barrier-adjacent stands, status     | [`useBarrierStand.js`](../../game/src/lib/maps/composables/useBarrierStand.js)       | `BARRIER_STAND_INSET`, `barrierHintAtStand`, `isNearBarrierKind`                                                           |
| Compound gate story                 | [`useCompoundGate.js`](../../game/src/lib/maps/composables/useCompoundGate.js)       | `filterOpeningsForGateState`, `isNorthOfCompoundGate`, gate flags                                                          |
| Hex geometry                        | [`useHexGeometry.js`](../../game/src/lib/maps/composables/useHexGeometry.js)         | `pixelToHex`, `hexDistance`, `axialToPixel`                                                                                |
| Play panel wiring                   | [`usePlayPanel.js`](../../game/src/composables/usePlayPanel.js)                      | `getMovementOptions`, `buildOutdoorStatusLines`                                                                            |
| Save/load                           | [`useGameState.js`](../../game/src/composables/useGameState.js)                      | outdoor snapshot includes `stand`, `discoveredOpenings`                                                                    |

### `resolveMove` (two-step resolver)

**Step 1 — `findReachableBorderEntry`**

1. If `walkPath` is barrier-clear, walk backward for the last point in the destination hex that is **near the shared edge** (`distance ≤ size × 0.2`).
2. Else try direct chords to `toPos` (if near edge) and shared-edge inside samples (five points along edge at t = 0.15…0.85, nudged inward).
3. Else partial interpolation from `fromPos` toward each inside-edge sample (t = 0.1…0.9).

All checks use `interHexTravelCtx(ctx)` which sets `openings: []` — openings never apply.

**Step 2 — `resolveDestinationStand`**

Preferred stands: `resolveArrivalStand` (routes) → authored → `toPos` → center → `hexInteriorCandidates` → `standBeforeFirstHit` → `entryPoint`.

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

### Neighbor predicates (important distinction)

| Function           | Meaning                                                                                                            | Used in gameplay?                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `canOfferNeighbor` | Departure hex only: path does not cross a barrier **while still in the source hex** (`blockedLeavingDepartureHex`) | **No** — exported and tested, not used by `availableMoves` / `directNeighbors` |
| `canEnterNeighbor` | `resolveMove` → `activeHexId === toHex.id` (may stop at in-hex barrier in destination)                             | **Yes** — move lists, `canReachHex`, `moveTo`                                  |
| `canReachNeighbor` | Entered destination **and** `blockedKind == null`                                                                  | **No** — tests / `travelWorld.js` only                                         |

Naming note: `canReachHex` in `useOutdoorWorld` calls **`canEnterNeighbor`**, not `canReachNeighbor`. A “reachable” hex in the UI means **enterable**, not necessarily a clean arrival with no in-hex barrier stop.

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
2. **Move list filter** — north of gate → hide south moves and `west-slope`.
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

**Tuning:** Adjust opening `at` until **`crossPassage`** places the avatar correctly and journey tests pass. Do not tune against neighbor-move `openingAllows` (obsolete workflow).

**Stale comment in `map.yaml` (lines 35–38):** Header still says “direct hex moves — marked routes pass through openings.” That described the **old** model. Inter-hex travel ignores openings; update the header when editing the map file.

### Test harnesses

| Harness                                                                  | Use when                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`travelWorld.js`](../../game/src/lib/maps/testing/travelWorld.js)       | Pure geometry — `evaluateNeighborMove`, no gate UI filters          |
| [`gameplayTravel.js`](../../game/src/lib/maps/testing/gameplayTravel.js) | Full `useOutdoorWorld` + `gameState` — gate puzzle, `moveTo`, flags |

### Regression tests (representative)

| Test file                                                 | Covers                                                 |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `useTravelBarriers.test.js`                               | Two-step resolver, geometry, `canOffer` vs `canEnter`  |
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

| Scenario                                    | Step 1                                                         | Step 2                                                                       |
| ------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Open terrain                                | Chord or route to shared edge                                  | Authored stand or center                                                     |
| `mid-west → gate-woods`                     | Reach east border without crossing compound fence              | Stand south of fence (center or accessible side)                             |
| `north-bend → gate-woods` via compound road | Follow route polyline to border                                | Route stand / gate approach **if** barrier-clear from entry (north of fence) |
| `south-pines → lower-stand`                 | Blocked west of fence until `crossPassage('south-pines-hole')` | Stand in `lower-stand`                                                       |
| `road-fork → upper-gorge`                   | Follow `river-access-drive`                                    | Stand on drive at east bank                                                  |
| `upper-gorge → north-west`                  | Inter-hex chord after bridge crossing                          | West-bank stand in `north-west`                                              |

### Northern approach (play sequence)

1. `trailhead → … → road-fork → upper-gorge` via `river-access-drive`
2. `crossPassage('upper-gorge-bridge')`, then `upper-gorge → north-west`
3. West bank: `north-west → mid-west` (river blocks center chord — use bank geometry / shared edge)
4. Search ford at `mid-west`; `mid-west → utility-yard` on west bank without requiring ford on inter-hex path
5. Southern fence: `crossPassage` through gate/hole where needed before inter-hex steps

### Out of scope (current game)

- Multi-hex auto-travel / A\* around barrier polygons
- Automatic bank-corridor inference from river geometry
- Player-cut holes (fence cutter item)
- Builder UI for placing openings
- Border-mounted openings as inter-hex gates (Part I)
- Separate player vs author builds (builder is role-gated in the same `game/` app)

---

## Open issues

Issues below are **known gaps, ambiguities, or doc/code mismatches** as of the current `game/` implementation. Resolve these before treating the system as “complete.”

### Geometry and stand placement

1. **Fence segment endpoints** — `segmentIntersection` uses finite segments. A path can slip past a short fence segment if the intersection lies outside the segment’s extent (e.g. chord passes above/below the fence line’s y-range). Prefer long-enough barrier segments in YAML; add regression tests when tuning fences.

2. **`north-bend → gate-woods` vs `mid-west → gate-woods`** — Both can enter `gate-woods`, but stand selection depends on approach direction. Route approach from the north can land at the authored gate approach (north of fence) when that path is barrier-clear; western approach should land south of the fence. Confirm with authors whether north-of-fence arrival from the road is always desired.

3. **`hexInteriorCandidates` ordering** — Sorted by barrier clearance then distance from `fromPos` (departure), not from border entry. May affect which accessible-side stand is chosen when multiple interior points are valid.

### API and naming

4. **`canOfferNeighbor` unused in gameplay** — Move lists use `canEnterNeighbor` (full two-step). `canOfferNeighbor` only checks departure-hex barriers. Either wire it into offering logic intentionally or remove/deprecate to avoid confusion.

5. **`canReachHex` vs `canReachNeighbor`** — `canReachHex` means enterable (`canEnterNeighbor`), not “clean” arrival without `blockedKind`. Rename or document in UI code comments (partially done in play panel).

6. **Stale comment in `useAvatarStand.js`** — References `resolveNeighborArrivalStand` which does not exist; should point to `resolveDestinationStand` in `useTravelBarriers.js`.

7. **Stale comment in `directNeighbors`** — Says “barriers in destination hexes are ignored”; `canEnterNeighbor` / `resolveMove` **do** evaluate destination barriers in step 2.

8. **Dead imports** — `canOfferNeighbor` imported in `useOutdoorWorld.js`; `canOfferNeighbor` / `canReachNeighbor` imported in `useRoutes.js`.

### Gameplay vs geometry

9. **Gate lock not enforced in `moveTo`** — `filterGateMoves` applies only to `moves` / `directMoves` computed lists. `canReachHex` / `moveTo` do not call `moveBlockedByLockedGate`. Programmatic or story-driven `moveTo` could enter south hexes while visually “locked” unless guarded elsewhere.

10. **West-bank drive filter is hardcoded** — `isWestOfRiverAt` + `drive` / `road-fork` only in `availableMoves`, not in `directNeighbors` or `canReachHex`. Intentional design filter, but not expressed in map data.

11. **`crossPassage` without UI guard** — `crossPassage` does not re-check `shouldOfferPassageCrossing`; only the play panel filters. Direct API calls can cross when UI would hide the action.

12. **Compound gate north/south** — Uses opening y coordinate, not fence polyline. Fragile if gate or fence moves in YAML.

### Content and docs

13. **`map.yaml` header contradicts this doc** — Lines 35–38 describe openings on direct hex moves; should be updated to match hexcrawling contract.

14. **`barrierPassageJourney.test.js`** — Referenced in old plans and `storyJourneySmoke.test.js` comment but **file does not exist**; smoke coverage split between `storyJourneySmoke.test.js` (gameplay) and scattered unit tests.

15. **`web/` prototype divergence** — `web/src/composables/useTravelBarriers.js` still uses `openingAllows` on inter-hex paths. Re-port from `game/` or mark prototype as non-authoritative for movement.

### Persistence and tooling

17. **No save round-trip test** for `discoveredOpenings` (serialized in snapshots, not asserted in tests).

18. **Builder opening serialization** — No `serializeOpening` for hole/ford/bridge in builder (fast follow).

19. **`buildMovePath` `moveOpts`** — Accepts `{ barriers, size }` but does not read them; barriers applied only in `resolveMove`.

### Barrier kinds

20. **Cliff / ravine / stair** — In `BARRIER_OPENINGS` table but no dedicated passage UX like river banks; generic segment blocking and `standAcrossOpening` perpendicular inset only. Untested on Part I map?

21. **`openingAllows` on inter-hex** — Still exported and unit-tested in `useTravelBarriers.test.js` for disc matching; not used by `firstBlockedOnPath` during travel. Keep for `crossPassage` tests or move to passage module?

### Questions for design resolution

| #   | Question                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Should `moveTo` / `canReachHex` enforce `filterGateMoves` so geometry and UI never disagree?                                                                    |
| Q2  | Should `canOfferNeighbor` (departure-only) or `canEnterNeighbor` (full two-step) be the single gate for **offering** moves?                                     |
| Q3  | When step 2 stops at an in-hex barrier (`blockedKind` set, but `activeHexId` is destination), is that a successful “enter” for story triggers? (Currently yes.) |
| Q4  | Do we want border-mounted openings for rare inter-hex gates, or always `crossPassage` + adjacent step?                                                          |
| Q5  | Should west-bank drive filtering become data-driven (e.g. route tag) instead of hardcoded in `useRoutes.js`?                                                    |

---

## Document history

| Date    | Change                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06 | Initial source-of-truth doc; consolidates `barrier-pathfinding.md` and `barrier-passage-openings.md`; aligned to `game/` two-step implementation |
| 2026-06 | Moved to `docs/designs/hexcrawling.md`; references updated                                                                                       |
