# Hex Viewport Design

**Status:** Source of truth for outdoor hex-map zoom, visibility, and fog rendering in the playable game  
**Scope:** `game/` — `game/src/lib/maps/` (`useHexMapViewport.js`, `useHexGeometry.js`, `HexMap.vue`)  
**Related:** [hex-crawling.md](hex-crawling.md) (movement, discovery state, travel — unchanged by viewport)

The outdoor hex map has two **player-facing view modes**: **gameplay** (default) and **full**. They control what the SVG draws and how the camera is framed. They do **not** change discovery, travel, barriers, or save state.

---

## Purpose

Goals:

1. **Readable local detail** — at gameplay zoom the player can see avatar stand position, routes, barriers, and landmarks clearly even as the authored map grows.
2. **Stable zoom while exploring** — the camera does not zoom out every time a new hex is discovered.
3. **Orientation without spoilers** — fog previews only the immediate step ahead from the active hex; full mode shows visited territory without undiscovered areas.
4. **Separation of concerns** — `discovered` is world state; viewport mode is presentation only.
5. **Regression prevention** — document the contract so future viewport changes can be checked against tests and this spec.

**Canonical code location:** `game/src/lib/maps/composables/useHexMapViewport.js` (`evaluateMapViewport` is the pure evaluator used by tests).

**Ignore the prototype:** `web/` still uses older `slice` / `explored` mode names. Treat `game/` as authoritative.

---

## Concepts

### World state vs. viewport

| Concern | Owned by | Viewport effect |
| ------- | -------- | ---------------- |
| Which hexes have been entered | `outdoor.state.discovered` | Determines which hexes *may* render as terrain |
| Active hex | `outdoor.state.currentId` | Gameplay camera centers here; fog neighbors computed from here |
| Hidden openings | `outdoor.state.discoveredOpenings` | Unchanged; passage marker visibility uses discovery + search state |
| Travel eligibility | `useOutdoorWorld` / `useTravelBarriers` | Unchanged; play panel does not depend on view mode |
| What is drawn this frame | `useHexMapViewport` | Clips terrain, fog, routes, and features to the current view |

Entering a hex always appends it to `discovered` regardless of view mode. A hex can be discovered but off-screen in gameplay mode.

### View mode values

| Mode | Default | Player use |
| ---- | ------- | ---------- |
| `gameplay` | Yes | Normal play — fixed local zoom centered on current hex |
| `full` | No | Overview of all **discovered** hexes; no fog |

Legacy save values `slice` and `explored` normalize to `gameplay` on load (`normalizeMapMode`).

### Builder view (authors)

When `builderView` is active, viewport rules are bypassed:

- All authored hexes render
- No fog
- ViewBox fits the entire map

Builder view is not a third player mode; it is an author override.

---

## Gameplay mode

### Player experience

- The map stays at a **fixed zoom level** (the same scale as the opening view at origin: current hex plus nearby context).
- The **current hex is centered** in the map panel.
- **Visited hexes** in the window render as terrain. As the player explores, multiple discovered hexes may appear at once when they fit in the window — not limited to a strict one-ring cap on terrain.
- **Undiscovered neighbors of the current hex** render as fog tiles — a one-step preview of where the player could go next.
- Fog **disappears** when the player moves away if that hex is no longer a neighbor of the new active hex (even if it was fog a moment ago).
- Discovered hexes **outside the window** are not drawn but remain in save state until the player walks back into view.

### ViewBox (camera)

- **Size:** fixed for the session, derived from a canonical 7-hex cluster (origin hex + its six axial neighbors) via `gameplayViewDimensions(size)` → `boundsOf(cluster, size)`.
- **Position:** `fixedGameplayViewBox(currentHex, size)` centers that rectangle on the current hex pixel (`axialToPixel`).
- **Does not grow** when `discovered` grows.

### Visible terrain hexes

A hex renders as terrain when **all** of:

1. Its id is in `discovered`, or it is the current hex (`isDiscovered`), and
2. Its footprint intersects the gameplay viewBox (`hexIntersectsViewBox`).

### Fog hexes

A hex renders as fog when **all** of:

1. It is an **axial neighbor** of the current hex (`neighborsOf`),
2. It is **not** in `discovered`,
3. Its footprint intersects the gameplay viewBox.

Fog is **local to the active hex**, not a frontier around the entire explored blob. Undiscovered hexes that are not neighbors of the current hex are hidden entirely (no fog tile).

### Routes, barriers, and passages

Layer drawing uses `fogMaskOpts()`:

- **`isRevealed(id)`** — hex is discovered or is the current hex.
- **`inView(id)`** — hex intersects the gameplay viewBox.

Route polylines and barrier segments are clipped to samples whose `hexId` passes both checks. Fog stubs (`allowStub: true`) poke a short segment into undiscovered neighbors at the view edge so paths visibly lead off-map.

Passage markers follow the same discovery rules as before; in gameplay mode they also require the opening's hex to be in view.

---

## Full mode

### Player experience

- Shows **all discovered hexes** at once.
- **No fog** — undiscovered territory is invisible, not fogged.
- ViewBox **expands** to fit discovered hexes (`boundsOf(visibleHexes, size)`).
- Intended for a future **map toggle** (gameplay ↔ full) so the player can orient on visited territory. At large map sizes this mode will be too zoomed out for stand-level detail — that is expected.

### Visible terrain hexes

All hexes in `discovered` plus the current hex.

### Fog hexes

None.

### Routes, barriers, and passages

- **`isRevealed(id)`** — discovered or current hex (same as gameplay).
- **`inView(id)`** — always true (no viewport clip).
- **`allowStub`** — false (no fog stubs).

---

## Mode comparison

| | **gameplay** | **full** | **builderView** |
| --- | --- | --- | --- |
| Zoom | Fixed (7-hex cluster scale) | Fit all discovered | Fit entire authored map |
| Center | Current hex | Discovered bounds | Map bounds |
| Discovered hexes shown | In viewBox only | All | All |
| Undiscovered hexes | Fog if neighbor of current and in viewBox | Hidden | Shown (no fog) |
| Grows with exploration | No (fixed viewBox) | Yes (viewBox grows) | N/A |
| Affects travel / discovery | No | No | No |

---

## Data flow

```
outdoor.state.currentId ──┐
outdoor.state.discovered ─┼──► useHexMapViewport ──► visibleHexes, fogHexes, viewBox
outdoor.mode ─────────────┤         │
builderView ──────────────┘         ├──► HexMap.vue (terrain, fog, avatar)
                                    └──► fogMaskOpts ──► useHexMapPlacements (routes, rivers, fences)
```

`HexMap.vue` sets the SVG `viewBox` from the composable. `preserveAspectRatio="xMidYMid meet"` scales the frame into the map panel.

---

## Persistence

`outdoor.mode` is stored in the outdoor slice of the save snapshot (`useGameState.js`). On load:

- `gameplay` and `full` are preserved.
- `slice`, `explored`, or missing values normalize to `gameplay`.

Discovery lists are independent of mode and are always saved.

---

## Future work

- **Toggle UI** — upper-left control on the map to switch `gameplay` ↔ `full` during play (mode already persisted in saves).
- **Pan animation** — optional smooth viewBox transition when the current hex changes in gameplay mode.

---

## Current implementation

### Key functions

| Function | File | Role |
| -------- | ---- | ---- |
| `evaluateMapViewport` | `useHexMapViewport.js` | Pure mode logic; used by composable and tests |
| `normalizeMapMode` | `useHexMapViewport.js` | Legacy save migration |
| `fixedGameplayViewBox` | `useHexGeometry.js` | Centered fixed-size camera |
| `gameplayViewDimensions` | `useHexGeometry.js` | Width/height from 7-hex cluster |
| `hexIntersectsViewBox` | `useHexGeometry.js` | Hex footprint vs. viewBox overlap |
| `boundsOf` | `useHexGeometry.js` | Full-mode and builder viewBox |
| `fogMaskOpts` | `useHexMapViewport.js` | `isRevealed` / `inView` for route and feature clipping |

### Wiring

| Location | Behavior |
| -------- | -------- |
| `useOutdoorWorld.js` | `mode` ref defaults to `"gameplay"` |
| `OutdoorScene.vue` | Passes `:mode="outdoor.mode"` to `HexMap` |
| `HexMap.vue` | Consumes `viewBox`, `visibleHexes`, `fogHexes`; fog tiles clickable in gameplay mode |
| `useBarrierOpenings.js` | `visiblePassageMarkers` filters by discovery (builder bypass only) |
| `useHexMapPlacements.js` | Route/feature draw pieces respect `fogMaskOpts`; cascade chevrons use discovery unless builder |

### Worked examples

**Start at origin** (`discovered: [origin]`):

- Gameplay viewBox centered on origin at fixed zoom.
- Terrain: origin.
- Fog: undiscovered **neighbors** of origin that intersect the viewBox (e.g. east-pines).

**After walking to east-pines** (`discovered: [origin, east-pines, …]`):

- Same viewBox **size**; re-centered on east-pines.
- Terrain: discovered hexes in window (e.g. origin + east-pines when both fit).
- Fog: undiscovered neighbors of east-pines only (e.g. center-pines, far-pines). Fog that was shown from origin but is not a neighbor of east-pines is gone.

**Full mode** with the same discovery:

- All discovered hexes visible; viewBox enlarged to include them; no fog tiles.

**Discovered hex far away** (e.g. utility-yard visited early, player back at origin):

- Gameplay: utility-yard not drawn (outside viewBox) but still in `discovered` and save.
- Full: utility-yard appears with other discovered hexes.

---

## Regression tests

| Test file | Covers |
| --------- | ------ |
| [`useHexMapViewport.test.js`](../../game/src/lib/maps/testing/useHexMapViewport.test.js) | Mode logic, fixed viewBox, fog neighbors, full mode, legacy normalization |
| [`useGameState.test.js`](../../game/src/composables/useGameState.test.js) | Legacy `explored` mode migrates to `gameplay` on load |

Run: `npm run test` from repo root.

When changing viewport behavior, update `evaluateMapViewport` and extend `useHexMapViewport.test.js` before adjusting UI.

---

## Document history

| Date | Change |
| ---- | ------ |
| 2026-06 | Initial spec for gameplay / full viewport modes; replaces legacy slice / explored split |
