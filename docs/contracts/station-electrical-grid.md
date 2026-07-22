# Station Electrical Grid

**Status:** Partial — station bus, room lighting switches, and powered-object
presence exist; load ratings, aggregate balance, and brownouts are specified
here but not yet implemented as a full grid model  
**Scope:** Utility-station (and later campus) electrical power: generation
connection to a station bus, loads, wall switches, device demand ratings, load
vs generation balance, and player-facing consequences  
**Related:** [hydro-simulator.md](hydro-simulator.md),
[control-panel.md](control-panel.md), [location-media.md](location-media.md),
[indoor-stands.md](indoor-stands.md), [world-authoring.md](world-authoring.md),
[character-inventory.md](character-inventory.md)

---

## Purpose

This contract defines how electricity works for gameplay at the utility
station: when something is *powered*, when it *draws load*, how generation and
consumption relate, and what the player can observe and change.

Part I teaches a hopeful, practical lesson: restoring hydro generation can
energize a building, but running lights and equipment is a real demand that
must stay within what the plant (and any buffer) can supply. Later parts may
extend the same model to PV, storage, and multi-building campus loads.

This document is the long-lived record of intended behavior. Implementation
plans implement the contract; they do not redefine it.

## Design Goals

- One coherent **station bus** notion: either the building electrical system is
  energized or it is not, before finer load balance applies.
- Separate **energized**, **switched/armed**, and **actively drawing** states
  so lights and appliances can be modeled honestly.
- Author **load ratings** on real devices so generation vs consumption can be
  taught with numbers, not only binary power.
- Keep physics and ratings host-owned; story flags and prose may reflect grid
  state but must not be the only source of truth for “is power available.”
- Prefer cause and effect the player can reverse: turn loads off, restore
  generation, or (later) charge storage—not permanent soft-locks.
- Scale from Part I hydro + station loads to later multi-source grids without
  renaming the core vocabulary.

## Relationship to Other Contracts

| Concern | Owner |
| --- | --- |
| Hydro generation physics, telemetry, startup | [hydro-simulator.md](hydro-simulator.md) |
| Console UI for generation and (later) load | [control-panel.md](control-panel.md) |
| Room photos that depend on effective lights | [location-media.md](location-media.md) (`roomLights`, `stationPower`) |
| Room geometry and stands | [indoor-stands.md](indoor-stands.md) |
| Building document authoring | [world-authoring.md](world-authoring.md) |
| Item/appliance effects, inventory | [character-inventory.md](character-inventory.md) |

Hydro answers “how much can we generate right now?”  
This contract answers “what is connected, what is drawing, and is demand within
supply?”

---

## Vocabulary

| Term | Meaning |
| --- | --- |
| **Station bus** | The building’s shared AC (or modeled) distribution. When the bus is **energized**, outlets and devices *can* receive power. |
| **Station power online** | Bus energized. Today this tracks hydro facility online / `hub.hydro_online` after startup. |
| **Generation** | Sources that can supply the bus (Part I: hydro plant; later PV, storage discharge). |
| **Load** | Anything that can draw power from the bus when conditions allow (lights, appliances, chargers, consoles, readers). |
| **Load rating** | Authored demand of a load when it is fully drawing (prefer watts, `W`). |
| **Wall light switch** | Per-room control: **open** = circuit open (off); **closed** = circuit closed (on if bus energized). |
| **Effective lights** | Lights actually illuminate only when the bus is energized **and** the room switch is closed. |
| **Armed / ready** | Device is connected and allowed to draw if the bus is energized (e.g. stove “on,” charger plugged in). |
| **Drawing** | Device is currently contributing to bus load (rating applies). |
| **Balance** | Comparison of available generation (plus storage discharge) to total drawing load. |
| **Surplus** | Available supply exceeds drawing load. |
| **Deficit** | Drawing load exceeds available supply. |
| **Brownout / shed** | Player-visible consequence of deficit (dimming, forced off noncritical loads, warnings). |

Electrical convention for wall switches matches ordinary wiring language:

- switch **open** → no light (default for unvisited rooms)  
- switch **closed** → lights on **only if** the station bus is energized  

---

## Layers of the Model

```text
Authored equipment (building content)
  room.lighting, poweredObjects, appliance actions
        │
        ▼
Runtime device state (save)
  lightSwitches[roomId], appliance/run flags, hydro facility
        │
        ▼
Effective availability
  bus energized? switch closed? device armed?
        │
        ▼
Aggregate power (grid management)
  sum(drawing load ratings)  vs  generation (+ storage)
        │
        ▼
Player-facing outcomes
  status lines, console readouts, room images, brownout/shed
```

Story and lessons may explain the same layers; they must not invent a parallel
power truth.

---

## Station Bus

### Supported rules

1. The utility station has a single primary **station bus** for Part I indoor
   loads.
2. The bus is either **energized** or **not energized** (boolean at the first
   grid-management increment; finer voltage modeling is out of scope until a
   concrete need appears).
3. **Station power online** means the bus is energized.
4. Energizing the bus is the result of a successful generation path (Part I:
   hydro startup / connect-power and facility online). Field hydro work remains
   host-owned under the hydro contract.
5. Devices must not claim to be fully “powered and active” when the bus is not
   energized, except for explicit status that explains the lack of power
   (e.g. switch closed, power out).

### Current implementation note

Today, bus energization is represented by hydro facility `online` / related
flags (`hub.hydro_online`). That is the correct first binding for Part I. A
later multi-source bus must still expose one clear “station power online”
truth for content and UI.

---

## Generation

### Supported rules

1. **Generation sources** declare an available output (watts or a hydro-derived
   electrical power) for the current game time and facility state.
2. Part I’s generation source is the Upper Penstock hydro plant modeled in
   [hydro-simulator.md](hydro-simulator.md).
3. Available generation for balance is the **electrical output that can serve
   the station bus**, not gross water power or nameplate fantasy.
4. Optional **storage** (battery/inverter buffer) may supply or absorb energy
   later. Until storage is modeled, treat available supply as generation only
   (or generation with an implicit infinite buffer only if explicitly stated in
   a temporary alpha exception—prefer not to).

### Out of scope until specified

- Market dispatch, multiple buildings on a regional grid, or player-owned
  microgrid trading.
- Full three-phase / voltage drop network graphs.

---

## Loads

### Categories

| Category | Examples | Typical control |
| --- | --- | --- |
| **Lighting** | Room LED fixtures | Room wall switch open/closed |
| **Outlet-backed** | Generic “outlets active” status | Bus energized (no per-outlet switch required for Part I) |
| **Appliances** | Electric stove | Bus + explicit on/off or “ready” action |
| **Information equipment** | Holo-reader, generator console | Bus + location/stand access |
| **Charging** | EV charge outlet | Bus + charge action |
| **Process / future** | Pumps, heaters | Bus + process state |

### Authored load identity

Every load that can draw must be addressable for authoring and runtime:

- stable id (kebab-case)
- room (and optional stand) when location matters
- human label
- **load class** (lighting, outlet, appliance, terminal, console, charger, other)
- **load rating** in watts when drawing (`loadW`, integer ≥ 0)
- optional **critical** flag (prefer keep when shedding)
- optional status lines for on / off / no-power cases

### Room lighting (canonical)

Room lighting is authored on the **room**, not as a free-floating puzzle:

```yaml
rooms:
  - id: conference
    lighting:
      enabled: true
      style: recessed          # recessed | strip | can | directional | mixed
      label: Conference Room lights
      activeLine: The conference room lights are on.
      switchNote: Wall switch by the kitchen door.
      nearDoor: conference-kitchen   # optional door reference
      loadW: 120                     # when fully lit / drawing
```

Rules:

1. If `room.lighting` is present and enabled, the room has fixtures and a wall
   switch.
2. Players may open/close the switch from **anywhere in the room** (no stand
   requirement). Narrative may place the switch by a door; gameplay does not
   require walking to that stand unless a later design adds it.
3. **Effective illumination** requires bus energized **and** switch closed.
4. Location media may use `when.roomLights: on | off` for effective
   illumination (see [location-media.md](location-media.md)).
5. `loadW` applies when lights are effectively on (drawing). Switch closed with
   bus dead draws **0 W** (no phantom load unless a later standby rating is
   added).

### Powered objects and appliances

Building `poweredObjects` and indoor actions may describe non-lighting loads
(outlets, stove, holo-reader, console, EV charger). Supported rules:

1. Objects may require the bus energized for active status and for actions that
   consume power.
2. Stand-scoped objects still respect stand proximity for interaction; power
   rules do not replace location rules.
3. An appliance that is “on” or “charging” while the bus is energized **draws**
   its rating; off/idle draws 0 W unless a standby rating is authored later.
4. Legacy `poweredObjects` with `kind: lights` may be accepted as a fallback
   only until content uses `room.lighting`; new content must use room lighting.

---

## Load Ratings

### Units

- Primary unit: **watts (`W`)**, non-negative integer.
- UI may display kW when values are large; storage and balance math use watts
  (or watt-hours for energy over time).

### When a rating applies

| Condition | Contribution to bus load |
| --- | --- |
| Bus not energized | 0 |
| Bus energized, load not armed / switch open / device off | 0 |
| Bus energized and load drawing | `loadW` (full rating for the first increment) |

### First-increment simplifications (supported)

- No continuous dimming curves in the balance equation (brownout may force
  loads off rather than fractional watts).
- No separate startup surge unless a load opts in later (`surgeW` + duration).
- No per-outlet metering UI required; aggregate station load is enough for
  Part I teaching.

### Authoring defaults

- Missing `loadW` on a drawing-capable load: treat as **0** for balance and
  emit an authoring **warning** (not a hard error) until ratings are filled.
- Critical infrastructure (e.g. control console) may use modest `loadW` and
  `critical: true` so shed policies can spare them.

---

## Aggregate Balance

### Definitions

Let:

- \(P_{gen}\) = available electrical supply to the bus (W) from generation
  (+ storage discharge when modeled)
- \(P_{load}\) = sum of `loadW` over all loads currently **drawing**
- \(P_{margin} = P_{gen} - P_{load}\)

### Supported states

| State | Condition | Player-facing intent |
| --- | --- | --- |
| **Offline** | Bus not energized | No service; devices dark / inactive |
| **Surplus** | Bus energized, \(P_{margin} \ge 0\) | Normal operation |
| **Deficit** | Bus energized, \(P_{margin} < 0\) | Overload; warnings and/or shed |

### Balance evaluation timing

Balance is recomputed when any of the following change:

- bus energization
- generation available output
- any load’s drawing state (light switch, appliance on/off, charge start/stop)
- storage charge/discharge mode (when modeled)

Evaluation is **event-driven** from game state changes, not dependent on a
background browser tick. Time advancement may re-evaluate if generation or
loads are time-dependent.

### Brownout and shed (supported policy)

When deficit occurs, the host applies a deterministic policy:

1. Surface a clear warning (status line and/or console).
2. **Shed** noncritical drawing loads until \(P_{margin} \ge 0\) or no
   noncritical loads remain.
3. Shed order: noncritical lighting first (optional room order), then
   noncritical appliances/chargers, then other noncritical loads. **Critical**
   loads shed last or never, per authoring.
4. Shed means: force load out of drawing state (e.g. open light switch or turn
   appliance off) and tell the player why.
5. Do not silently leave the system in an impossible “everything on” deficit
   without player-visible consequence.

Exact shed ordering IDs may be refined in implementation as long as the
policy remains deterministic and testable.

### Alpha / early-play exception

Until load ratings and balance are implemented, the bus may behave as
**binary energization only** (if online, all armed devices may appear active).
That exception ends when grid management ships against this contract; content
should not depend on infinite free power after that point.

---

## Runtime and Save State

### Facility / save fields (conceptual)

```js
// Indoor facility snapshot (names illustrative; implementation may nest)
{
  hydroOnline: boolean,           // bus energization for Part I
  lightSwitches: {
    [roomId]: true                // true = switch closed
  },
  // Future:
  // drawingDeviceIds or deviceRunState: { [loadId]: "off"|"drawing" }
  // storage: { energyWh, powerW }
}
```

Rules:

1. Switch and device states are **player/runtime state**, not rebuilt from
   content on every load except defaults for missing keys.
2. Default light switch state for a room with lighting: **open** (off).
3. Save/load must preserve light switch map and any device drawing state once
   modeled.
4. Live authoring of `room.lighting` or load ratings must not wipe player
   switch state for existing room ids.

### Host responsibilities

- Validate that actions cannot turn on drawing without meeting bus rules.
- Apply shed outcomes through the same path as player actions where possible
  (so state stays consistent).
- Expose read models for UI: bus online, \(P_{gen}\), \(P_{load}\), margin,
  per-room light effective on/off, list of drawing loads.

---

## Player-Facing Surfaces

### In rooms

- Status lines for lights (on / off / switch on but no station power).
- Actions: turn lights on/off (close/open switch) without stand requirement.
- Optional later: appliance on/off and charge actions with clear power gating.

### Console / control panel

- Generation readouts remain hydro-owned.
- Grid management should add a **station load** summary: total load, margin,
  warnings, optionally top drawing loads.
- Operator commands that only change panel view state must not mutate grid
  truth without a registered binding.

### Location media

- `stationPower: online | offline` — bus energization.
- `roomLights: on | off` — effective illumination for the current room.
- Do not use image conditions as a substitute for runtime light state.

---

## Authoring (World / Content Builder)

### Supported authoring

| Surface | Fields |
| --- | --- |
| Room | `lighting` object (enable, style, labels, switch note, near door, `loadW`) |
| Powered objects / devices | id, room, stand?, class, labels, `loadW`, critical? |
| Hydro config | generation capability via hydro contract |

### Builder UX expectations

- Room lighting is edited as a **room detail** in World Builder (not only as a
  free-floating powered-object list).
- Authors can set load ratings without code changes.
- Validation warns on missing `loadW` for enabled lighting and known drawing
  devices once balance is active; may remain soft during migration.

### YAML / SQLite

- Canonical store remains the building document in SQLite.
- YAML import/export preserves `room.lighting` and device load fields.

---

## Story and Modes

- **Story mode** may guide the player to restore generation before relying on
  lights and equipment; it must not claim lights work without bus rules.
- **Open-world** uses the same electrical truth; only guidance and action
  prominence differ.
- Story flags may mirror milestones (e.g. hydro online) but **effective power
  and load** come from this model + hydro facility state.

---

## Explicitly Out of Scope (Until Extended)

- Per-bulb circuit graphs and realistic breaker panels as puzzle simulators.
- Utility billing, net metering, or multiplayer shared grids.
- Thermal modeling of LED heat.
- Full electromagnetic simulation.
- Requiring the player to stand at the light switch for every room (optional
  later for specific puzzles only).

---

## Implementation Map (Reference)

| Concern | Likely home (illustrative) |
| --- | --- |
| Room lighting content | Building document `rooms[].lighting` |
| Light switch state | Indoor facility `lightSwitches` |
| Bus / hydro online | Hydro facility + station power helpers |
| Load aggregation | Future station-grid / facility service |
| Console load UI | Control panel modules |
| Room light images | Location media `when.roomLights` |

Update this map when code lands; do not treat paths as frozen APIs.

---

## Acceptance Criteria (Contract-Level)

A build satisfies this contract when:

1. Bus energization is a single clear runtime truth for the station.
2. Room lighting is room-authored; switches default open; effective lights need
   bus + closed switch.
3. Drawing loads have stable ids and can carry `loadW`.
4. When balance is enabled, \(P_{load}\) and \(P_{gen}\) are defined, and
   deficit produces deterministic, player-visible shed or equivalent.
5. Save/load preserves switch (and later device) state.
6. Location media and status lines do not contradict bus or light state.
7. Hydro remains the Part I generation source under its own contract.

Until load ratings and balance ship, criteria 3–4 may be partial; criteria 1–2
and 5–6 for lighting already apply to current work.

---

## Document History

- **2026-07-22** — Initial contract: station bus, room lighting switches, load
  ratings, aggregate balance, and brownout/shed policy. Captures intended
  direction before full grid-management implementation.
