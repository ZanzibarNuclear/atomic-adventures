# Station Electrical Grid

**Status:** Partial — bus energization, room light switches, and a coarse
four-circuit energy-sims registry exist. **Honest per-device draws, authored
circuits, and World Builder circuit editing are specified here and not yet
fully implemented.** Generation telemetry comes from Clearwater Station WASM.  
**Scope:** Utility-station (and later campus) electrical power: generation
connection to a station bus, **circuits**, **devices** that draw, wall switches,
appliances/fixtures, powered artifacts, load ratings, aggregate balance, and
player-facing consequences  
**Related:** [hydro-simulator.md](hydro-simulator.md),
[control-panel.md](control-panel.md), [location-media.md](location-media.md),
[indoor-stands.md](indoor-stands.md), [room-fixtures.md](room-fixtures.md),
[world-authoring.md](world-authoring.md),
[character-inventory.md](character-inventory.md),
[energy-sim-legacy-ripout.md](../plans/energy-sim-legacy-ripout.md)

**Decision (2026-08-07):** Stop treating “any light on → charge full building
lighting circuit nameplate.” Model **device draw (W)** honestly, group devices
onto **circuits** with capacity headroom, sum draws for station balance, and
author circuits + energy use in the **World Builder**. Brownout when demand
exceeds generation; **no** automatic priority shed ladder for Part I beta.

---

## Purpose

This contract defines how electricity works for gameplay at the utility
station: when something is *powered*, when it *draws load*, how generation and
consumption relate, and what the player can observe and change.

Part I teaches a hopeful, practical lesson: restoring hydro generation can
energize a building, but running lights and equipment is a real demand that
must stay within what the plant (and any buffer) can supply. Later parts may
extend the same model to PV, storage, and multi-building campus loads.

### Plant of record (decision note)

**2026-08-05:** Generation and the local station bus for Part I are the
**Clearwater Station** session in sibling **`../sims/energy-sims`**:

| Name | Role |
| --- | --- |
| **Clearwater Diversion** | Hydro plant that supplies the bus (`clearwater-diversion`) |
| **Clearwater Station** | Utility station — plant + load registry (`clearwater-station`) |
| **Clearwater Run** | Stream feeding the diversion (geography; discovery-gated name) |

Fixture: `../sims/energy-sims/fixtures/stations/clearwater-station.json`
(loads also under `fixtures/grids/clearwater-station.json`). Hydro physics and
available \(P_{gen}\) come from the nested Clearwater Diversion plant; this
contract owns how the **host** presents bus energization, **device and circuit
draws**, and balance, and how that maps into the Clearwater Station load
registry. Do not invent a second generation physics path in the game repo
([hydro-simulator.md](hydro-simulator.md)).

Player-facing names for the station and plant are discovery-gated; see
[hydro-simulator.md](hydro-simulator.md#plant-of-record-decision-note) and
[regional-geography.md](../../game-design/content/story/regional-geography.md).

This document is the long-lived record of intended behavior. Implementation
plans implement the contract; they do not redefine it.

## Design Goals

- One coherent **station bus** notion: either the building electrical system is
  energized or it is not, before finer load balance applies.
- Separate **energized**, **switched/armed**, and **actively drawing** states
  so lights and appliances can be modeled honestly.
- Separate **device draw** (what this thing uses right now) from **circuit
  capacity** (breaker/fuse headroom for normal operation).
- Author energy use and circuits in the **World Builder** so designers can
  balance play without editing engine fixtures by hand every time.
- Teach generation vs consumption with **honest watts** (console table Drawing
  column), not “any light → full building circuit nameplate.”
- Prefer cause and effect the player can reverse: turn loads off, restore
  generation, or (later) charge storage—not permanent soft-locks.
- Scale from Part I hydro + station circuits to later multi-source grids without
  renaming the core vocabulary.

## Relationship to Other Contracts

| Concern | Owner |
| --- | --- |
| Hydro generation physics, telemetry, startup | [hydro-simulator.md](hydro-simulator.md) |
| Operational console UI (gen + Clearwater Station grid) | [control-panel.md](control-panel.md) |
| Room photos that depend on effective lights | [location-media.md](location-media.md) (`roomLights`, `stationPower`) |
| Room geometry and stands | [indoor-stands.md](indoor-stands.md) |
| Fixed room fixtures and appliances (stove, sink, purifier, …) | [room-fixtures.md](room-fixtures.md) — **operation UI**; electrical draw rules here |
| Building document + World Builder surfaces | [world-authoring.md](world-authoring.md) — **circuits** authored here under this contract’s schema |
| Portable items, containers, tablets, meals | [character-inventory.md](character-inventory.md) — portable **powered artifacts** may declare draw when in use |

Hydro answers “how much can we generate right now?”  
This contract answers “what is connected, what is drawing, on which circuit, and
is demand within supply?”  
Room fixtures own **how the player operates** a stove burner or induction pot;
this contract owns **whether the bus can supply** that operation and how many
watts it draws while running.

---

## Vocabulary

| Term | Meaning |
| --- | --- |
| **Station bus** | The building’s shared AC (or modeled) distribution. When the bus is **energized**, outlets and devices *can* receive power. |
| **Station power online** | Bus energized. Part I binary media may track host hydro connect intent; console bus banner prefers engine `busEnergized`. |
| **Generation** | Sources that can supply the bus (Part I: hydro plant; later PV, storage discharge). |
| **Device** | A single addressable consumer: room lights for one room, one fixture control, holo-reader, operational console, EV charger, powered artifact in use, etc. |
| **Device draw** | Watts this device contributes **right now** while drawing (`0` when off / no bus). Authored as `loadW` or `loadWByLevel`. |
| **Circuit** | A panel/breaker row that groups one or more devices. Has capacity (fuse headroom) and current drawing (sum of its devices). |
| **Circuit capacity** | Authored max continuous draw the circuit is designed for under normal play (`capacityW`). UI **Rating** column. Must exceed sum of devices expected on together in normal ops. |
| **Circuit drawing** | \(\sum\) device draws on that circuit. UI **Drawing** column. |
| **Load** (generic) | Any device or circuit that can consume bus power when conditions allow. Prefer **device** / **circuit** when precise. |
| **Wall light switch** | Per-room control: **open** = off; **closed** = on if bus energized. |
| **Effective lights** | Illuminate only when bus energized **and** room switch closed. |
| **Armed / ready** | Device is set to run if the bus is energized (stove “on,” charge session armed). |
| **Drawing** | Device is contributing watts to its circuit and the station total. |
| **Balance** | \(P_{gen}\) vs \(P_{load}\) (sum of all device draws on the bus). |
| **Surplus / deficit** | Margin ≥ 0 / margin < 0. |
| **Brownout** | Player-visible consequence of deficit (warnings, dimming, console utilization over 100%). Part I beta: **report-only** — no automatic priority shed ladder. |

Electrical convention for wall switches matches ordinary wiring language:

- switch **open** → no light (default for unvisited rooms)  
- switch **closed** → lights on **only if** the station bus is energized  

---

## Layers of the Model

```text
Authored (building + world builder)
  circuits[]  (id, label, capacityW, deviceIds)
  devices: room.lighting.loadW, fixtures loadW / loadWByLevel,
           poweredObjects / terminals, powered artifacts
        │
        ▼
Runtime state (save)
  lightSwitches, fixture levels, charge sessions, active stage (console/lesson),
  hydro online / bus intent
        │
        ▼
Host draw evaluation
  for each device: P_device = f(bus, switch/level/stage)
  for each circuit: P_circuit = sum(P_device on circuit)
  P_load = sum(P_circuit)   [= sum all devices]
        │
        ▼
Engine / presentation
  P_gen from Clearwater Station session
  map circuits → energy-sims load rows (adapter)
  console: Energized banner, Generation / Station load / Margin, utilization,
           Loads table Circuit | Rating(capacity) | Drawing(P_circuit)
        │
        ▼
Player outcomes
  lit rooms, fixture behavior, brownout warning when P_load > P_gen
```

Story and lessons may explain the same layers; they must not invent a parallel
power truth.

---

## Circuits and devices (decision)

### Why two concepts

| | **Device** | **Circuit** |
| --- | --- | --- |
| Answers | “What is using power right now?” | “Which breaker/panel row is it on, and is that row oversized enough?” |
| Authored watts | **Draw** when on (`loadW`) | **Capacity** (`capacityW`) for normal ops headroom |
| Player sees | Effects (lights, heat, charge) | Clearwater Station grid table rows |
| Fail mode | Off when bus dead | Future: trip if over capacity (optional); station brownout if total over \(P_{gen}\) |

**Anti-pattern (current coarse host):** any room light switch → `lighting.main`
boolean → charge full **400 W** nameplate. That lies about a few LEDs and
hides the operational console’s own draw.

**Target:** control-room lights alone might draw **25–40 W**; the lighting
circuit capacity might be **200–400 W** so several rooms can be lit without
“blowing a fuse” under normal play. Station brownout only when **total** draw
exceeds generation (e.g. EV charge + kitchen + lights).

### Authored circuit shape

Circuits live on the **building document** (utility-station / Clearwater
Station workspace), not in story flags:

```yaml
circuits:
  - id: lighting.interior
    label: Interior lighting
    capacityW: 250          # fuse / design headroom
    deviceIds:
      - lighting.room.control-room
      - lighting.room.library
      - lighting.room.kitchen
      # … other lit rooms
  - id: console.control-room
    label: Control-room terminals
    capacityW: 150
    deviceIds:
      - terminal.operational-console
  - id: holo-reader.library
    label: Library holo-reader
    capacityW: 120
    deviceIds:
      - terminal.holo-reader.library
  - id: kitchen.appliances
    label: Kitchen appliance circuit
    capacityW: 3000
    deviceIds:
      - fixture.kitchen-stove
      # induction, etc.
  - id: ev-charge.port-1
    label: EV charge port
    capacityW: 4000
    deviceIds:
      - charger.ev.port-1
```

Rules:

1. Circuit **ids** are stable kebab-case; they should align with energy-sims
   load row ids when a row exists (adapter may 1:1 map).
2. **capacityW** ≥ sum of device draws expected on together in normal ops
   (authoring validation warning if a single device `loadW` > capacity, or if
   “all devices full-on” sum exceeds capacity without a note).
3. A device belongs to **at most one** circuit. Unassigned drawing devices still
   count in \(P_{load}\) and surface an authoring warning.
4. Circuits without devices are allowed as placeholders; Drawing = 0.
5. Priority / shed class fields are **optional and unused** for Part I beta
   (no auto-shed). Do not show Priority on the console.

### Authored device identity

Every device that can draw:

| Field | Meaning |
| --- | --- |
| `id` | Stable kebab-case |
| `class` | `lighting` \| `fixture` \| `terminal` \| `charger` \| `artifact` \| `outlet` \| `other` |
| `label` | Player/author label |
| `circuitId` | Owning circuit (or implied by circuit.deviceIds — one source of truth) |
| `loadW` | Watts when fully drawing (binary devices) |
| `loadWByLevel` | Optional multi-level watts (fixtures) |
| `room` / `stand` | When location matters |
| `drawWhen` | Host rule key: `roomLights` \| `stage:console` \| `stage:lesson` \| `fixture` \| `chargeSession` \| `flag:…` \| custom |
| `critical` | Optional; reserved for later shed policy |

Devices are **not** a free-floating parallel catalog forever: prefer existing
content homes:

| Device class | Authoring home |
| --- | --- |
| Room lighting | `rooms[].lighting` (+ `loadW`, optional `deviceId` / `circuitId`) |
| Appliances / process fixtures | `rooms[].fixtures[]` ([room-fixtures.md](room-fixtures.md)) + electrical fields |
| Fixed terminals (console, holo) | Building `poweredObjects` or dedicated terminal entries with `loadW` |
| EV charger | Building powered object / outdoor node with charge state |
| Portable powered artifacts | Character item definitions ([character-inventory.md](character-inventory.md)) with `loadW` + in-use rule |

### Host draw algorithm

```text
P_device(d) =
  0  if bus not energized
  0  if device control is off / switch open / stage closed / not in use
  loadWByLevel[level] or loadW  otherwise

P_circuit(c) = sum P_device(d) for d on c
P_load       = sum P_circuit(c)   // all devices on the bus
P_gen        = available generation serving the bus (engine)
P_margin     = P_gen - P_load
```

Console **Clearwater Station grid** table:

| Column | Source |
| --- | --- |
| Circuit | circuit label |
| Rating | `capacityW` (not “all devices maxed”) |
| Drawing | `P_circuit` right now |

Top readouts: Generation \(P_{gen}\), Station load \(P_{load}\), Margin
\(P_{margin}\). Display **W below 1 kW**, kW at 1 kW+. Utilization bar is
enough for surplus/deficit coloring — no separate “Grid status: surplus” line
required.

### Energy-sims / engine binding

Clearwater Station session load rows remain the engine’s circuit registry.

| Approach | Role |
| --- | --- |
| **Host-aggregated (target)** | Host computes \(P_{circuit}\). Adapter maps each circuit to an engine load id. Prefer watt-level or fractional drawing when the engine supports it; until then, boolean `set_load` may approximate “drawing if \(P_{circuit} > 0\)” while the **console Drawing column uses host watts** (engine totals may lag fidelity). |
| **Fine-grained engine loads** | Optional later: one engine load per device. Heavier fixtures; only if host aggregation is insufficient. |

Do **not** hard-code plant physics in the game. Do **host-own** device→watt
rules and circuit grouping so World Builder can edit them.

### Interim coarse registry (current code)

Until the inventory ships, the game may still use four boolean circuits
(`lighting.main` 400 W, holo 80 W, EV 3500 W, kitchen 1200 W). That path is
**technical debt**: replace with per-device draws + authored circuits. Do not
extend the coarse map with more booleans without ratings.

### Part I reference inventory (starting numbers)

Illustrative defaults for Clearwater Station play — authors may retune in World
Builder. Capacities leave headroom; draws are modest LEDs / terminals.

| Circuit id | capacityW (order of) | Devices (examples) | Device draw when on (order of) |
| --- | --- | --- | --- |
| `lighting.interior` | 250–400 | Each lit room’s `lighting` | 15–40 W per room |
| `console.control-room` | 100–150 | Operational console (stage `console` open) | 40–80 W |
| `holo-reader.library` | 100–120 | Holo-reader while lesson open | 50–100 W |
| `kitchen.appliances` | 2500–3500 | Stove burners / induction levels | per `loadWByLevel` |
| `ev-charge.port-1` | 3500–4000 | EV charge session | ~3000–3500 W |

**Operational console** must be a first-class drawing device whenever the
console stage is open and the bus is energized — it is not free energy.

---

## Station Bus

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

### Current implementation note (beta)

**Two layers — do not invent a third physics path.**

| Layer | Meaning | Durable in save? |
| --- | --- | --- |
| **Host connect intent** | Player completed (or Dev Tools forced) hydro connect-power: `facilities.hydro.online`, indoor `hydroOnline`, story flags such as `hub.hydro_online` | Yes |
| **Engine bus presentation** | Clearwater Station snapshot: `busEnergized`, `gridStatus` (e.g. ok / brownout / shortage), \(P_{gen}\), \(P_{load}\), `lightLevel` | No (recompute after rehydrate); optional opaque engine checkpoint only |

Rules for Part I:

1. **Generation and balance numbers** always come from energy-sims (WASM
   default). Never from a forked JS plant model.
2. **Binary “station power online” for indoor lights, doors, and location
   media** may track host connect intent after startup. That keeps save/load
   and lit-vs-unlit photos stable without requiring a live session before first
   paint. After the ops session rehydrates, console and future dimming must
   follow engine `busEnergized` / `gridStatus` / `lightLevel`.
3. Do **not** replace host connect intent with a free-form multi-state enum
   (`full` / `brownout` / `startup` / `off`) in save data unless product later
   needs it. Prefer:
   - host: field path + online intent + flags;
   - derived UI status: last engine snapshot (and host path when explaining
     “why offline”).
4. A later multi-source bus must still expose one clear binary “station power
   online” for content that only cares about lights-on vs lights-off.
5. **Dev Tools station-power toggle** sets host facility state as a completed
   (or fully reset) startup sequence and forces an engine session sync so
   console telemetry matches. It is not a separate cheat physics universe.

---

## Generation

### Supported rules

1. **Generation sources** declare an available output (watts or a hydro-derived
   electrical power) for the current game time and facility state.
2. Part I’s generation source is **Clearwater Diversion**, modeled via
   energy-sims and the hydro boundary in [hydro-simulator.md](hydro-simulator.md).
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
| **Appliances** | Electric stove burners, induction hot pot | Bus + per-control level (see [room-fixtures.md](room-fixtures.md)) |
| **Information equipment** | Holo-reader, generator console | Bus + location/stand access |
| **Charging** | EV charge outlet | Bus + charge action |
| **Process / future** | Pumps, heaters | Bus + process state |

**Non-electrical fixtures** (sink flow, tablet purifier) are still room fixtures
under [room-fixtures.md](room-fixtures.md). They do **not** contribute to bus
load unless an authored electrical stage is added later.

### Authored load identity

Every load that can draw must be addressable for authoring and runtime:

- stable id (kebab-case)
- room (and optional stand) when location matters
- human label
- **load class** (lighting, outlet, appliance, terminal, console, charger, other)
- **load rating** in watts when drawing (`loadW`, integer ≥ 0)
- optional **per-level ratings** for multi-state controls (see below)
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
6. Prefer **per-room** `loadW` (LED-scale), not one building-wide nameplate for
   “any light.” Assign the room light device to a lighting **circuit** via
   `circuitId` or the circuit’s `deviceIds` list.
7. Optional `deviceId` on `room.lighting` when the auto id
   `lighting.room.<roomId>` is not desired.

### Building fixtures as electrical loads

Fixed kitchen and lab equipment is **building structure**, not portable
artifacts. Authoring and player control live in
[room-fixtures.md](room-fixtures.md). For the grid:

1. Each electrical fixture (or each independently controlled part, such as a
   stove burner) is a load id when it can draw.
2. Multi-level controls (burner `low|medium|high`, induction heat) map to
   **drawing** only for levels other than `off`.
3. Prefer authored **per-level** watts when levels exist; otherwise use a single
   `loadW` for any non-off drawing state.
4. Fixture interaction may be stand-scoped; grid math uses drawing state only,
   not player stand.
5. Actions that need the bus but fire while offline must not leave the fixture
   in a “drawing” lie: either refuse, or arm the control and report no effect
   (same spirit as a light switch flipped with power out—see room lighting and
   fixture dead-bus notices).

Illustrative stove load contribution:

```text
P_stove = sum over burners b of loadW_b[level_b]
# level off → 0; low/medium/high → authored watts for that level
```

### Powered objects and fixed terminals

Building `poweredObjects` (and equivalent terminal entries) describe fixed
non-fixture consumers and status lines: outlets, holo-reader, **operational
console**, EV charger. Supported rules:

1. Objects may require the bus energized for active status and for actions that
   consume power.
2. Stand-scoped objects still respect stand proximity for interaction; power
   rules do not replace location rules.
3. While armed/on **and** bus energized, the device draws its `loadW` (or level
   table); off/idle draws 0 W unless a standby rating is authored later.
4. **Operational console:** when the player’s stage view is the operational
   console and the bus is energized, count `terminal.operational-console` (or
   authored id) as drawing — even if the player never toggles a separate switch.
5. **Holo-reader:** drawing while a lesson stage is open (bus energized).
6. **Do not** model multi-control kitchen equipment only as a single
   poweredObject status line. Use room fixtures for stove, sink, purifier, and
   induction pot; attach those fixtures to a kitchen **circuit**.
7. Legacy `poweredObjects` with `kind: lights` may be accepted as a fallback
   only until content uses `room.lighting`; new content must use room lighting.

### Portable powered artifacts

Portable items (tools, tablets, future gadgets) may declare electrical demand
when **in use** on the station bus (plugged in or facility-powered mode):

1. Item definition carries optional `loadW` / `loadWByLevel` and a draw rule
   (e.g. “while reading on station power,” “while charging”).
2. Runtime attaches the draw to a circuit (default shared outlets circuit or
   authored `circuitId`) only while the use condition holds.
3. Inventory rules stay in [character-inventory.md](character-inventory.md);
   this contract only owns the watt contribution and circuit membership.

---

## Load Ratings

### Units

- Primary unit: **watts (`W`)**, non-negative integer.
- UI: show **W below 1 kW**, kW at 1 kW and above (Clearwater Station grid
  readouts and load table). Storage and balance math use watts (or watt-hours
  for energy over time).

### When a rating applies

| Condition | Contribution to bus load |
| --- | --- |
| Bus not energized | 0 |
| Bus energized, load not armed / switch open / control `off` | 0 |
| Bus energized and load drawing at a discrete level | `loadW` or `loadWByLevel[level]` |
| Bus energized and binary load fully on | `loadW` |

### Multi-level drawing (supported)

For fixtures with ordered levels (e.g. `off < low < medium < high`):

```yaml
loadWByLevel:
  off: 0
  low: 400
  medium: 900
  high: 1500
```

Rules:

1. Missing level keys default to `0` for `off` and to `loadW` (or 0) for other
   levels until authors fill ratings.
2. Balance uses the **current** level only; it does not average or ramp.
3. Shed may force a control to `off` (or step down later); first grid increment
   may step straight to `off`.

### First-increment simplifications (supported)

- No continuous dimming curves in the balance equation (brownout may force
  loads off rather than fractional watts).
- No separate startup surge unless a load opts in later (`surgeW` + duration).
- No per-outlet metering UI required; aggregate station load is enough for
  Part I teaching.

### Authoring defaults

- Missing `loadW` / `loadWByLevel` on a drawing-capable load: treat as **0** for
  balance and emit an authoring **warning** (not a hard error) until ratings
  are filled.
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

### Brownout (Part I beta policy)

When deficit occurs (\(P_{load} > P_{gen}\)):

1. Surface a clear warning (console utilization / margin; optional status line).
2. **Report-only brownout** — do **not** auto-shed by priority ladder in Part I
   beta. The player learns by turning things off or restoring generation.
3. Optional later: dimming via engine `lightLevel` for media.
4. **Future shed policy** (not beta): deterministic shed of noncritical loads
   until margin recovers; `critical` devices last. Document ordering when that
   ships — do not imply it works today.

### Alpha / early-play exception (retiring)

Coarse boolean circuits and binary “any light → full nameplate” are **interim
only**. Once host device draws + authored circuits ship, content must not depend
on free infinite bus capacity or lying watt totals.

---

## Runtime and Save State

### Facility / save fields (conceptual)

```js
// Indoor facility snapshot (names illustrative; implementation may nest)
{
  hydroOnline: boolean,           // host connect intent / Part I binary bus for lights-media
  lightSwitches: {
    [roomId]: true                // true = switch closed
  },
  // Fixture control state — see room-fixtures.md
  // fixtures: {
  //   "kitchen-stove": { burners: ["off","low","off","off"] },
  //   "kitchen-sink": { flow: "off" },
  //   "kitchen-purifier": { hasTablet: true, filled: true, stage: "idle" },
  // }
  // storage: { energyWh, powerW }
}
// Engine-derived (not save truth): busEnergized, gridStatus, P_gen, P_load, lightLevel
// from Clearwater Station snapshot after host rehydrate.
```

Rules:

1. Switch and fixture control states are **player/runtime state**, not rebuilt
   from content on every load except defaults for missing keys.
2. Default light switch state for a room with lighting: **open** (off).
3. Default multi-level fixture controls: all levels **`off`** (or fixture-kind
   default in [room-fixtures.md](room-fixtures.md)).
4. Save/load must preserve light switches and fixture control state.
5. Live authoring of `room.lighting`, fixtures, or load ratings must not wipe
   player control state for existing ids.

### Host responsibilities

- Validate that actions cannot turn on drawing without meeting bus rules.
- Apply shed outcomes through the same path as player actions where possible
  (so state stays consistent).
- Expose read models for UI: bus online, \(P_{gen}\), \(P_{load}\), margin,
  per-room light effective on/off, list of drawing loads.

---

## Player-Facing Surfaces

### In rooms

- Status lines for lights (on / off when bus state is knowable).
- Actions: turn lights on/off or flip switch when power is out (see lighting
  rules above).
- Fixture actions from [room-fixtures.md](room-fixtures.md): burners, sink
  flow, purifier charge, induction heat—gated by stand reach where authored.
- Dead-bus or empty-result fixture actions may post short notices on the play
  message bus without mutating grid truth incorrectly.

### Console / control panel

See locked chrome in [control-panel.md](control-panel.md) (**Clearwater Station
grid** screen):

- Status banner: **Energized** / **Offline** + game clock.
- Generation, Station load, Margin (host/engine watts; W under 1 kW).
- Utilization bar (no separate “Grid status: surplus” line required).
- Loads table: **Circuit | Rating (capacity) | Drawing (\(P_{circuit}\))** —
  no Priority column for beta.
- Hydro screen remains generation path + plant badges; does not replace grid
  accounting.

### Location media

- `stationPower: online | offline` — bus energization.
- `roomLights: on | off` — effective illumination for the current room.
- Do not use image conditions as a substitute for runtime light state.

---

## Authoring (World Builder)

Circuits and energy use are **world/building content**, edited in the World
Builder (`/builder/world`, utility-station / Clearwater Station workspace).
They are not story-only flags and not hidden only inside energy-sims fixtures
(fixtures stay plant-of-record for generation; circuit **capacity and membership**
are authored for the game host and synced/adapted to the engine).

### Supported authoring surfaces

| Surface | Fields / responsibility |
| --- | --- |
| **Building `circuits[]`** (**new**) | id, label, `capacityW`, ordered `deviceIds[]`, optional notes |
| Room `lighting` | enable, style, labels, switch note, near door, **`loadW`**, optional `deviceId` / `circuitId` |
| Room `fixtures[]` | kinds, stands, controls ([room-fixtures.md](room-fixtures.md)), **`loadW` / `loadWByLevel`**, `circuitId` / membership |
| Powered objects / terminals | id, room, stand?, class, labels, **`loadW`**, drawWhen, circuit membership, critical? |
| Portable artifacts | item defs with optional electrical draw (Content / character catalog) |
| Hydro / plant | generation via [hydro-simulator.md](hydro-simulator.md) / energy-sims — not circuit lists |

### World Builder UX (target)

1. **Circuits panel** on the building: list/add/rename circuits; edit capacity;
   assign devices via multi-select or drag from a device inventory.
2. **Device energy fields** on room lighting, fixture inspectors, and powered
   object inspectors: `loadW` / levels, preview “drawing now” in authoring
   playtest when possible.
3. **Validation**: warn if device draw > circuit capacity; warn if unassigned
   drawing devices; warn if missing `loadW` on drawing-capable devices; warn if
   circuit id does not map to an engine load row when binding is required.
4. **Do not** require authors to edit vendored WASM JSON for everyday watt
   tuning; promote engine fixture changes only when plant/grid **schema** or
   stable circuit ids change (sync script / energy-sims lab).
5. Live authoring must not wipe player `lightSwitches` / fixture state for
   existing ids when only ratings or circuit membership change.

### Relationship to room fixtures and artifacts

- **Fixtures** remain the interaction model (burners, flow, heat). Electrical
  fields on fixtures are the grid contract’s concern; fixture kinds stay in
  [room-fixtures.md](room-fixtures.md).
- **Powered artifacts** remain inventory items; optional electrical section on
  the item definition feeds this contract when in use on the bus.
- **Console / holo** are terminals: authored once as devices, drawWhen tied to
  stage views.

### Builder UX expectations

- **Circuits** are a first-class building editor surface (not only raw JSON).
- Room lighting is edited as a **room detail** (not only a free-floating
  powered-object list), including `loadW`.
- Room fixtures are room details with kind-specific fields **and** electrical
  ratings / circuit membership.
- Authors can set load ratings and circuit membership without code changes.
- Validation warns on missing `loadW`, oversubscribed circuits, and unassigned
  devices once balance is active; may remain soft during migration.

### YAML / SQLite

- Canonical store remains the building document in SQLite
  (`utility-station` / Clearwater Station building).
- YAML import/export preserves `circuits[]`, `room.lighting`, `room.fixtures`,
  powered objects/terminals, and device load fields.

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
| Circuits content | Building document `circuits[]` |
| Room lighting content | Building `rooms[].lighting` (+ loadW) |
| Light switch state | Indoor facility `lightSwitches` |
| Fixture electrical | Building fixtures + [room-fixtures.md](room-fixtures.md) |
| Bus / hydro online | Hydro facility + station power helpers |
| Device → watt evaluation | Host `deriveStationDraw` / station-grid service (target) |
| Engine load rows | energy-sims Clearwater Station adapter |
| Console load UI | [control-panel.md](control-panel.md) Clearwater Station grid |
| Room light images | Location media `when.roomLights` |
| World Builder circuits UI | `/builder/world` building workspace |

Update this map when code lands; do not treat paths as frozen APIs.

---

## Acceptance Criteria (Contract-Level)

A build satisfies this contract when:

1. Bus energization is a single clear runtime truth for the station.
2. Room lighting is room-authored; switches default open; effective lights need
   bus + closed switch; **per-room `loadW`** (not one shared nameplate for any
   light).
3. Devices have stable ids and `loadW` / levels; circuits have `capacityW` and
   device membership.
4. \(P_{device}\), \(P_{circuit}\), \(P_{load}\) follow the host algorithm;
   console Drawing matches \(P_{circuit}\).
5. Operational console and holo-reader count as drawing terminals when open.
6. Electrical fixtures report drawing only when bus is energized and controls
   are above `off`.
7. When balance is enabled, deficit produces player-visible brownout/warning
   (Part I beta: report-only; utilization/margin).
8. Save/load preserves light switches and fixture control state.
9. Location media and status lines do not contradict bus or light state.
10. Hydro remains the Part I generation source under its own contract.
11. World Builder can author circuits and device energy fields without hand-editing
    WASM JSON for routine watt changes.

Until device/circuit authoring ships, criteria 3–5 and 11 may be partial;
criteria 1–2 and 8–9 for lighting already apply. Kitchen fixture **interaction**
completeness is owned by [room-fixtures.md](room-fixtures.md).

---

## Document History

- **2026-08-07** — Circuits vs devices, host draw algorithm, Part I inventory,
  report-only brownout, World Builder circuit authoring, operational console as
  load; retire coarse “any light → 400 W” as the target model.
- **2026-08-05** — Plant of record: Clearwater Station session + Clearwater
  Diversion plant in `../sims/energy-sims`; supersedes informal “Upper Penstock”
  generation wording for Part I.
- **2026-08-07** — Draft Upper Penstock / Mill Brook IDs and copy fully retired
  in favor of Clearwater Diversion / Clearwater Run.
- **2026-07-22** — Initial contract: station bus, room lighting switches, load
  ratings, aggregate balance, and brownout/shed policy. Captures intended
  direction before full grid-management implementation.
- **2026-07-22** — Building fixtures as multi-level electrical loads; link to
  room-fixtures contract for stove, sink, purifier, and kitchen play.
