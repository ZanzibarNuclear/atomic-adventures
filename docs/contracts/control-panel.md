# Control Panel

**Status:** Part I **Operational console** layout locked (2026-08-07) — multi-screen
shell (Hydro power generator + Station grid); physics from energy-sims WASM  
**Scope:** `game/` player-facing consoles and control panels, telemetry
visualization, operator controls, facility connectivity, and simulator hosting

---

## Purpose

A control panel is a focused console surface that lets the player observe and,
where the current panel is physically wired for it, operate connected systems.

In Part I the control-room stage is the **Operational console** (eyebrow
**Control Room**). It is a **multi-screen** CRT-style terminal: the player flips
between screens (side arrows or keyboard ←/→) for:

1. **Hydro power generator** — Clearwater Diversion plant path, live graphs, status  
2. **Clearwater Station grid** — station bus status, loads, utilization  

Physics comes from the Clearwater Station energy-sims session
([hydro-simulator.md](hydro-simulator.md)). Field work stays on ordinary map
actions. Later screens (storage, PV, nuclear) may join the same flipper without
renaming the shell.

This contract owns the visual and interaction shell. Individual simulators and
facility systems own physics, domain rules, telemetry fields, and validated
outcomes.

## Design Goals

- Make consoles feel like in-world equipment (tight, simple, useful).
- Prefer a small set of high-signal readouts over diagnostic walls of text.
- Keep panel view state separate from simulator state, facility state, player
  saves, story flags, and authoring forms.
- Visualize stable telemetry fields without reimplementing plant physics.
- Support live graphs while the player watches the console.
- Allow operator commands through registered control bindings when wired.
- Scale from the hydro + grid flipper to later multi-system control rooms.

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

Panel interactions may spend authored time according to [time.md](time.md).
**Current:** live chart sampling and engine ticks while the console is open do
**not** advance the shared game clock (the banner shows authored game time,
which remains frozen until the host time policy for “watch mode” lands).

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

For Part I, the Operational console is **code-built** (`HydroConsoleView` and
`game/src/components/game-views/hydro-console/`). It is not authored content and
does not require Story Builder or Content Builder support.

Stable implementation IDs remain kebab-case. Player-facing labels below are part
of the locked chrome unless product deliberately revises them.

```js
{
  id: "hydro-control-room-panel",
  label: "Operational console",
  locationId: "utility-station.control-room",
  screens: [
    { id: "hydro-plant", title: "Hydro power generator" },
    { id: "station-grid", title: "Clearwater Station grid" }
  ],
  telemetrySourceId: "hydro-clearwater-diversion" // Clearwater Station session
}
```

---

## Part I Operational Console (final design)

**Decision (2026-08-07):** The following chrome and layout are the product
baseline for beta. Do not reintroduce redundant stat cards, a diagnostics wall,
or dual-path plant physics in this shell.

### Chrome

| Element | Locked behavior |
| --- | --- |
| Page eyebrow | **Control Room** |
| Page title | **Operational console** (compact heading) |
| Screen flipper | Left/right arrows + dots; keyboard ←/→ |
| Screen titles | **Hydro power generator**; **Clearwater Station grid** |
| Screen counter | **None** (no “Screen 1 of 2”) |
| Screen subtitles | **None** |
| Exit | Return to map |

### Screen 1 — Hydro power generator

Vertical stack, top to bottom:

1. **Status banner**  
   - Left: high-level plant status only — no “Status” caption. Values today:
     **Online**, **Offline**, **Fault** (extensible later). Compact font.  
   - Right: authored **game clock** via `formatOperationalConsoleTime`
     (`HH:mm:ss Weekday, Month D, YYYY`). Small tabular font.  
   - Clock is display of host `gameState.clock`; watching the console does not
     yet advance that clock (see [time.md](time.md) / open follow-ups).
2. **Live monitor**  
   - Heading only (no clock here).  
   - **Three separate graphs** (not combined pressure+speed):  
     - Power output → `generatorOutputKw`  
     - Water pressure → `penstockPressureKpa`  
     - Turbine speed → `turbineSpeedRpm`  
   - Graph value labels show the current sample; series sample while open.  
   - **No** parallel JS plant model; telemetry from energy-sims only.
3. **Plant path schematic**  
   - Equipment boxes left → right with active flow pipes between them.  
   - Badges under each box (green when in the good operating state).  
   - Field state is shown only via equipment badges. **No** “Next action”
     guidance block and **no** Diagnostics list.

#### Plant path equipment and badges

| Box | Badges (good / not good) | Host / engine basis |
| --- | --- | --- |
| **Intake** | stacked: **Intake clear** / **Intake blocked**; **Intake open** / **Intake closed** | `facilities.hydro.intakeClear`, `intakeOpen` |
| **Bypass** | **Closed** (penstock fed) / **Open** (flow back to cascade) | Step 3 host flag `manualValves.upstreamOpen` → path ready means bypass **Closed** |
| **Turbine** | **Valve open** / **Valve closed** | `manualValves.powerhouseOpen` |
| **Generator** | **Engaged** / **Disengaged** | Engaged when host online **and** turbine rpm > 0 |
| **Grid** | **Connected** / **Disconnected** | Prefer engine `busEnergized`; else online + spinning |

Pipes light when the upstream path is ready for the next stage (clear/open
intake, bypass closed for penstock, turbine valve open, generator engaged).

**Not in the locked layout:**

- Instant-overview stat cards (redundant with graph value labels)
- Diagnostics / warning list section
- Configuration profile browser / what-if selector (future module)

### Screen 2 — Clearwater Station grid

Same vertical stack pattern as screen 1:

1. **Status banner** (same thin card styling as hydro Online/Offline)  
   - Left: station bus state only — **Energized** or **Offline** (no caption).  
   - Right: same authored game clock as screen 1.  
2. **Grid body** — available generation vs load, margin, utilization bar, and the
   Clearwater Station load table (lighting, holo-reader, EV charge, kitchen).

Load **Drawing** is host-derived circuit watts (sum of device draws); **Rating**
is circuit capacity. See [station-electrical-grid.md](station-electrical-grid.md)
for circuits vs devices, World Builder authoring, and engine binding. Until that
model ships, the table may still reflect the coarse boolean load registry.

### Power gating the console (now vs later)

Today the player typically reaches the console after hydro is online (sole
power source for the station). The shell must remain valid for **Offline**
hydro: later batteries, solar, and multi-source buses will power the control
room while Clearwater Diversion is idle. Do not hard-code “console implies
Online” into presentation logic.

### Required hydro sensors (live graphs)

| Graph | Field | Purpose |
| --- | --- | --- |
| Power output | `generatorOutputKw` | Usable electrical output |
| Water pressure | `penstockPressureKpa` | Penstock fill, leaks, valve effects |
| Turbine speed | `turbineSpeedRpm` | Whether water is driving the turbine |

Secondary fields (`flowM3s`, `netHeadM`, warnings) may appear later without
displacing these three graphs.

### Field work (startup)

Field work is **not** done on the console and is **not** prompted there.
Startup remains easy on the map / room actions:

1. Clear debris and open the intake.  
2. Set bypass for penstock service (host step: upstream / align-pipeflow).  
3. Open the turbine (powerhouse) valve.  
4. Connect station power from the control room (host connect / online).

The console only reflects resulting equipment badges and telemetry.

### Future modules (not Part I chrome)

These remain valid long-term extensions; they must not regress the locked layout:

| Module | Notes |
| --- | --- |
| Remote controls | Exciter, sync breaker, emergency stop when physically wired |
| What-if configuration | Non-durable profile compare; durable upgrades via validated host actions |
| Clickable schematic regions | Optional deeper component close-ups |
| Console watch → game clock | 1 game second per real second while open; chunky time when closed |
| Extra screens | Storage, PV, nuclear on the same flipper |

### Later electrical / multi-source

Station grid is already screen 2. Deeper campus breakers, multi-building
demand, and battery banks extend that screen or add flipper screens; they do
not replace the Hydro power generator schematic.

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

## Hydro Live Graphs (locked)

Screen 1 **Live monitor** uses **three separate graphs** (not combined series):

| Graph | Series | Purpose |
| --- | --- | --- |
| Power output | `generatorOutputKw` | Electrical output over the watch session |
| Water pressure | `penstockPressureKpa` | Penstock fill / valve / leak effects |
| Turbine speed | `turbineSpeedRpm` | Mechanical drive / engage readiness |

Optional later overlays (campus load, sync band, flow/net head) must not
collapse pressure and speed back into a single dual-series chart without a
product decision.

Event markers on graphs remain optional; host field events may feed them when
a shared time axis exists.

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

## Document History

- **2026-08-07** — Locked Part I Operational console: chrome labels, status
  banner + game clock, three live graphs, intake/bypass/turbine/generator/grid
  schematic badges, no diagnostics wall / no stat cards. Energy-sims sole
  physics path. Station screen titled **Clearwater Station grid** with bus
  banner (**Energized** / **Offline**) matching hydro status card styling.
- **Earlier** — Multi-screen shell and station grid screen introduced for beta.

## Open Questions

- When should watching the console advance authored game time (1:1 real second
  while open)?
- Does connect-power remain control-room-only, or is there also a physical
  switch object in a room close-up?
- Which battery and multi-source signals enter the station-grid screen first
  after hydro is no longer the sole power source?
