# Hydro Generator Implementation Plan

**Status:** Planned  
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
  already recognizes `console` as a view kind, but there is no implemented
  console experience yet.
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

- [ ] Add `game/src/lib/simulations/hydro/`.
- [ ] Reuse or move hydro equation helpers from
      `game/src/lib/learning/hydroPower.js`.
- [ ] Define a code-built `hydro-generator-baseline` plant configuration.
- [ ] Define serializable alpha hydro state:
      active configuration ID, hydro online/offline, intake clear/open, two
      manual valve states, startup completion state, last checkpoint time,
      simple event log, debris fraction, and leakage fraction.
- [ ] Implement telemetry snapshot generation for `flowM3s`, `netHeadM`,
      `penstockPressureKpa`, `turbineSpeedRpm`, `generatorOutputKw`,
      `warnings`, `faults`, and `status`.
- [ ] Keep command handling minimal in the first build. The simulator may expose
      read-only graph-data and telemetry requests, but the console should not
      bypass the required startup steps or adjust field equipment.
- [ ] Add deterministic tests for offline startup, valid startup, partially
      closed valves, intake debris, leakage, low flow, and event ordering.

**Exit criterion:** Pure JavaScript tests can transition the plant from offline
to online and produce stable telemetry without rendering a Vue component.

## Wave 2 - Save State and Facility Integration

**Purpose:** Make hydro state part of the playable runtime without coupling the
simulator to story flags or panel rendering.

- [ ] Choose and add the durable hydro state shape to saved game state. Treat
      the hydro generator as utility-station facility state, not as inherently
      indoor-only state.
- [ ] Update snapshot capture/apply in `game/src/composables/useGameState.js`.
- [ ] Add a host adapter, such as `useHydroFacility(gameState, stationContext)`,
      that reads facility facts, sends commands to the simulator, records
      accepted events, and exposes current telemetry.
- [ ] Bridge hydro online/offline into the existing powered-door checks without
      storing complex simulator state beside door state unless that proves to
      be the cleanest local design.
- [ ] Ensure save/load preserves active config, online/offline state, startup
      completion state, field prerequisite state, last checkpoint time, and
      event log.
- [ ] Keep story flags and character progression outside the simulator. If a
      story milestone such as `hub.hydro_online` is needed, commit it through a
      host-owned effect or story boundary.

**Exit criterion:** The hydro generator's online state survives save/load and
powers existing hydro-gated station behavior.

## Wave 3 - Focused Console View Shell

**Purpose:** Invent and render the first focused console view, using the hydro
control-room panel as the concrete vertical slice.

- [ ] Add a console view component, such as `HydroConsoleView.vue`, that owns
      the full focused console experience.
- [ ] Wire `activeView.kind === "console"` in `GameView.vue`; the view kind is
      allowed today, but it does not have a real renderer yet.
- [ ] Present the console like the holo-reader: a separate focused view that is
      visually independent from the ordinary map/story combo.
- [ ] Register or resolve `panelId: "hydro-control-room-panel"`.
- [ ] Render the first concrete hydro panel with three sections:
      schematic/status, instant overview, and live graphs.
- [ ] Support a payload like:

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

- [ ] Add a shared Return to Map action consistent with inventory, character,
      and lesson views.
- [ ] Show a validation error for unknown panel IDs rather than a blank panel.

**Exit criterion:** A story choice or temporary development action can open and
close the focused hydro console without moving the player, losing narrative
context, or relying on the ordinary map/story layout for the console UI.

## Wave 4 - Live Monitor and Diagnostics

**Purpose:** Let the player watch simulated real-time behavior and understand
the generator's condition from the control-room console.

- [ ] Add a panel-side live sampler that requests telemetry from the hydro host
      adapter while the console is open.
- [ ] Drive display updates from wall-clock ticks, but derive simulated samples
      from authored game time plus a local monitor offset.
- [ ] Keep high-resolution graph samples transient in the panel.
- [ ] Show instant readouts for pressure, turbine speed, power output, flow, net
      head, plant status, warnings, and faults.
- [ ] Add required graphs:
      power output, and pressure plus turbine speed.
- [ ] Add an optional first flow/net-head graph if it does not slow the wave.
- [ ] Display structured diagnostic messages for missing intake preparation,
      closed valves, generator unavailable, insufficient pressure, insufficient
      turbine speed, or missing station power.
- [ ] Show station power online when the host facility state says the existing
      startup path has brought the hydro generator online.

**Exit criterion:** After the existing startup path brings the hydro generator
online, the player can open the console, watch telemetry respond in simulated
real time, and understand the current generator state from the diagnostics.

## Wave 5 - World Actions for Startup Prerequisites

**Purpose:** Connect the console loop to actual field work in the playable
world.

- [ ] Reuse the existing world/indoor actions for clearing and opening the
      intake.
- [ ] Reuse the existing world/indoor actions for turning the two manual valves.
- [ ] Reuse the existing world/indoor startup action or switch interaction that
      brings the hydro generator online.
- [ ] Make successful field actions emit host-owned hydro facility changes.
- [ ] Make the console diagnose missing prerequisites and offer guided actions
      without directly applying those changes.
- [ ] Keep guided actions as host requests: return to map, focus a route, show
      an objective, or expose an ordinary story/world action.
- [ ] Add tests for the full alpha startup path:
      field prerequisites, startup action, hydro online, console monitoring,
      save/load, and hydro-powered facility behavior.

**Exit criterion:** The alpha startup sequence works end to end through normal
gameplay actions and the hydro console.

## Wave 6 - Historical Review and Event Markers

**Purpose:** Make the console useful after the startup moment, without adding a
full operations game yet.

- [ ] Store compact event log entries for intake changes, valve changes,
      startup completion, hydro online/offline, warnings, and faults.
- [ ] Add graph event markers for meaningful events.
- [ ] Add a graph data request helper that can return recent samples, generated
      backfill from checkpoints, and event markers.
- [ ] Add a simple "last report" summary with average output, generated energy,
      brownout/online status, and latest warning.
- [ ] Keep old historical data compact. Do not persist every live display
      sample.

**Exit criterion:** Closing and reopening the console can explain recent hydro
activity without needing continuous background simulation.

## First Build Scope

The first playable build should include Waves 1 through 5.

Included:

- Real hydro calculation core.
- Persistent hydro facility state.
- Focused hydro console view.
- Live simulated telemetry.
- Monitoring and diagnostics.
- Station power turns on and affects existing facility behavior.

## Implementation Notes

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
