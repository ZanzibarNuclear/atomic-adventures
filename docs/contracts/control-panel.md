# Control Panel

**Status:** Hydro console multi-screen shell in place (plant + station grid);
reusable panel registry still shaping  
**Scope:** `game/` player-facing consoles and control panels, telemetry
visualization, operator controls, facility connectivity, and simulator hosting

---

## Purpose

A control panel is a focused console surface that lets the player observe and,
where the current panel is physically wired for it, operate connected systems.
In Part I, the hydro control-room console is a **multi-screen** terminal: the
player flips between screens (side arrows or keyboard ←/→) for **hydro plant**
sensors and the **station grid** (bus, loads, utilization). Physics comes from
Clearwater Station via energy-sims. Field work stays on ordinary map actions.
Over time, more screens (storage, PV, nuclear bootstrap) can join the same
flipper without changing the shell.

This contract owns the visual and interaction shell: tabs, gauges, real-time
graphs, control widgets, system connectivity, status summaries, and event
messages. Individual simulators and facility systems own their own physics,
domain rules, telemetry fields, and validated outcomes. The hydro model is
defined in [hydro-simulator.md](hydro-simulator.md).

## Design Goals

- Make consoles feel like in-world equipment.
- Provide a reusable way to connect panel modules to simulators, building
  systems, outdoor equipment, and campus loads.
- Keep panel view state separate from simulator state, facility state, player
  saves, story flags, and authoring forms.
- Let panels visualize stable telemetry fields without knowing each simulator's
  internal calculations.
- Support real-time graphs, gauges, alarms, and event markers from declared
  telemetry streams.
- Allow operator commands through registered control bindings.
- Scale from one hydro panel to later multi-system control rooms.

## Relationship to Existing Contracts

Control panels use the `console` stage view kind from
[stage-views.md](stage-views.md) when the player is operating a console as an
in-world object. A panel may embed a `simulation` module or open a dedicated
simulation view when the interaction is primarily a model-driven challenge.

Simulator outcomes and character/story effects still follow the host-owned
effect boundary described in [character-inventory.md](character-inventory.md).
The panel can request commands and display outcome results, but it does not
commit durable effects directly.

Station load totals, margin, and brownout warnings (when implemented) follow
[station-electrical-grid.md](station-electrical-grid.md); the panel presents
those readouts and does not invent a separate power truth.

Panel interactions may spend authored time according to [time.md](time.md),
but real-time chart motion does not secretly advance the shared clock.

## Runtime Surface

A story choice, room interaction, exterior hotspot, or object action opens a
panel through a stage view payload:

```js
{
  kind: "console",
  payload: {
    panelId: "hydro-control-room-panel",
    focus: "generation",
    mode: "operations"
  }
}
```

The panel registry resolves `panelId` to configured modules, telemetry sources,
control bindings, and visual layout. Unknown panel IDs fail validation and
should produce an authoring/runtime error, not a blank console.

## Panel Responsibilities

A control panel owns:

- layout, tabs, panes, focus state, and selected module;
- gauges, graphs, meters, status strips, warning lists, and event timelines;
- local graph sample history and chart interaction state;
- command widgets such as switches, sliders, buttons, steppers, toggles, and
  circuit selectors;
- connectivity views that show which systems, sensors, circuits, or outside
  nodes are linked;
- accessible summaries of current telemetry and alarms;
- presentation of simulator or facility outcomes after the host validates them.

A control panel does not own:

- hydro, PV, nuclear, or other simulator physics;
- durable weather, debris, damage, load, or facility facts;
- story beat selection;
- character progression and rewards;
- save persistence beyond declared panel state, if any;
- arbitrary script execution from content.

## Panel Implementation

For Part I, the hydro control panel is code-built to match the controls
and monitoring visuals needed by the hydro power generator. It is not authored
content and should not require Story Builder or Content Builder support.

Later control panels may introduce reusable layout registration or authored
configuration if a second or third system proves the pattern, but the first
scope should stay concrete.

Example:

```js
{
  id: "hydro-control-room-panel",
  label: "Hydro Control Room",
  locationId: "utility-station.control-room",
  modules: [
    {
      id: "configuration",
      label: "Configuration",
      sourceId: "hydro-clearwater-diversion",
      sourceType: "simulation",
      readouts: ["active-config", "net-head", "design-flow", "efficiency"],
      controls: ["select-what-if-config"]
    },
    {
      id: "generation",
      label: "Generation",
      sourceId: "hydro-clearwater-diversion",
      sourceType: "simulation",
      readouts: ["pressure-gauge", "turbine-speed", "power-output"],
      graphs: ["power-output", "pressure-speed", "flow-head"],
      controls: ["exciter", "sync-breaker"]
    },
    {
      id: "field-systems",
      label: "Field Systems",
      sourceId: "hydro-clearwater-diversion",
      sourceType: "simulation",
      readouts: ["intake-status", "valve-status", "leak-status"],
      actions: ["go-to-intake", "go-to-penstock-valve", "go-to-leak-site"]
    }
  ]
}
```

Stable implementation IDs should be kebab-case. Labels are player-facing and
may change without breaking saves.

## Hydro First Scope

The first concrete control-panel target is the hydro control-room interface for
the Clearwater Diversion plant. It should let the player:

- see the active hydro configuration profile and key equation parameters;
- compare what-if profiles when the mode allows it;
- monitor live and historical sensor data;
- issue only the commands that the current panel is physically wired to issue;
- identify field work that cannot be completed from the control room;
- guide the player toward the relevant world action when a route, map focus, or
  story choice exists.

The panel should not make every simulator input editable. Some changes are
remote controls. Some require Zanzibar to walk to the intake, penstock, valve,
powerhouse, or leak site and interact there.

### Layout Sections

The Part I hydro panel should start with three sections.

| Section | Purpose |
| --- | --- |
| Schematic | Clickable replica of the local hydro system, echoing the map layout |
| Instant Overview | Current values: flow, pressure, turbine speed, power output, warnings |
| Graphs | Live and historical plots with event markers |

The schematic should be useful, not decorative. Clicking a region opens the
focused status for that component:

| Schematic region | Detail shown |
| --- | --- |
| Intake | Cover on/off, debris blockage percent, captured water flow |
| Penstock / pipe | leakage status, integrity, current flow, pressure trend |
| Manual valve / diversion valve | current position, whether it is remotely controllable |
| Turbine | spin rate, operating band, sync readiness |
| Generator / switch | breaker state, power output, online/offline state |

The instantaneous overview is the first operator dashboard. It should show all
important current values at once without requiring graph reading.

The graph section supports live watching, historical review, and replay of
startup/fault events.

### Configuration Readout

The hydro panel should display the selected configuration profile and the
minimal equation inputs that matter for power:

| Readout | Source field | Notes |
| --- | --- | --- |
| Active profile | `configId`, `label`, `profileKind` | Baseline, what-if, simplified, upgrade, or tradeoff |
| Net head | `equationInputs.netHeadM` or telemetry `netHeadM` | Display in meters with optional feet conversion |
| Flow | `flowM3s`, `designFlowM3s` | Current and design values should be distinguishable |
| Efficiency | `efficiency` or turbine/generator components | Show combined efficiency first |
| Rated output | `ratedPowerKw` | Reference, not a guarantee |

The configuration tab may offer what-if selection when the mode permits it.
What-if changes dispatch a `configuration-selected` command/event with
`durable: false`. Story upgrades use a separate validated action with
`durable: true` only after requirements pass.

### Required Hydro Sensors

The first sensor set is intentionally small:

| Sensor / readout | Field | Purpose |
| --- | --- | --- |
| Pressure gauge | `penstockPressureKpa` | Shows penstock fill, leaks, bypass/valve effects |
| Turbine speed | `turbineSpeedRpm` | Shows whether water is driving the turbine and whether sync is plausible |
| Power output | `generatorOutputKw` | Shows usable electrical output |

Useful secondary readouts:

| Sensor / readout | Field | Purpose |
| --- | --- | --- |
| Flow | `flowM3s` | Connects intake/valve/debris state to output |
| Net head | `netHeadM` | Connects pressure/losses to output |
| Warnings/faults | `warnings`, `faults` | Gives structured diagnosis without hiding the graph evidence |

### Remote Controls

Remote controls are controls physically wired to the control room or made
available by story progression. Initial remote controls may include:

| Control | Command | Notes |
| --- | --- | --- |
| Exciter | `hydro.set-exciter` | Enables generator field/voltage buildup |
| Sync breaker | `hydro.set-sync-breaker` | Connects generator only when sync criteria pass |
| What-if config selector | `hydro.select-configuration` | Non-durable comparison unless validated as upgrade |

Optional later remote controls:

| Control | Command | Constraint |
| --- | --- | --- |
| Servo intake gate | `hydro.set-intake-gate` | Only if the intake has a powered actuator online |
| Servo penstock/diversion valve | `hydro.set-penstock-valve` or `hydro.set-bypass-valve` | Only if that valve is authored as remotely actuated |
| Emergency stop | `hydro.emergency-stop` | Safe shutdown command, not a repair |

The panel must disable or mark unavailable controls when the required actuator,
power, permissions, or story prerequisite is missing.

### Guided World Actions

Some changes require moving through the world and interacting with equipment.
The panel may diagnose and route to them, but it must not apply the change
directly.

The initial hydro startup should be deliberately easy. To turn on the hydro
generator, the player needs to complete only a small sequence:

1. Clear debris and open the intake.
2. Turn two manual valves.
3. Flip the generator/circuit switch from the control room.

Everything else can work reliably for the first startup unless a later challenge has
explicitly introduced it.

| Problem / task | Panel guidance | Required world action |
| --- | --- | --- |
| Intake debris | Show debris/flow warning and route to intake | Travel to intake and clear screen |
| Intake cover blocked | Show intake-status warning and route to intake | Inspect/open cover or remove obstruction |
| Manual penstock/diversion valve | Show valve state and route to valve location | Travel to valve and turn it |
| Pipe leak | Show pressure/power drop and route to suspected segment | Travel to leak site and patch/repair |
| Broken sensor | Show stale/missing telemetry | Inspect/repair sensor in world |
| Generator/mechanical fault | Show fault and route to powerhouse | Inspect/repair component |

Routing is a request to the host, not a panel-side teleport. The host may expose
a story choice, map focus, objective marker, or close-up action depending on
the current location and authored content.

Example guided world action:

```js
{
  actionId: "go-to-penstock-valve",
  label: "Inspect penstock valve",
  target: {
    kind: "world-location",
    mapId: "utility-station",
    nodeId: "midstream-penstock-valve"
  },
  reason: {
    field: "penstockValvePercent",
    observedValue: 0,
    expectedValue: 100
  }
}
```

Selecting this action should close or background the panel according to the
stage-view rules, then let normal movement, requirements, time costs, and
world interactions handle the repair or adjustment.

### Later Electrical Panel

Campus circuits are important but out of first implementation scope. Later, the
control room should include an electrical panel with circuit breakers, campus
power usage views, and battery storage readouts.

Planned later signals include:

- enabled campus circuits;
- electrical demand by building or system;
- battery storage levels for the EV and future battery banks;
- charging/discharging state;
- brownout or overload warnings.

These should use the same panel pattern, but they can wait until the hydro
startup and basic generation monitor are playable.

## Telemetry Sources

A telemetry source publishes snapshots with stable machine field names and
units. Sources may be simulators, facility systems, environmental sensors, or
connection adapters.

Minimum source shape:

```js
{
  sourceId: "hydro-clearwater-diversion",
  sourceType: "simulation",
  elapsedMinutes: 1200,
  status: "syncing",
  fields: {
    generatorOutputKw: 361,
    campusLoadDemandKw: 260,
    flowM3s: 1.12,
    netHeadM: 38.2,
    turbineSpeedRpm: 884,
    frequencyHz: 58.9
  },
  warnings: ["sync-nearly-ready"],
  faults: []
}
```

Sources remain responsible for the meaning and validity of their fields. The
panel can display, graph, and route them, but it should not duplicate domain
logic such as hydro sync criteria or PV inverter limits.

## Operator Commands

Controls dispatch registered commands to a target source:

```js
{
  commandId: "hydro.set-entry-valve",
  targetId: "hydro-clearwater-diversion",
  payload: {
    entryValvePercent: 35
  }
}
```

Command handling rules:

- Commands are validated by the target source or host.
- Rejected commands return a structured reason the panel can display.
- Momentary controls such as emergency stop are commands, not persistent panel
  state.
- Sliders and switches should show the last accepted value, not only the last
  dragged value.
- Panel code must not write story flags, character progress, or facility state
  directly.
- Commands represent remote control. Field-required work is represented by
  guided world actions that ask the host to guide or move the player toward the
  relevant world interaction.

## Guided World Actions

A panel may recommend an action outside the control room when telemetry points
to a physical issue. These are diagnostic navigation aids, not remote repairs.

Guided world action rules:

- Each action targets a known world location, object, exterior node, room,
  stand, or story event.
- Selecting an action does not mutate simulator or facility state.
- The host decides whether to focus a map location, open a story choice, start
  movement, or show an objective.
- Ordinary movement, time, inventory, skill, and story requirements still
  apply.
- The eventual world interaction emits a `facility-change` or other simulator
  event if it succeeds.

## Connectivity

The panel may show connected systems as a topology or list. This is a
visualization of declared connectivity, not a replacement for world geometry.

Initial connection types:

| Type              | Meaning                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `sensor`          | Read-only telemetry endpoint                                                              |
| `actuator`        | Command target such as valve, breaker, gate, or switch                                    |
| `circuit`         | Future electrical load or supply connection                                                |
| `simulator`       | Model-driven source such as hydro or PV                                                   |
| `building-system` | Doors, lights, monitors, elevators, HVAC, or local equipment                              |
| `outside-system`  | Intake, penstock, PV field, weather station, vehicle charger, or other exterior equipment |

Connectivity examples for the hydro panel:

- Clearwater Run intake sensor;
- penstock pressure sensor;
- entry valve actuator;
- turbine/generator simulator;
- outside weather or stream-flow station.

The panel should make loss of connectivity visible. If a source is offline, the
panel shows stale/missing telemetry and disables commands that require that
source.

## Real-Time Graphs

Panels provide graph containers; sources provide fields. Graph definitions map
source fields to series, units, colors, reference bands, and event markers.

Graph definition example:

```js
{
  id: "power-output",
  label: "Power Output",
  sourceId: "hydro-clearwater-diversion",
  windowSeconds: 90,
  series: [
    { field: "generatorOutputKw", label: "Generation", unit: "kW" }
  ]
}
```

Graph behavior:

- Default history window: 60-120 seconds of simulated time.
- Sampling cadence: 2-5 samples per second is enough for readable trends.
- Graphs pause or annotate when story or modal UI pauses the source.
- Graphs may run in live mode while the player watches a source, or historical
  review mode when the player asks what happened while away.
- Historical review should request samples, rollups, and event markers for a
  time range instead of assuming all graph points are already in memory.
- Use unit labels on axes and accessible table summaries for key current
  values.
- Event markers should reference fault/warning IDs, not freeform text.
- Graph history should clear when starting a new scenario unless the player is
  reviewing a saved report.

## Graph Data Requests

Panels should request graph data by source, field list, time range, and desired
resolution. The source decides whether to return live samples, recent samples,
rollups, regenerated backfill, or a mix.

Example:

```js
{
  sourceId: "hydro-clearwater-diversion",
  fromElapsedMinutes: 1140,
  toElapsedMinutes: 1200,
  fields: ["generatorOutputKw", "penstockPressureKpa", "turbineSpeedRpm"],
  preferredSampleMinutes: 2,
  includeEvents: true
}
```

Response shape:

```js
{
  sourceId: "hydro-clearwater-diversion",
  resolution: "sample",
  samples: [
    {
      elapsedMinutes: 1140,
      fields: {
        generatorOutputKw: 361,
        penstockPressureKpa: 374,
        turbineSpeedRpm: 900
      }
    }
  ],
  events: [
    {
      eventId: "hydro-event-1170-leak",
      elapsedMinutes: 1170,
      type: "facility-change",
      label: "Penstock leak"
    }
  ],
  rollups: []
}
```

The panel draws what it receives. It must not assume a graph range always has
uniform samples. Mixed-resolution data is expected for old history, and exact
event markers should remain visible even when surrounding samples have been
compressed into hourly or daily rollups.

## Hydro Panel Starting Graphs

The first hydro control panel should include two or three live graphs.

### Required Graph 1: Power Output

Series:

- `generatorOutputKw`
- optional `campusLoadDemandKw`

Purpose: show useful electrical output over time. Load can be overlaid when
campus circuits are part of the scenario.

### Required Graph 2: Pressure and Turbine Speed

Series:

- `penstockPressureKpa`
- `turbineSpeedRpm`
- optional sync band reference lines

Purpose: make startup and field problems visible. Pressure should rise as the
penstock fills; turbine speed should rise after flow reaches the turbine.

### Candidate Graph 3: Flow and Net Head

Series:

- `flowM3s`
- `netHeadM`
- optional `headLossM`

Purpose: connect configuration and physical losses to the power equation.

Event markers should appear on all hydro graphs when relevant: intake opened,
diversion valve closed, pressure threshold reached, turbine admitted, sync
ready, breaker closed, leak detected, valve changed, repair completed, and
configuration selected.

## Persistence

Panel view state is usually transient:

- selected tab or focused module;
- graph sample arrays;
- hovered graph point;
- expanded alert details;
- temporary tutorial highlight;
- unsaved sandbox settings.

Persist panel state only when the user experience deliberately resumes a
console scenario after save/load. Durable facts such as valve positions,
enabled circuits, online/offline state, and completed outcomes belong to the
target simulator or facility system, not to the panel shell.

## Open Questions

- What exact schematic art/layout should mirror the Utility Station map closely
  enough that players recognize intake, pipe, valves, turbine, and generator?
- Which two manual valve locations are canonical for the initial startup path?
- Does the generator/circuit switch live only in the control panel, or is there
  also a physical switch object in the room close-up?
- Which battery and circuit signals should enter the later electrical panel
  first: EV battery, building loads, or campus storage banks?
