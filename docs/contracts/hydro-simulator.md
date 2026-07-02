# Hydro Simulator

**Status:** Alpha runtime implemented; broader operations contract still shaping  
**Scope:** `game/` Upper Penstock hydro simulation runtime, game-environment
inputs, facility state, simulator outcomes, and future lesson/simulation reuse

---

## Purpose

The hydro simulator is the Part I facility model for the campus diversion
plant. It turns current game-world conditions, fixed plant configuration,
facility condition, and operator settings into production values for an elapsed
game-time interval: flow, pressure, effective head, electrical output, energy
generated, station power served, warnings, faults, and outcomes.

The current alpha implementation covers the first hydro startup and monitoring
slice with a code-built `hydro-generator-baseline` configuration, persistent
`gameState.facilities.hydro` state, host-owned field action updates, live
telemetry, compact event history, and console graph review. Authored
configuration profiles, complex operator controls, full operations rounds, and
story-level simulation gates remain future contract work.

This contract owns the hydro model and its boundary with the game. It does not
own the visual console layout, chart components, building connectivity map, or
general panel navigation. Those concerns live in [control-panel.md](control-panel.md).

The model starts from the simplified hydro equation used by the sibling
`../welcome` simulator:

```txt
P_elec = eta * rho * g * Q * H_net
H_net = H_gross - head_loss
```

Atomic Adventures keeps that real physics core, but game state supplies many
of the inputs. Stream condition, intake cover, debris, valve positions, leakage,
plant health, simplified station demand, and story phase should all matter.

## Design Goals

- Ground the model in the local Part I plant: Mill Brook, intake/weir,
  penstock, powerhouse, generator, and hydro control room.
- Use real units and tested formula helpers for power calculations.
- Let story, world, time, and facility state provide environmental inputs.
- Keep simulator internals separate from story flags, character effects, save
  writes, and panel rendering.
- Support both the one-time startup gate and recurring operations rounds.
- Evaluate production over explicit game-time intervals instead of requiring a
  continuously running browser process.
- Produce live telemetry samples while the player watches a monitor, and
  regenerate equivalent samples later when the player reviews time spent away.
- Store enough history for meaningful graph review without growing unbounded
  per-second datasets.
- Teach head, flow, losses, efficiency, and available electrical output
  through visible cause and effect.
- Begin with an easy mode where the plant is full, clean, laminar, and stable,
  then layer challenges that reduce production until the player restores good
  operating conditions.
- Keep failure educational and recoverable.
- Report explicit validated outcomes for story and character progression.

## Relationship to Existing Contracts

Hydro simulator views use the `simulation` stage view kind from
[stage-views.md](stage-views.md), usually hosted inside a console described by
[control-panel.md](control-panel.md). Opening the simulator changes the stage
view, not the player's logical map location.

Hydro learning content introduces the same concepts and equations through the
holo-reader contract in [holo-reader.md](holo-reader.md). Lessons can embed
practice versions of the model, but the operational simulator is bound to the
current game environment and player facility state.

Player rewards, qualifications, quest progress, and document/knowledge grants
use the shared effect boundary from
[character-inventory.md](character-inventory.md). The simulator reports a
registered outcome; the host validates and commits effects atomically.

The broad subject-matter design remains in
`game-design/content/subject-matter/hydro-simulation.md`. This document defines
the implementation-facing runtime contract.

## Runtime Surface

A story choice, room interaction, or console module may open the hydro
simulator with a stage view payload:

```js
{
  kind: "simulation",
  payload: {
    simulationId: "hydro-upper-penstock",
    panelId: "hydro-control-room-panel",
    mode: "startup"
  }
}
```

Supported initial modes:

| Mode | Meaning |
| --- | --- |
| `startup` | Guided one-time plant startup sequence |
| `operations` | Recurring plant monitoring and load management |
| `sandbox` | Optional lesson/practice mode not bound to save outcomes |

The host owns opening, closing, save persistence, game-time advancement,
outcome validation, and effects. The simulator owns interval production
calculation, current telemetry, accepted operator inputs, scenario rules,
warnings, faults, and declared outcome reports.

## Canonical State Boundaries

The simulator reads three classes of data.

### Plant Configuration

Plant configuration is authored content. It describes one possible setup for
the Upper Penstock plant. The game should be able to swap among configuration
profiles for what-if analysis, author tuning, upgrades, and story progression
without rewiring game logic.

```js
{
  configId: "upper-penstock-baseline",
  plantId: "upper-penstock",
  label: "Upper Penstock baseline",
  plantType: "diversion-run-of-river",
  tags: ["baseline", "easy-mode"],
  equationInputs: {
    netHeadM: 22.86,
    designFlowM3s: 1.8,
    baseTurbineEfficiency: 0.87,
    baseGeneratorEfficiency: 0.96,
    ratedPowerKw: 350
  },
  stream: {
    sourceId: "mill-brook",
    easyModeFlowM3s: 1.8,
    minimumUsefulFlowM3s: 0.3
  },
  intake: {
    id: "upper-intake",
    maxCaptureFlowM3s: 1.8,
    coveredOpenAreaM2: 1.2,
    trashRackLossCoefficient: 0.12
  },
  penstock: {
    id: "upper-penstock-pipe",
    lengthM: 420,
    diameterM: 0.9,
    grossHeadM: 42,
    frictionLossCoefficient: 0.03,
    minorLossCoefficient: 0.08
  },
  pressureGauge: {
    id: "powerhouse-entry-gauge",
    location: "powerhouse-entry"
  },
  turbine: {
    id: "upper-turbine",
    type: "francis",
    designFlowM3s: 1.8,
    maxSafeFlowM3s: 2.2,
    ratedSpeedRpm: 900,
    baseEfficiency: 0.87,
    minSyncSpeedRpm: 855,
    maxSyncSpeedRpm: 945
  },
  generator: {
    id: "upper-generator",
    ratedPowerKw: 560,
    baseEfficiency: 0.96
  }
}
```

Open question: final numeric values need calibration against the story's
desired scale for station comfort and later campus loads. The contract should
preserve units even while numbers change.

### Configuration Profiles

A hydro area may have multiple compatible configuration profiles:

| Profile kind | Use |
| --- | --- |
| `baseline` | The first authored setup for the local plant |
| `what-if` | Non-durable analysis such as "what if net head is 50 ft or 75 ft?" |
| `simplified` | Easy teaching configuration with fewer active losses and controls |
| `upgrade` | Durable game progression, such as a better turbine or improved intake |
| `tradeoff` | Better performance with harder maintenance, or easier maintenance at lower output |

Configuration swaps should be explicit events:

```js
{
  eventId: "hydro-config-swap-75ft-head",
  plantId: "upper-penstock",
  elapsedMinutes: 1180,
  type: "configuration-selected",
  source: "control-panel",
  actor: "player",
  payload: {
    previousConfigId: "upper-penstock-baseline",
    nextConfigId: "upper-penstock-75ft-head",
    durable: false
  }
}
```

For sandbox and what-if analysis, `durable: false` means the selected profile
affects only the current comparison or replay. For story upgrades,
`durable: true` means the host may persist the new active `configId` in
facility state after validating requirements and effects.

Profile variants should share the same plant and connection IDs where possible
so the control panel, map references, and story beats do not need to change.
The profile changes the model parameters, not the existence of the local
equipment unless an authored upgrade intentionally adds or removes a component.

Example what-if profiles:

```js
[
  {
    configId: "upper-penstock-50ft-head",
    plantId: "upper-penstock",
    label: "What if: 50 ft net head",
    profileKind: "what-if",
    equationInputs: {
      netHeadM: 15.24,
      designFlowM3s: 1.8,
      baseTurbineEfficiency: 0.87,
      baseGeneratorEfficiency: 0.96
    }
  },
  {
    configId: "upper-penstock-75ft-head",
    plantId: "upper-penstock",
    label: "What if: 75 ft net head",
    profileKind: "what-if",
    equationInputs: {
      netHeadM: 22.86,
      designFlowM3s: 1.8,
      baseTurbineEfficiency: 0.87,
      baseGeneratorEfficiency: 0.96
    }
  }
]
```

The simulator only needs the current values needed by the equation to compute
power. Rich component fields exist to support controls, faults, maintenance,
and player understanding; they should not be required for the first easy-mode
calculation.

## Calibration and Alpha Assumptions

The alpha target should be modest: enough power to make the utility station
feel alive, not enough to model a full campus grid. Start by exploring roughly
**100 W to 2 kW** of hydro output. That range is realistic for pico-hydro and
small micro-hydro if the site has enough head or enough diverted flow.

For early tuning, assume:

- large, fast-moving stream or small river;
- run-of-river diversion with no large storage reservoir;
- simplified laminar/steady pipe behavior;
- total electrical efficiency around `0.55` for conservative early examples
  unless a profile says otherwise;
- pipe/friction/head-loss details folded into `netHeadM`;
- a hidden battery/inverter system smooths output and handles the hard
  electrical details.

The core formula gives these rough flow requirements:

| Net head | 100 W | 500 W | 1 kW | 2 kW |
| --- | ---: | ---: | ---: | ---: |
| 10 ft / 3.05 m | 0.0061 m3/s / 96 gpm | 0.0304 m3/s / 482 gpm | 0.0608 m3/s / 964 gpm | 0.1217 m3/s / 1,928 gpm |
| 25 ft / 7.62 m | 0.0024 m3/s / 39 gpm | 0.0122 m3/s / 193 gpm | 0.0243 m3/s / 386 gpm | 0.0487 m3/s / 771 gpm |
| 50 ft / 15.24 m | 0.0012 m3/s / 19 gpm | 0.0061 m3/s / 96 gpm | 0.0122 m3/s / 193 gpm | 0.0243 m3/s / 386 gpm |
| 75 ft / 22.86 m | 0.0008 m3/s / 13 gpm | 0.0041 m3/s / 64 gpm | 0.0081 m3/s / 129 gpm | 0.0162 m3/s / 257 gpm |

Interpretation:

- `100 W` is easy to justify almost anywhere with visible moving water and
  useful head.
- `500 W` is a good first-light target: lights, reader, trickle charging, and
  the emotional "the station is alive" moment.
- `1-2 kW` is plausible with 50-75 ft of net head and a pipe that can carry a
  few hundred gallons per minute, or with lower head if the stream is closer to
  a small river.
- Low-head, high-flow options need larger pipes/channels and are more likely
  to feel like a river installation than a mountain-stream penstock.

Very rough pipe intuition for the alpha:

| Scenario | Flow | Plausible pipe impression |
| --- | ---: | --- |
| 2 kW at 75 ft | ~0.016 m3/s / 257 gpm | 4-6 inch penstock can feel plausible |
| 2 kW at 50 ft | ~0.024 m3/s / 386 gpm | 6 inch penstock is a good visual target |
| 2 kW at 25 ft | ~0.049 m3/s / 771 gpm | 8 inch or larger starts to feel more like a serious diversion |
| 2 kW at 10 ft | ~0.122 m3/s / 1,928 gpm | large pipe/channel; probably a small river setup |

These numbers are preliminary story-engineering values. They are not final
site design. We should tune them by trying several configuration profiles in
the simulator and choosing the one that makes the gameplay feel right.

### Turbine and Generator Assumptions

For alpha, use a simplified packaged turbine-generator module:

```js
{
  turbineType: "smart-micro-hydro",
  turbineEfficiency: 0.70,
  generatorEfficiency: 0.80,
  electricalMode: "battery-inverter-buffered"
}
```

This lets the player learn head, flow, blockage, leakage, and output before the
game asks them to understand generator synchronization, governors, load banks,
or inverters.

Future lesson and item-detail material can unpack more realistic options:

- Pelton or Turgo impulse turbines for higher-head, lower-flow penstocks;
- crossflow or propeller/Kaplan-style turbines for lower-head, higher-flow
  sites;
- pumps used as turbines for cheap rugged installations;
- permanent-magnet alternator plus rectifier and battery/inverter;
- induction or synchronous generator behavior for grid-like systems;
- governors, dump loads, and frequency control.

The game can expose those details later through holo-lessons, equipment labels,
or boxes of replacement parts. They should not block the alpha startup loop.

### Environment and Facility State

Environment and facility inputs are read from game state, authored world state,
clock, story flags, and persisted facility state. They represent the plant as
it exists at the start of an interval:

| Input | Unit / Type | Source | Meaning |
| --- | --- | --- | --- |
| `streamFlowAvailableM3s` | m^3/s | weather, season, story events | Mill Brook water available at the intake |
| `intakeCoverFraction` | 0-1 | facility state | Fraction of intake cover/trash rack physically closed or covered |
| `intakeDebrisFraction` | 0-1 | facility state | Fraction of remaining intake area blocked by leaves, branches, ice, silt |
| `penstockIntegrity` | 0-1 | facility state | Pipe health; lower values add losses and fault risk |
| `leakageFraction` | 0-1 | facility state | Fraction of captured water lost before the turbine |
| `screenCleared` | boolean | world interaction / item action | Whether Zanzibar has cleared the intake screen |
| `entryValveServiceable` | boolean | facility state | Whether the powerhouse entry valve can move |
| `generatorAvailable` | boolean | story/facility state | Whether the generator module can make usable power |
| `buildingPowerRequiredKw` | kW | story phase | Simplified power threshold for "station power on" |

The simulator must not invent durable stream, debris, damage, leakage, or
power-demand facts. It receives those facts from the host or from a registered
facility-state store. A simulation outcome may recommend facility changes, but
the host validates and commits them.

### Operator Inputs

Operator inputs may come from the control panel, a tutorial overlay, tests, or
future automation. They are commands to the simulator, not UI state.

| Input | Range / Values | Notes |
| --- | --- | --- |
| `intakeGatePercent` | 0-100 | Diverts available stream flow into the intake |
| `penstockValvePercent` | 0-100 | Upstream valve along the penstock path |
| `bypassValvePercent` | 0-100 | Sends water around the turbine during startup or shutdown |
| `entryValvePercent` | 0-100 | Powerhouse valve admitting penstock flow to the turbine |
| `exciterEnabled` | boolean | Allows generator voltage buildup |
| `generatorSwitchClosed` | boolean | Alpha control-room switch that accepts hydro power into the station system |
| `emergencyStop` | boolean command | Closes admission and opens bypass immediately |

Operator input state should be serializable if an operation scenario spans a
save. Hovered graph points, selected panel tabs, and animation state are panel
view state and are not simulator inputs.

Changes to operator inputs are timestamped events. If the player closes a
valve halfway through a one-hour operating interval, the simulator evaluates
the first half with the old valve position and the second half with the new
position.

## Interval Model

The simulator does not need to run continuously. It evaluates production when
the game asks for a data collection, scenario result, panel refresh, or
save/load reconciliation.

The input to an interval evaluation is:

```js
{
  fromElapsedMinutes: 1140,
  toElapsedMinutes: 1200,
  plantConfigId: "upper-penstock",
  startingFacilityState: {},
  startingOperatorInputs: {},
  events: [
    {
      elapsedMinutes: 1170,
      type: "operator-input",
      changes: { entryValvePercent: 0 }
    }
  ]
}
```

The simulator sorts events by time, splits the interval at each event, and
evaluates each sub-interval with the state in effect during that span. The
result is a summary plus the ending telemetry snapshot:

```js
{
  durationMinutes: 60,
  energyGeneratedKwh: 331,
  averagePowerKw: 331,
  servedEnergyKwh: 260,
  spilledEnergyKwh: 71,
  brownoutMinutes: 0,
  subIntervals: [],
  endingTelemetry: {}
}
```

This matches the game-time contract: restored systems can run over minutes,
days, and weeks without requiring the player to watch every second.

## Event Log

Every meaningful change to the hydro system is an event. The event log is the
durable narrative of the plant: startup actions, automatic threshold crossings,
faults, repairs, control changes, load changes, and data collections. Graphs
are sampled from state over time, but events explain why the graph changed.

Event records should have a stable shape:

```js
{
  eventId: "hydro-event-1148-pressure-ready",
  plantId: "upper-penstock",
  elapsedMinutes: 1148,
  type: "threshold-crossed",
  source: "simulator",
  actor: "system",
  label: "Penstock pressure reached startup threshold",
  payload: {
    metric: "penstockPressureKpa",
    thresholdKpa: 320,
    valueKpa: 334
  }
}
```

Initial event types should begin small:

| Event type | Meaning |
| --- | --- |
| `operator-input` | Valve, gate, switch, exciter, or later breaker setting changed |
| `configuration-selected` | Active configuration profile changed for what-if analysis or an upgrade |
| `facility-change` | Debris cleared, intake cover moved, leak repaired, or component state changed |
| `environment-change` | Stream flow changed because authored weather, time, or story state changed |
| `load-change` | Campus demand changed because circuits or story systems changed |
| `threshold-crossed` | A simulator metric crossed a meaningful authored threshold |
| `fault-triggered` | A warning became a fault, trip, brownout, or shutdown |
| `state-transition` | The plant moved between startup/online/offline/faulted states |
| `data-collection` | Player or system requested a production reading/report |

Events are facts from the host or registered systems. The simulator applies
them in order for calculation, but it does not decide that Zanzibar repaired a
leak or that rain began. The simulator may emit derived events such as
`threshold-crossed`, `fault-triggered`, and `state-transition` when calculated
telemetry crosses authored scenario criteria.

Event ordering rules:

- Events are sorted by `elapsedMinutes`, then by deterministic insertion order
  or event ID.
- Multiple events may share the same timestamp, such as a switch command and a
  state transition accepted by the simulator.
- Events are append-only for a playthrough. Corrections should be represented
  by later events unless a developer tool is explicitly repairing a save.
- Each event should name the actor when known: `player`, `system`,
  `environment`, `simulator`, or a future NPC/system ID.

Events used for graph replay should keep enough payload to reconstruct the
state change without parsing display text. Labels are player-facing summaries,
not the source of truth.

## Active and Historical Simulation

The same simulator supports two execution styles.

For alpha, simulation catch-up should be **on demand and event driven**:

- when the player opens the hydro monitor, catch up from the last checkpoint to
  current game time and show a brief loading state if needed;
- when a hydro event occurs, record it immediately and update the next
  collection/replay range;
- while the panel remains open, stream live samples;
- when the player leaves the panel, stop live sampling and rely on event log
  plus checkpoints until the next request.

This avoids background work until there is something to show or a system event
that changes the plant.

### Live Monitor Mode

When the player is watching the hydro control panel's real-time monitor, the
host asks the simulator for regular samples. The graph line should move forward
as game time advances. On an easy-mode day, power may be a steady line. On an
operations day, the line may drift as debris accumulates, stream flow changes,
load changes, or plant faults occur.

Live sampling rules:

- The source of time is authored game time, not wall-clock time.
- A control panel may display one second of real time as one minute, five
  minutes, or another authored simulation rate.
- The simulator should produce graph samples at a panel-friendly cadence, such
  as one visible sample every 1-5 simulated minutes for normal operations.
- The live monitor does not need to persist every displayed point. It may keep a
  temporary high-resolution buffer for the visible chart window.
- Operator controls dispatched from the panel become timestamped
  `operator-input` events and affect subsequent samples.

### Backfilled History Mode

When the player leaves the control room and returns later, the game may ask the
simulator to generate telemetry for the elapsed interval. If Zanzibar spends 45
minutes walking between hexes, the graph can be reconstructed from the last
known sample, facility state, and events that occurred while he was away.

Backfill rules:

- The evaluator starts from the most recent stored checkpoint at or before the
  requested time.
- It replays stored events in order: leaks, valve changes, debris clearing,
  weather/stream changes, circuit load changes, and data-collection points.
- It emits graph samples at the requested resolution, plus exact event-marker
  samples at event times.
- A leak that occurs halfway through the interval should appear as a visible
  pressure drop, slower turbine rotation, and lower power output at that game
  time.
- Closing a diversion or penstock valve should trend flow, turbine speed, and
  generated power toward zero according to the simplified response model.

Backfilled graph samples are derived data. They may be cached, but the durable
source of truth is the checkpoint plus event log unless a scenario explicitly
records a report artifact.

### Replay Mode

Replay mode is a historical view with playback controls. It uses the same data
as backfill, but presents it as a time-moving graph with event markers. The
player should be able to replay the startup sequence or a fault window and see:

- the graph line moving through time;
- markers for operator and simulator events;
- pressure rising after intake and valve changes;
- turbine speed changing after flow reaches the turbine;
- generator output appearing only after the switch/power-acceptance event;
- power dropping when a leak, valve closure, trip, or load event occurs.

Replay does not change facility state. It is a read-only visualization of past
events, samples, and regenerated telemetry.

### Response Shapes

Most interval segments are steady-state. Some events should have a short
transition shape so graphs read naturally:

| Event | Suggested graph shape |
| --- | --- |
| Intake debris accumulation | Slow decline in captured flow and power over the authored accumulation interval |
| Pipe leak | Step or short ramp down in pressure, turbine speed, and power |
| Valve closure | Ramp down toward the new steady state over an authored spin-down duration |
| Valve opening | Ramp up toward the new steady state after penstock fill/pressure delay |
| Pressure threshold crossed | Marker on pressure graph; unlocks next startup action if scenario requires it |
| Turbine started | Ramp speed toward operating band |
| Generator switch closed | Step or ramp in generator output once the station accepts hydro power |
| Load added | Step up in demand; voltage/brownout response if generation is insufficient |

Transition shapes are visualization and simplified operations behavior, not a
full fluid transient model. The event time remains exact even if the displayed
line ramps for readability.

## Sampling and Retention

Hydro telemetry is potentially large. The simulator should keep distinct data
layers rather than storing every point forever.

| Layer | Resolution | Retention | Purpose |
| --- | --- | --- | --- |
| Live buffer | Panel cadence, such as 1 sample per 1-5 simulated minutes | While panel/session is open | Smooth real-time monitor drawing |
| Recent samples | 1-5 simulated minute samples | Current scenario or recent game day | Review what just happened |
| Event samples | Exact event time plus before/after snapshots | Until scenario/report retention expires | Preserve visible jumps and diagnosis points |
| Hour rollups | One aggregate per game hour | Long-term save data | Trends without heavy storage |
| Day rollups | One aggregate per game day | Long-term save data | Progress, qualification, and reports |

Recommended time slices:

| Use case | Slice |
| --- | --- |
| Live control-panel line | 1 simulated minute while visible |
| Recent review without events | 5 simulated minutes |
| Around important events | Exact event time plus before/after samples |
| Startup or fault diagnosis | 15-60 simulated second samples only for the active scenario window |
| Long-term trend | 1 game-hour rollups |
| Campaign progress | 1 game-day rollups |

Sampling should be adaptive. A flat easy-mode hour does not need sixty durable
points if it can be represented by one steady segment and an hourly rollup. A
leak, valve closure, trip, or repair should keep enough samples around the
event to show what changed.

Recommended MVP retention:

- keep high-resolution samples for the current operations round or current
  game day;
- always keep exact event markers and before/after snapshots for unresolved
  faults or authored report windows;
- compress older high-resolution samples into hourly rollups;
- compress older hourly rollups into day rollups when detailed review is no
  longer needed;
- keep scenario completion summaries as separate outcome records.

Rollups should store aggregates rather than chart pixels:

```js
{
  plantId: "upper-penstock",
  bucket: "hour",
  fromElapsedMinutes: 1140,
  toElapsedMinutes: 1200,
  sampleCount: 12,
  energyGeneratedKwh: 331,
  servedEnergyKwh: 260,
  averagePowerKw: 331,
  minPowerKw: 298,
  maxPowerKw: 361,
  minPressureKpa: 342,
  maxPressureKpa: 374,
  brownoutMinutes: 0,
  eventIds: ["hydro-event-1170-leak"]
}
```

The control panel can graph rollups as a lower-resolution historical view. When
the player zooms into a time range that still has recent samples or event
snapshots, the panel can show finer detail.

## Storage Model

Development currently uses local save data and SQLite content separately. The
hydro runtime history belongs to player/facility save data, not canonical
authored content. When player persistence moves to a database, hydro history
should have explicit tables or collections for:

- current facility state;
- operator input state;
- event log;
- telemetry checkpoints;
- recent samples;
- rollups;
- scenario outcome summaries.

Conceptual schema:

```txt
hydro_facility_state(save_id, plant_id, elapsed_minutes, state_json)
hydro_operator_state(save_id, plant_id, elapsed_minutes, inputs_json)
hydro_event(save_id, plant_id, event_id, elapsed_minutes, type, payload_json)
hydro_checkpoint(save_id, plant_id, elapsed_minutes, state_json, telemetry_json)
hydro_sample(save_id, plant_id, elapsed_minutes, telemetry_json)
hydro_rollup(save_id, plant_id, bucket, from_elapsed_minutes, to_elapsed_minutes, summary_json)
hydro_outcome(save_id, plant_id, outcome_id, elapsed_minutes, payload_json)
```

Indexes should support "give me samples/events for plant X between time A and
time B" without scanning a whole save. The database should not store large
opaque graph images or every animation-frame point.

## Physical Model

The first implementation should be a simplified steady-state model per
sub-interval. It assumes the stream is full enough for easy mode, pipe flow is
laminar for teaching purposes, and losses can be represented with simple
coefficients.

### Minimum Equation Inputs

At its core, the simulator needs only the current values for the power
equation:

```js
{
  flowM3s: 1.8,
  netHeadM: 22.86,
  turbineEfficiency: 0.87,
  generatorEfficiency: 0.96,
  intervalHours: 1
}
```

With those values:

```txt
hydraulic_power_w = rho * g * flowM3s * netHeadM
electric_power_w = turbineEfficiency * generatorEfficiency * hydraulic_power_w
energy_kwh = electric_power_w * intervalHours / 1000
```

Everything else in this contract either derives those inputs or explains why
they changed. Stream flow, intake cover, debris, valves, leakage, friction,
turbine choice, and upgrades all collapse into effective `flowM3s`,
`netHeadM`, and efficiency for the current interval.

This means the first implementation can start with direct equation inputs. The
component model can grow around it without changing the contract's output
semantics.

### Core Calculations

Use the shared hydro helpers for static calculations:

```txt
intake_gate = intakeGatePercent / 100
penstock_valve = penstockValvePercent / 100
bypass_valve = bypassValvePercent / 100
entry_valve = entryValvePercent / 100

open_intake_fraction = intake_gate * (1 - intakeCoverFraction) * (1 - intakeDebrisFraction)
captured_flow = min(streamFlowAvailableM3s, intake.maxCaptureFlowM3s) * open_intake_fraction
penstock_flow = captured_flow * penstock_valve * (1 - leakageFraction)
turbine_flow = min(penstock_flow, turbine.maxSafeFlowM3s) * entry_valve * (1 - bypass_valve)
head_loss = friction_loss + minor_loss + intake_loss + integrity_loss + leakage_loss
net_head = max(0, grossHeadM - head_loss)
hydraulic_power_w = rho * g * turbine_flow * net_head
electric_power_w = turbine_efficiency * generator_efficiency * hydraulic_power_w
energy_kwh = electric_power_w * interval_hours / 1000
```

Implementation notes:

- Percent controls are authored and displayed as `0-100`, then normalized to
  `0-1` inside the evaluator.
- Water density defaults to `1000 kg/m^3`.
- Gravity defaults to `9.80665 m/s2`.
- Net head must never go below zero.
- Electrical output is zero until the alpha generator switch is closed and the
  generator module is available.
- Turbine and generator efficiency may start as fixed base values, then become
  operating curves as the game needs more nuance.
- `turbine_flow` is capped by plant configuration. Flow above the safe cap may
  produce warnings or trips, but it does not create unbounded power.

### Losses

Losses should be realistic enough to teach that pipes, screens, bends, and
leaks matter, without requiring the player to solve fluid mechanics.

For the first pass:

```txt
friction_loss_m = penstock.frictionLossCoefficient * length_factor * flow_factor
minor_loss_m = penstock.minorLossCoefficient * flow_factor
intake_loss_m = intake.trashRackLossCoefficient * debris_factor * flow_factor
integrity_loss_m = grossHeadM * (1 - penstockIntegrity) * integrityHeadPenalty
leakage_loss_m = grossHeadM * leakageFraction * leakageHeadPenalty
```

Where:

- `length_factor` is derived from penstock length and diameter, then tuned for
  the authored plant;
- `flow_factor` rises with flow, but may be linear in easy mode;
- `debris_factor` is `intakeCoverFraction + intakeDebrisFraction` clamped to
  `0-1`;
- `integrityHeadPenalty` is an authored tuning value for rough pipe condition,
  bends, partial collapse, or other non-leak penstock degradation;
- `leakageHeadPenalty` is an authored tuning value.

The contract intentionally does not require Darcy-Weisbach, Reynolds number, or
turbulent-flow modeling for Part I. Those can be added later as optional lesson
or advanced-mode detail.

### Easy Mode

Easy mode is the baseline scenario where everything works:

```js
{
  streamFlowAvailableM3s: plant.stream.easyModeFlowM3s,
  intakeCoverFraction: 0,
  intakeDebrisFraction: 0,
  leakageFraction: 0,
  penstockIntegrity: 1,
  intakeGatePercent: 100,
  penstockValvePercent: 100,
  bypassValvePercent: 0,
  entryValvePercent: 100,
  exciterEnabled: true,
  generatorSwitchClosed: true,
  generatorAvailable: true
}
```

The expected result is steady, efficient output near the plant's rated
operating point. Easy mode should be used for:

- first implementation tests;
- the first successful startup moment after Zanzibar performs the required
  story actions;
- a known-good reference line in the control panel;
- author calibration of the station power threshold.

Easy mode is not a separate physics model. It is a clean set of inputs passed
through the same interval evaluator used by later challenges.

### Challenge Layers

Challenge scenarios should mostly degrade one or two inputs at a time so the
player can reason from telemetry to cause.

| Challenge | Changed inputs | Expected player response |
| --- | --- | --- |
| Intake partly covered | `intakeCoverFraction` rises | Inspect/clear the cover or open alternate intake path |
| Debris blocking intake | `intakeDebrisFraction` rises over elapsed time | Clear screen, then collect a new interval |
| Valve left partly closed | `penstockValvePercent` or `entryValvePercent` below 100 | Find and open the correct valve |
| Bypass left open | `bypassValvePercent` above 0 | Close bypass to send flow through turbine |
| Penstock leak | `leakageFraction` rises | Locate repair point or reduce flow until repaired |
| Reduced stream flow | `streamFlowAvailableM3s` drops | Shed load or wait for better conditions |
| Generator unavailable | `generatorAvailable === false` | Complete repair or switch prerequisite |

The first few challenges should be forgiving: production falls below optimal,
but the plant remains safe and recoverable. Later challenges can introduce trips
or brownouts once the player understands the controls.

### Derived Snapshot Values

For each sub-interval, the simulator derives snapshot values suitable for the
control panel and scenario validation:

| State | Behavior |
| --- | --- |
| `penstockPressureKpa` | Derived from net head at the powerhouse gauge; lower with leaks, open bypass, or empty line |
| `turbineSpeedRpm` | Derived from flow/head and generator state; may be simplified to rated speed when online |
| `generatorOutputKw` | Usable electrical output, limited by rated output and simplified station demand |
| `stationPowerPercent` | Near 100 when generation can meet the simplified building-power threshold |
| `frequencyHz` | Deferred advanced readout; automatic controls hide this during alpha |

For the first pass, these are steady-state values for the sub-interval. A
future panel animation may interpolate between snapshots for visual smoothness,
but model logic should be deterministic and testable without Vue.

## Telemetry Snapshot

The simulator publishes a current snapshot for panels, tests, story conditions,
interval summaries, and outcome validation:

```js
{
  elapsedMinutes: 1200,
  mode: "startup",
  status: "starting",
  streamFlowAvailableM3s: 1.8,
  flowM3s: 1.12,
  grossHeadM: 42,
  headLossM: 3.8,
  netHeadM: 38.2,
  penstockPressureKpa: 374,
  turbineSpeedRpm: 884,
  frequencyHz: 58.9,
  efficiency: 0.86,
  hydraulicPowerKw: 419,
  generatorOutputKw: 361,
  intervalEnergyKwh: 331,
  buildingPowerRequiredKw: 260,
  stationPowerSuppliedKw: 260,
  stationPowerPercent: 100,
  warnings: ["pressure-ready"],
  faults: [],
  events: [
    {
      eventId: "hydro.startup.pressure-ready",
      elapsedMinutes: 1148,
      type: "threshold-crossed"
    }
  ]
}
```

All telemetry fields use stable machine names and units. UI labels can be more
expressive, but graph series, tests, and panel configuration should use the
stable names.

## Startup Sequence

Startup is a guided scenario with ordered checks. The simulator may accept all
operator inputs, but success requires the plant to reach stable generation
without faulting.

| Step | Required State | Outcome |
| --- | --- | --- |
| Clear/open intake | `screenCleared === true`, debris below threshold, intake open | Flow path available |
| Turn manual valve 1 | first authored penstock/diversion valve in correct position | Penstock can fill |
| Turn manual valve 2 | second authored penstock/diversion valve in correct position | Water can reach turbine |
| Confirm pressure | pressure gauge reaches authored threshold | Turbine is ready to spin |
| Flip generator/circuit switch | control-room switch closed | Station power comes online |

Startup should also be represented as a replayable event sequence. A first
successful run might include:

| Event ID pattern | Type | Meaning |
| --- | --- | --- |
| `hydro.startup.intake-opened` | `operator-input` | Intake gate opened; captured flow can begin |
| `hydro.startup.valve-1-set` | `facility-change` | First manual valve turned in the field |
| `hydro.startup.valve-2-set` | `facility-change` | Second manual valve turned in the field |
| `hydro.startup.pressure-ready` | `threshold-crossed` | Pressure gauge reached the authored startup threshold |
| `hydro.startup.turbine-spinning` | `threshold-crossed` | Turbine speed entered the useful operating band |
| `hydro.startup.switch-closed` | `operator-input` | Control-room generator/circuit switch closed |
| `hydro.startup.online` | `state-transition` | Plant reached stable online service |

These events should appear as markers in the control-panel graphs. Watching
live or replaying later should show the pressure graph rise after intake and
manual valve changes, the turbine-speed graph rise after water reaches the
turbine, and the generation graph rise after the switch is closed.

Startup success reports:

```js
{
  outcomeId: "hydro.startup.online",
  plantId: "upper-penstock",
  evaluatedMinutes: 10,
  outputKw: 420,
  energyGeneratedKwh: 70,
  stationPowerRequiredKw: 260
}
```

The host may map this outcome to story flags such as `hub.hydro_online` and
hydro progression effects.

For alpha, the startup outcome should also enable the existing building-wide
power state, such as `hub.hydro_online` and the current "power is on" flag used
by utility-station interactions. That flag gates electricity-dependent actions:
lights, holo-reader use, EV charging, stove use, powered doors or monitors, and
other station comforts. Detailed circuit allocation waits for the later
electrical-panel scope.

## Operations Loop

Operations mode represents recurring days and weeks after startup. It uses the
same model, but the player is balancing changing environment and load:

- review live telemetry;
- clear intake or schedule maintenance when debris rises;
- adjust flow for stream conditions;
- observe the simple building-wide power state;
- respond to weather, load additions, pressure anomalies, and trips;
- collect production data over authored intervals such as an hour, shift, day,
  or maintenance round;
- keep the simplified station power state online for a required duration.

Operations success should be scenario-based, not merely "maximum power":

```js
{
  outcomeId: "hydro.operations.round-passed",
  scenarioId: "day-3-rain-and-holo-readers",
  evaluatedMinutes: 180,
  energyGeneratedKwh: 982,
  stationPowerOnlineMinutes: 180,
  brownoutMinutes: 0,
  faults: []
}
```

Qualification for Part II should be granted by a host-validated aggregate of
operations outcomes, not by the simulator setting a broad story flag directly.

Alpha pacing:

- The first challenge is startup.
- Successful startup is a major milestone: the utility station becomes livable
  and rewarding.
- After the player has enjoyed that success, daily monitoring and maintenance
  begin.
- Early maintenance events should be concrete and legible: clogged intake,
  manual valve wrong, leak, or reduced flow.
- Synchronization, governors, load banks, and detailed electrical behavior are
  deferred. The plant can be described as engineered to handle those details
  automatically.

## Faults and Warnings

Faults should teach the relation between cause and plant behavior. They should
be recoverable unless a scenario explicitly ends.

| Condition | Type | Effect |
| --- | --- | --- |
| Intake clogged | warning / fault | Available flow drops; pressure and power fall |
| Low stream flow | warning | Generation may not meet the simplified station threshold |
| Excess flow | warning / trip | Turbine overspeed or cavitation risk |
| Pressure too low | warning | Startup cannot continue; output unstable |
| Pressure spike | warning / trip | Valve changes too abrupt for the current scenario |
| Sync out of band | deferred warning / later challenge | Automatic controls handle this during alpha |
| Station demand exceeds generation | warning / brownout | Alpha power flag may remain off or limited |
| Generator overload | later trip | Deferred until detailed electrical-panel scope |
| Emergency stop | command | Safe shutdown; no success outcome while stopped |

Warnings are part of telemetry and may appear in the panel. Faults are
structured events with IDs so tests, story outcomes, and UI copy do not depend
on parsing display text.

## Outcomes and Effects

The simulator may request outcomes; only the host commits durable effects.

Initial registered outcomes:

| Outcome ID | Meaning |
| --- | --- |
| `hydro.startup.online` | First successful startup; building-wide power becomes available |
| `hydro.startup.failed` | Startup scenario ended before stable service |
| `hydro.operations.round-passed` | Scenario requirements met |
| `hydro.operations.round-failed` | Brownout, trip, or missed objective exceeded scenario limit |
| `hydro.fault.triggered` | Structured fault emitted for story/tutorial response |
| `hydro.shutdown.safe` | Plant was safely shut down |

Outcome payloads should include enough summary data for validation and story
copy, such as output, station power threshold, fault IDs, brownout duration,
and scenario ID. They should not include full graph history unless a later
feature needs an operator report artifact.

## Persistence

Persisted facility state may include:

- hydro online/offline;
- last stable operator inputs;
- last collected production timestamp;
- last collected telemetry summary;
- cumulative generated energy for the current scenario, if authored;
- intake debris fraction;
- intake cover fraction;
- leakage fraction;
- penstock integrity;
- generator availability;
- completed startup and operations outcomes;
- enabled campus circuits later, if the broader electrical-panel system owns
  them.

Do not persist ordinary panel view state:

- graph sample arrays;
- hover/selection state;
- animation positions;
- temporary tutorial highlight;
- unsaved sandbox settings.

If the player saves mid-scenario, persist the scenario ID, last collection
timestamp, facility state, and operator inputs only when resuming that scenario
is a deliberate feature. Otherwise, closing or reloading returns to the last
committed facility state and the next data collection evaluates from that
committed timestamp.

For alpha, the required persistence is smaller:

- active hydro configuration ID;
- hydro online/offline;
- building-wide power-on flag or equivalent;
- last hydro checkpoint time;
- startup and maintenance event log;
- current simple facility state: intake clear/open, two manual valves, switch
  state, debris fraction, leak fraction.

The hidden battery buffer does not need a detailed state of charge until the
later electrical-panel scope.

## Implementation Notes

- Put reusable calculations in testable modules under `game/src/lib/learning/`
  or a future `game/src/lib/simulations/` namespace; do not bury formulas inside
  Vue components.
- The existing `game/src/lib/learning/hydroPower.js` helpers are the seed for
  net head and power calculations.
- Port ideas from `../welcome/app/components/simulators/HydroPowerSimulator.vue`
  as local code; do not import sibling project files at runtime.
- Keep simulator internals separate from story flags, character effects, and
  save writes. Use registered outcomes at the host boundary.
- Use deterministic interval tests for easy mode, startup, low-flow, partially
  closed valves, intake debris, leakage, overload, and fault scenarios.

## Reference Notes

- DOE Energy Saver's microhydropower guidance treats head and flow as the key
  site variables, gives a simple preliminary watts estimate, and suggests
  preliminary pipe losses around 5-10 percent for early calculations:
  <https://www.energy.gov/energysaver/planning-microhydropower-system>
- DOE's system overview lists the same basic components this contract uses:
  water conveyance/penstock, turbine or waterwheel, generator/alternator,
  regulator, wiring, and optional inverter/battery equipment:
  <https://www.energy.gov/energysaver/microhydropower-systems>
- The alpha design intentionally simplifies these details. The contract uses
  real terms so later holo-lessons and equipment flavor can deepen the model
  without changing the first playable loop.

## Open Questions

- Which calibration profile feels best in play: 50 ft head, 75 ft head, or a
  lower-head small-river profile?
- What exact two manual valve locations are canonical in the Utility Station
  map?
- What output target makes the station feel satisfying without making later PV
  and storage systems irrelevant: 500 W, 1 kW, or 2 kW?
- Which daily maintenance event comes first after the initial power-on reward:
  clogged intake or pipe leak?
- Which electricity-dependent actions should be enabled immediately by the
  first power-on milestone?
