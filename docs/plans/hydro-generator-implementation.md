# Hydro Generator Implementation Plan

**Status:** Implemented - Waves 1-6 complete  
**Last updated:** 2026-07-01  
**Primary contracts:** [Hydro Simulator](../contracts/hydro-simulator.md), [Control Panel](../contracts/control-panel.md), [Stage Views](../contracts/stage-views.md), [Game Time](../contracts/time.md)  
**Quality checklist:** [Character, Inventory, and Game-View Regression Checklist](../quality/character-inventory-regression-checklist.md)

## Goal

Implement the first playable hydro generator build-out in the `game/` app. The
first build should lay the runtime foundation, connect the hydro plant to
facility state, and let the player bring the hydro generator online through the
existing gameplay steps, then monitor what is happening from the control-room
console with simulated real-time telemetry.

The player-facing alpha loop is:

1. Clear debris and open the intake.
2. Turn two manual valves.
3. Complete the existing generator startup action or switch interaction in the
   world.
4. Bring station power online so existing hydro-powered station behavior works.
5. Open the hydro control-room console.
6. Watch pressure, turbine speed, flow, and output respond in simulated real
   time.
7. Use the console for monitoring and diagnosis.

The first implementation should be concrete and code-built. It should not add
builder support, authored panel configuration, a full campus electrical panel,
or complex generator synchronization until the core loop is playable.

## Decisions

- Implement the hydro simulator under `game/src/lib/simulations/hydro/`.
- Keep hydro formulas and interval logic in testable JavaScript modules, not in
  Vue components.
- Use a code-built `hydro-generator-baseline` configuration for the alpha.
- Define the first real `console` game view as part of this effort. The code
  recognizes `console` as a view kind, and the first hydro console shell now
  renders from `GameView.vue`.
- Treat the hydro console like the holo-reader: a focused view separate from
  the usual map/story play layout, with its own panel chrome, navigation, and
  return path.
- Keep simulator internals separate from story flags, character effects, save
  writes, and panel rendering.
- Route durable state changes through a host/facility adapter.
- Let the console diagnose field work, but do not let the console directly
  repair intake debris, manual valves, leaks, or other physical problems.
- Start with easy-mode hydro behavior: stable stream flow, no surprise faults,
  and a hidden battery/inverter buffer that avoids detailed electrical
  synchronization.
- We are aiming to generate up to `1 kW` of power in the beginning. We should
  adjust our configuration to reach this output at normal steady state. It
  will be less at times, especially as challenges arise.

## Wave 1 - Hydro Runtime Foundation

**Purpose:** Build the simulation core before any UI depends on it.

- [x] Add `game/src/lib/simulations/hydro/`.
- [x] Reuse or move hydro equation helpers from
      `game/src/lib/learning/hydroPower.js`.
- [x] Define a code-built `hydro-generator-baseline` plant configuration.
- [x] Define serializable alpha hydro state:
      active configuration ID, hydro online/offline, intake clear/open, two
      manual valve states, startup completion state, last checkpoint time,
      simple event log, debris fraction, and leakage fraction.
- [x] Implement telemetry snapshot generation for `flowM3s`, `netHeadM`,
      `penstockPressureKpa`, `turbineSpeedRpm`, `generatorOutputKw`,
      `warnings`, `faults`, and `status`.
- [x] Keep command handling minimal in the first build. The simulator may expose
      read-only graph-data and telemetry requests, but the console should not
      bypass the required startup steps or adjust field equipment.
- [x] Add deterministic tests for offline startup, valid startup, partially
      closed valves, intake debris, leakage, low flow, and event ordering.

**Exit criterion:** Pure JavaScript tests can transition the plant from offline
to online and produce stable telemetry without rendering a Vue component.

**Implemented:** `game/src/lib/simulations/hydro/` contains the baseline config,
serializable state helpers, event helpers, and telemetry generation. Runtime
tests cover the Wave 1 cases.

## Wave 2 - Save State and Facility Integration

**Purpose:** Make hydro state part of the playable runtime without coupling the
simulator to story flags or panel rendering.

- [x] Choose and add the durable hydro state shape to saved game state. Treat
      the hydro generator as utility-station facility state, not as inherently
      indoor-only state.
- [x] Update snapshot capture/apply in `game/src/composables/useGameState.js`.
- [x] Add a host adapter, such as `useHydroFacility(gameState, stationContext)`,
      that reads facility facts, sends commands to the simulator, records
      accepted events, and exposes current telemetry.
- [x] Bridge hydro online/offline into the existing powered-door checks without
      storing complex simulator state beside door state unless that proves to
      be the cleanest local design.
- [x] Ensure save/load preserves active config, online/offline state, startup
      completion state, field prerequisite state, last checkpoint time, and
      event log.
- [x] Keep story flags and character progression outside the simulator. If a
      story milestone such as `hub.hydro_online` is needed, commit it through a
      host-owned effect or story boundary.

**Exit criterion:** The hydro generator's online state survives save/load and
powers existing hydro-gated station behavior.

**Implemented:** saved state now includes `gameState.facilities.hydro`, with
snapshot migration from the prior `indoor.facility.hydroOnline` boolean. The
host adapter mirrors hydro online/offline into the existing indoor facility
bridge used by powered roll-up doors.

## Wave 3 - Focused Console View Shell

**Purpose:** Invent and render the first focused console view, using the hydro
control-room panel as the concrete vertical slice.

- [x] Add a console view component, such as `HydroConsoleView.vue`, that owns
      the first focused console experience.
- [x] Wire `activeView.kind === "console"` in `GameView.vue`; the view kind is
      allowed today, but it does not have a real renderer yet.
- [x] Present the console like the holo-reader: a separate focused view that is
      visually independent from the ordinary map/story combo.
- [x] Register or resolve `panelId: "hydro-control-room-panel"`.
- [x] Render the first concrete hydro panel with three sections:
      schematic/status, instant overview, and live graphs.
- [x] Support a payload like:

```js
{
  kind: "console",
  payload: {
    panelId: "hydro-control-room-panel",
    focus: "generation",
    mode: "startup"
  }
}
```

- [x] Add a shared Return to Map action consistent with inventory, character,
      and lesson views.
- [x] Show a validation error for unknown panel IDs rather than a blank panel.

**Exit criterion:** A story choice or temporary development action can open and
close the focused hydro console without moving the player, losing narrative
context, or relying on the ordinary map/story layout for the console UI.

**Implemented:** `HydroConsoleView.vue` renders the first focused console shell
with schematic/status, instant readouts, live graphs, diagnostics, recent
events, return to map, and unknown-panel validation. A temporary control-room
action opens the console.

## Wave 4 - Live Monitor and Diagnostics

**Purpose:** Let the player watch simulated real-time behavior and understand
the generator's condition from the control-room console.

- [x] Add a panel-side live sampler that requests telemetry from the hydro host
      adapter while the console is open.
- [x] Drive display updates from wall-clock ticks, but derive simulated samples
      from authored game time plus a local monitor offset.
- [x] Keep high-resolution graph samples transient in the panel.
- [x] Show instant readouts for pressure, turbine speed, power output, flow, net
      head, plant status, warnings, and faults.
- [x] Add required graphs:
      power output, and pressure plus turbine speed.
- [x] Add an optional first flow/net-head graph if it does not slow the wave.
- [x] Display structured diagnostic messages for missing intake preparation,
      closed valves, generator unavailable, insufficient pressure, insufficient
      turbine speed, or missing station power.
- [x] Show station power online when the host facility state says the existing
      startup path has brought the hydro generator online.

**Exit criterion:** After the existing startup path brings the hydro generator
online, the player can open the console, watch telemetry respond in simulated
real time, and understand the current generator state from the diagnostics.

**Implemented:** the hydro console now samples telemetry while mounted, keeps a
transient sample buffer, renders output, pressure/speed, and flow/head graphs,
and shows station-power and prerequisite diagnostics from the current facility
state.

## Wave 5 - World Actions for Startup Prerequisites

**Purpose:** Connect the console loop to actual field work in the playable
world.

- [x] Reuse the existing world/indoor actions for clearing and opening the
      intake.
- [x] Reuse the existing world/indoor actions for turning the two manual valves.
- [x] Reuse the existing world/indoor startup action or switch interaction that
      brings the hydro generator online.
- [x] Make successful field actions emit host-owned hydro facility changes.
- [x] Make the console diagnose missing prerequisites and offer guided actions
      without directly applying those changes.
- [x] Keep guided actions as host requests: return to map, focus a route, show
      an objective, or expose an ordinary story/world action.
- [x] Add tests for the full alpha startup path:
      field prerequisites, startup action, hydro online, console monitoring,
      save/load, and hydro-powered facility behavior.

**Exit criterion:** The alpha startup sequence works end to end through normal
gameplay actions and the hydro console.

**Implemented:** the existing authored actions `clear-intake-debris`,
`align-pipeflow`, `open-turbine-valve`, and `connect-power` now commit
host-owned hydro facility changes and event log entries. The console offers
return-to-map guidance for the next missing prerequisite but does not apply
field repairs itself. Integration coverage walks the full alpha startup path,
checks online telemetry, save/load, and the existing powered roll-up behavior.

## Wave 6 - Historical Review and Event Markers

**Purpose:** Make the console useful after the startup moment, without adding a
full operations game yet.

- [x] Store compact event log entries for intake changes, valve changes,
      startup completion, hydro online/offline, warnings, and faults.
- [x] Add graph event markers for meaningful events.
- [x] Add a graph data request helper that can return recent samples, generated
      backfill from checkpoints, and event markers.
- [x] Add a simple "last report" summary with average output, generated energy,
      brownout/online status, and latest warning.
- [x] Keep old historical data compact. Do not persist every live display
      sample.

**Exit criterion:** Closing and reopening the console can explain recent hydro
activity without needing continuous background simulation.

**Implemented:** hydro history can regenerate compact graph samples from
event-log patches, return event markers, and summarize the current review
window. The console renders marker ticks, marker labels, and a last-report
summary. Live graph samples remain transient and are not saved.

## First Build Scope

The first playable build includes Waves 1 through 5. Wave 6 historical review
is also implemented.

Included:

- Real hydro calculation core.
- Persistent hydro facility state.
- Focused hydro console view.
- Live simulated telemetry.
- Monitoring and diagnostics.
- Station power turns on and affects existing facility behavior.

## Implementation Notes

- Current implementation stopping point: Waves 1 through 6 complete.
- Verified after Wave 6 with `npm run test -w game -- hydroRuntime
  useHydroFacility HydroConsoleView hydroAlphaStartup` and full
  `npm run test` from the repository root.
- Run `npm run test` from the repository root before finishing each meaningful
  wave that changes travel, facility state, story integration, composables, or
  map behavior.
- Add focused tests near the hydro runtime for simulation math and event
  ordering.
- Add integration tests near existing game-view, save/load, and station facility
  tests when focused console opening, hydro online state, or powered station
  behavior is touched.
- Keep production builds free of builder-only code and development-only
  diagnostics.
- Treat contracts as implementation guides. Update the contracts if the
  chosen runtime shape becomes more precise than the current rough drafts, or
  when different choices are made that seem better than what the contract
  outlines.
- Ask questions about contradictions and ambiguities.
