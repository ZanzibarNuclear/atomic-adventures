# Hydro Generator Implementation Plan

**Status:** Planned  
**Last updated:** 2026-07-01  
**Primary contracts:** [Hydro Simulator](../contracts/hydro-simulator.md), [Control Panel](../contracts/control-panel.md), [Stage Views](../contracts/stage-views.md), [Game Time](../contracts/time.md)  
**Quality checklist:** [Character, Inventory, and Game-View Regression Checklist](../quality/character-inventory-regression-checklist.md)

## Goal

Implement the first playable hydro generator build-out in the `game/` app. The
first build should lay the runtime foundation, connect the hydro plant to
facility state, and let the player turn on the Upper Penstock generator from
the control-room console while watching simulated real-time telemetry.

The player-facing alpha loop is:

1. Clear debris and open the intake.
2. Turn two manual valves.
3. Open the hydro control-room console.
4. Flip the generator switch from the console.
5. Watch pressure, turbine speed, and output respond in real time.
6. Bring station power online so existing hydro-powered station behavior works.

The first implementation should be concrete and code-built. It should not add
builder support, authored panel configuration, a full campus electrical panel,
or complex generator synchronization until the core loop is playable.

## Decisions

- Implement the hydro simulator under `game/src/lib/simulations/hydro/`.
- Keep hydro formulas and interval logic in testable JavaScript modules, not in
  Vue components.
- Use a code-built `upper-penstock-baseline` configuration for the alpha.
- Use the existing `console` stage-view kind for the hydro control-room panel.
- Keep panel view state transient unless a later scenario deliberately resumes
  an in-progress console session.
- Keep simulator internals separate from story flags, character effects, save
  writes, and panel rendering.
- Route durable state changes through a host/facility adapter.
- Let the console diagnose field work, but do not let the console directly
  repair intake debris, manual valves, leaks, or other physical problems.
- Start with easy-mode hydro behavior: stable stream flow, no surprise faults,
  and a hidden battery/inverter buffer that avoids detailed electrical
  synchronization.

## Open Decisions

- Which two manual valve locations are canonical for the alpha startup path?
- Should the first satisfying output target be roughly `500 W`, `1 kW`, or
  `2 kW`?
- Should the player-facing alpha label be "generator switch", "circuit
  switch", or "sync breaker"?
- Should durable hydro state live in a new dedicated `gameState.facilities.hydro`
  shape, with `indoor.indoor.facility.hydroOnline` mirrored for existing door
  behavior, or directly under the current indoor facility state?

Recommended starting answers:

- Use a dedicated hydro facility state and mirror only `hydroOnline` into the
  existing indoor facility field.
- Target roughly `1 kW` for first light.
- Use "generator switch" in the alpha UI, even if the underlying command ID is
  later renamed to match a more precise electrical model.

## Wave 1 - Hydro Runtime Foundation

**Purpose:** Build the simulation core before any UI depends on it.

- [ ] Add `game/src/lib/simulations/hydro/`.
- [ ] Reuse or move hydro equation helpers from
      `game/src/lib/learning/hydroPower.js`.
- [ ] Define a code-built `upper-penstock-baseline` plant configuration.
- [ ] Define serializable alpha hydro state:
      active configuration ID, hydro online/offline, intake clear/open, two
      manual valve states, generator switch state, exciter state, last
      checkpoint time, simple event log, debris fraction, and leakage fraction.
- [ ] Implement telemetry snapshot generation for `flowM3s`, `netHeadM`,
      `penstockPressureKpa`, `turbineSpeedRpm`, `generatorOutputKw`,
      `warnings`, `faults`, and `status`.
- [ ] Implement command handling for `hydro.set-exciter`,
      `hydro.set-generator-switch`, and non-durable
      `hydro.select-configuration`.
- [ ] Add deterministic tests for offline startup, valid startup, partially
      closed valves, intake debris, leakage, low flow, and event ordering.

**Exit criterion:** Pure JavaScript tests can transition the plant from offline
to online and produce stable telemetry without rendering a Vue component.

## Wave 2 - Save State and Facility Integration

**Purpose:** Make hydro state part of the playable runtime without coupling the
simulator to story flags or panel rendering.

- [ ] Add the chosen durable hydro state shape to saved game state.
- [ ] Update snapshot capture/apply in `game/src/composables/useGameState.js`.
- [ ] Add a host adapter, such as `useHydroFacility(gameState, indoor)`, that
      reads facility facts, sends commands to the simulator, records accepted
      events, and exposes current telemetry.
- [ ] Mirror hydro online/offline into the existing facility state used by
      hydro-powered station doors and systems.
- [ ] Ensure save/load preserves active config, online/offline state, switch
      state, field prerequisite state, last checkpoint time, and event log.
- [ ] Keep story flags and character progression outside the simulator. If a
      story milestone such as `hub.hydro_online` is needed, commit it through a
      host-owned effect or story boundary.

**Exit criterion:** Turning hydro online survives save/load and powers existing
hydro-gated station behavior.

## Wave 3 - Console Stage View Shell

**Purpose:** Render the hydro control-room panel inside the existing stage-view
system.

- [ ] Add a `ConsoleStageView.vue` stage component.
- [ ] Wire `activeView.kind === "console"` in `GameView.vue`.
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
close the hydro console without moving the player or losing narrative context.

## Wave 4 - Live Monitor and Console Controls

**Purpose:** Let the player watch simulated real-time behavior and issue the
first remote commands.

- [ ] Add a panel-side live sampler that requests telemetry from the hydro host
      adapter while the console is open.
- [ ] Drive display updates from wall-clock ticks, but derive simulated samples
      from authored game time plus a local monitor offset.
- [ ] Do not secretly advance the shared game clock just because the monitor is
      animating.
- [ ] Keep high-resolution graph samples transient in the panel.
- [ ] Show instant readouts for pressure, turbine speed, power output, flow, net
      head, plant status, warnings, and faults.
- [ ] Add required graphs:
      power output, and pressure plus turbine speed.
- [ ] Add an optional first flow/net-head graph if it does not slow the wave.
- [ ] Add controls for exciter and generator switch.
- [ ] Add the what-if profile selector only if the baseline command path is
      already stable.
- [ ] Display structured command rejections for missing intake preparation,
      closed valves, generator unavailable, insufficient pressure, or
      insufficient turbine speed.
- [ ] When the generator switch closes successfully, update facility state and
      show station power online.

**Exit criterion:** With prerequisites satisfied, the player can turn on the
generator from the console and watch telemetry respond in simulated real time.

## Wave 5 - World Actions for Startup Prerequisites

**Purpose:** Connect the console loop to actual field work in the playable
world.

- [ ] Add or reuse world/indoor actions for clearing and opening the intake.
- [ ] Add or reuse world/indoor actions for turning the two manual valves.
- [ ] Make successful field actions emit host-owned hydro facility changes.
- [ ] Make the console diagnose missing prerequisites and offer guided actions
      without directly applying those changes.
- [ ] Keep guided actions as host requests: return to map, focus a route, show
      an objective, or expose an ordinary story/world action.
- [ ] Add tests for the full alpha startup path:
      field prerequisites, console switch, hydro online, save/load, and
      hydro-powered facility behavior.

**Exit criterion:** The alpha startup sequence works end to end through normal
gameplay actions and the hydro console.

## Wave 6 - Historical Review and Event Markers

**Purpose:** Make the console useful after the startup moment, without adding a
full operations game yet.

- [ ] Store compact event log entries for intake changes, valve changes,
      exciter changes, generator switch changes, hydro online/offline, warnings,
      and faults.
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
- Hydro console stage view.
- Live simulated telemetry.
- Startup controls.
- Field prerequisite actions.
- Station power turns on and affects existing facility behavior.

Deferred:

- Full campus electrical panel.
- Detailed battery state of charge.
- Complex breaker synchronization, frequency, and governor behavior.
- Long-term debris accumulation.
- Pipe leak repair scenario.
- Authored panel configuration.
- Builder support.
- Full historical rollups.
- Durable upgrade profiles.

## Implementation Notes

- Run `npm run test` from the repository root before finishing each meaningful
  wave that changes travel, facility state, story integration, composables, or
  map behavior.
- Add focused tests near the hydro runtime for simulation math and event
  ordering.
- Add integration tests near existing game-view, save/load, and indoor facility
  tests when console opening, hydro online state, or powered station behavior is
  touched.
- Keep production builds free of builder-only code and development-only
  diagnostics.
- Treat contracts as implementation guides, but update the contracts if the
  chosen runtime shape becomes more precise than the current rough drafts.
