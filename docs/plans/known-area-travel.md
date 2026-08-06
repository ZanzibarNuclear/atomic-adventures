# Known-area free travel — implementation plan

**Status:** Implemented (core)  
**Contracts:** [hex-crawling.md](../contracts/hex-crawling.md), [indoor-stands.md](../contracts/indoor-stands.md)

## Goal

Once the player has discovered map space, let them click a known destination
and walk there smoothly—outdoors across hexes, indoors across stands/rooms—
without re-doing discovery ceremony, while still respecting barriers and locks.

## Non-goals

- Auto-switch outdoor ↔ indoor maps
- Walk through locked doors like a ghost (player unlocks at the threshold)
- Path into fog / undiscovered rooms
- Full furniture collision indoors

## Phases

### Phase 1 — Outdoor multi-hop (code + synthetic tests) — done

1. `knownAreaOutdoorTravel.js` — pure path planner:
   - Input: from hex + stand, target hex, discovered set, resolve-step fn
   - BFS over discovered adjacent hexes; each step uses existing `resolveMove`
     with openings allowed when available
   - Output: ordered hex steps + stands, or null
2. Extend `useOutdoorMovement.moveTo`:
   - Known discovered targets use multi-hop plan when present
   - Discovery adjacent keeps openings only on routes
   - Never enter buildings
3. Map click / `canReachHex` / `reachableHexIds`: discovered hexes with a planned path
4. Tests: `game/src/lib/maps/testing/knownAreaOutdoorTravel.test.js` (synthetic A–B–C)

### Phase 2 — Indoor free travel + door manners — done (room graph)

1. `canTraverseDoorOnPath` / manners helpers in `useDoors.js`
   - Closed unlocked = pathable; locked blocks free travel (unlock ceremony first)
2. On path edge through closed unlocked door: open for pass, then **reclose unlocked**
3. `knownAreaIndoorTravel.js` — BFS over known rooms via door/stair links
4. `moveToRoom` / `reachableRooms` use multi-hop when destination not one-hop open
5. Tests: `knownAreaIndoorTravel.test.js`, `useDoors.manners.test.js` (synthetic halls)

**Note:** Free travel is room-graph based (plus existing same-room stands and
exterior polyline walks). Full stand-to-stand pathing through intermediate rooms
can refine later if a concrete room needs it; manners and locks are enforced on
room edges already.

### Phase 3 — Polish — partial

- Reduced-motion: outdoor multi-hop snaps when reduced-motion is preferred; indoor already short-circuits waits
- Optional status feedback when blocked (“The way is blocked.”) — not added
- Movement audit cases for multi-hop remain optional; pure planner tests cover the contract table

## Risk notes

- Stand simulation between outdoor hops must stay barrier-safe (use real resolveMove each step).
- Indoor door state mutation on free travel must be serializable and save-safe.
- Keep discovery-era adjacent UX intact when multi-hop is impossible.
