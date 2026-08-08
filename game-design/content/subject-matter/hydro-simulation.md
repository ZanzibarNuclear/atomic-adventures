# Hydroelectric Simulation

[DRAFT] — Specification for hydroelectric power simulations.

## Plant of record

**2026-08-05:** Generation and station-bus behavior for Part I use the
solidified Stage 1 model in sibling **`../sims/energy-sims`**.

| Name | Role |
|------|------|
| **Clearwater Run** | Stream (discovery-gated name) |
| **Clearwater Diversion** | Hydro plant fixture |
| **Clearwater Station** | Utility station + local grid session |

See [Regional Geography](../story/regional-geography.md) and
[docs/contracts/hydro-simulator.md](../../../docs/contracts/hydro-simulator.md).
Use only Clearwater names (Run / Diversion / Station); draft Mill Brook and
Upper Penstock labels are retired.

## Part I Focus — Hydro as the spine of Part I

Part I is **hydro-centric**. Zanzibar must:

1. **Start** the campus diversion plant (one-time startup gate)
2. **Learn** this plant in depth — **Clearwater Diversion** on **Clearwater Run**, not hydro in the abstract
3. **Operate** it reliably for **weeks** — maintenance routine, responding to stream conditions
4. **Manage** campus power — balance generation against load across campus circuits at **Clearwater Station**
5. **Qualify** for Part II — sustained competent operation unlocks the PV chapter (solar field already discovered on eBuggy tour)

There is **no large dam or reservoir**. Water is diverted from Clearwater Run through a **penstock** to a **turbine–generator** in the hillside **powerhouse**, controlled from the **hydro control room** in the main building (Clearwater Station).

See [Hydro research notes](../research/hydro.md) and [Story Overview](../story/story-overview.md#beat--hydro-operations-core-of-part-i).

## Plant Layout (Campus)

```
Clearwater Run (mountain stream / run)
      │
      ▼
  Intake / weir ──► penstock (pipe downhill) ──► turbine ──► generator
      │                                              │
      └────────────── tailrace back to run ◄──────────┘
                              │
              Clearwater Diversion (powerhouse)
                              │
                    transmission to campus bus
                              │
         Hydro control room (Clearwater Station)
```

| Component | Role in story / sim |
|-----------|---------------------|
| **Intake** | Diverts stream flow into the penstock; player opens/adjusts flow (Q) |
| **Penstock** | Conveys water downhill; **head (H)** comes from elevation drop along its route |
| **Turbine** | Converts water energy to mechanical rotation; type affects efficiency (η) |
| **Generator** | Converts rotation to electricity; sync and load acceptance for "power on" |
| **Control room** | Remote monitoring and startup — where Part I gameplay lives |

**Near-future liberty:** High-efficiency turbines, smart intake controls, and advanced penstock materials — beyond typical late-20th-century small hydro, but **P = η ρ g Q H** still governs.

## Scope

### In scope (Part I and this spec)

- **Diversion / run-of-river** — Flow-dependent; minimal or no storage
- **Penstock, turbine, generator** — Primary teaching and interaction targets
- **Startup sequence** — One-time gate: intake → penstock → turbine → generator sync
- **Operations loop** — Recurring maintenance and monitoring over in-game weeks
- **Power management** — Campus load allocation; supply/demand balance
- **Part II gate** — Hydro operator qualification required before PV restoration chapter

### Out of scope for Part I (optional later)

- **Storage dams** — Large reservoirs, spillways, drawdown puzzles
- **Pumped storage** — Pump-turbine, upper/lower reservoirs
- **Full grid dispatch** — Campus load is simplified to a pass/fail threshold

## Key Concepts to Teach

| Concept | Simulation Element |
|---------|-------------------|
| **Head (H)** | Elevation drop from intake to turbine; fixed by terrain or shown on diagram |
| **Flow rate (Q)** | Stream flow diverted into penstock; player adjusts intake |
| **Power: P = η ρ g Q H** | Live readout; player sees effect of changing Q, H, η |
| **Turbine types** | Pelton vs. Francis vs. Kaplan — different efficiency curves for head/flow |
| **Generator sync** | Bring turbine to speed, connect to campus load (simplified) |
| **Load balancing** | Match generation to campus demand; avoid brownouts and plant stress |
| **Operator maintenance** | Intake clearing, telemetry checks, responding to drift and weather |

## Part I Simulation — Two Phases

### Phase 1: Startup (one-time gate)

The first hydro simulation is a **startup sequence**. Zanzibar has read enough in the library; the sim tests application.

### Level 1 startup flow (four steps)

Canonical unlock chain — see [Part I Unlocks](../part-i-unlocks.md#hydro--level-1-startup).

| Step | Player action | Teaching moment |
| ---- | ------------- | --------------- |
| 1 | **Clear intake debris** | Flow path must be open before anything else works |
| 2 | **Confirm penstock pressure rising** | Head pressure proves the line is filling |
| 3 | **Open valve to turbine** | Admit flow; turbine begins to spin |
| 4 | **Energize / sync generator** | Deliver power to campus → **station power on** |

**Level 1 complete** when step 4 succeeds.

### Success criteria (startup)

- Power output ≥ campus minimum (TBD — calibrate for "lights + charge port")
- No fault states triggered (cavitation warning, overspeed, etc.)
- Sets flags: `hydro.level-1-complete`, `hub.hydro_online`

### Phase 2: Operations (weeks — core gameplay)

After startup, hydro becomes a **recurring responsibility**. Game time advances in days and weeks; the player returns to the control room on a routine cadence (daily checks, weekly maintenance — exact schedule TBD).

#### Operations loop

| Task | Player action | Teaches |
| ---- | ------------- | ------- |
| **Morning check** | Review telemetry: Q, H, P, turbine status | Situational awareness |
| **Intake maintenance** | Clear debris, adjust diversion when stream changes | Flow variability; environmental limits |
| **Penstock monitoring** | Respond to pressure anomalies | System integrity |
| **Load management** | Enable/disable campus circuits; prioritize loads | Supply must match demand |
| **Fault response** | Diagnose and correct drift, brownouts, trips | Cause and effect; operator judgment |

#### Power management (control room)

The hydro control room exposes **campus power controls** — not just plant telemetry:

- **Generation side** — Intake flow, turbine setpoint, current output (MW)
- **Load side** — Campus circuits: lighting zones, holo-readers, EV charge, auxiliary systems
- **Balance** — Drawing more load than generation allows → brownout; excess generation → waste or stress

Scenarios escalate over weeks: routine days, weather-reduced stream flow, higher load when Zanzibar activates new campus systems, combined maintenance + load challenges.

#### Part II gate (hydro operator qualified)

Sustained hydro competence — not a single perfect run — gates **Part II** (solar restoration). Candidate gate conditions (TBD, may combine):

- Minimum **days/weeks** of uninterrupted operation
- Power-management scenarios passed (e.g., run holo-readers + charge EV without tripping)
- Maintenance tasks completed on schedule
- Story flag: `hub.hydro_operator_qualified` → Part I ending / Part II available
- Discovery flag: `hub.solar-discovered` — player already saw the array on the eBuggy tour

### Failure modes (educational, not punitive)

- **Insufficient flow** — Q too low for load; try again with guidance from manual
- **Insufficient head** — Explained if player somehow reduces H (unlikely in Part I — mostly for sandbox mode)
- **Cavitation / overspeed** — Flow too high for turbine design; teaches operating limits
- **Generator not synced** — Turbine spinning but no power delivered (startup phase)
- **Brownout** — Load exceeds generation; teaches power management
- **Neglected maintenance** — Intake clog or drift → reduced output or trip

## Proposed Interactions

### Phase 1 — Startup (required once)

1. **Clear intake** — Debris removed; path ready for diversion
2. **Penstock pressure** — Read gauges; confirm rise
3. **Turbine valve** — Open admission; spin up
4. **Generator** — Sync; reach power threshold

### Phase 2 — Operations (recurring, weeks)

1. **Daily telemetry review** — Quick status check; catch anomalies
2. **Maintenance tasks** — Intake, penstock, turbine care (simplified checklist)
3. **Load manager** — Allocate campus demand vs. available hydro output
4. **Event response** — Weather, debris, circuit additions — adjust flow and load

### Later / sandbox (optional)

1. **Turbine selector** — Choose turbine type for given head/flow; compare η curves
2. **Penstock explorer** — Diagram showing how H accumulates along the pipe route

## Parameters (Simplified)

| Parameter | Symbol | Part I | Notes |
|-----------|--------|--------|-------|
| Head | H (m) | Fixed (site) | From intake elevation − powerhouse elevation |
| Flow rate | Q (m³/s) | Player adjusts | Diverted stream flow |
| Turbine efficiency | η | Fixed or displayed | Depends on turbine type and operating point |
| Water density | ρ | Constant | 1000 kg/m³ |
| Gravity | g | Constant | 9.81 m/s² |
| Campus load | P_load (MW) | Threshold | Minimum power to pass gate |

## Outputs

- **Power (MW)** — Primary feedback: P = η ρ g Q H
- **Turbine speed / status** — Spinning, synced, fault
- **Generator output** — Delivered to campus
- **Efficiency indicator** — η at current operating point

## Physical Plant State (Grid Map Sketch)

The micro-hydro generator is sketched on the outdoor grid map as a static illustration.
The components and their tracked states are:

### Component Inventory

| Component | ID | Location on map |
|-----------|----|-----------------|
| Intake screen | `hydro.intake` | Just upstream of "Riverbank upstream" node |
| Penstock pipe | `hydro.penstock` | East bank, between river and riverside path |
| Divert valve | `hydro.valve.divert` | At the "Midstream bank" node on the penstock |
| Entry valve | `hydro.valve.entry` | Where the penstock enters the powerhouse |
| Pressure gauge | `hydro.gauge` | Beside the entry valve inside the powerhouse |
| Turbine | `hydro.turbine` | Inside the powerhouse enclosure |
| Generator | `hydro.generator` | Above the turbine inside the powerhouse |
| Drain pipe | `hydro.drain` | From turbine outlet to river cascade |

### State Variables

| Variable | Type | Values / Range | Notes |
|----------|------|----------------|-------|
| `hydro.intake_clear` | boolean | `true` / `false` | Whether intake screen is free of debris (branches, leaves) |
| `hydro.valve.divert.position` | enum | `open` / `closed` | **Open** = water diverts back to cascade; **Closed** = water flows down penstock to turbine |
| `hydro.valve.entry.position` | enum | `open` / `closed` | Valve at powerhouse entry; must be open to admit flow to turbine |
| `hydro.pressure` | number | 0 – max psi | Head pressure in the penstock; zero when divert valve is open or intake is blocked |
| `hydro.turbine.speed` | number | 0 – max rpm | Turbine rotational speed; proportional to flow and head |
| `hydro.turbine.status` | enum | `stopped` / `spinning` / `synced` / `fault` | Operational status |
| `hydro.power_kw` | number | 0 – rated kW | Electrical output; P = η ρ g Q H; zero until generator is synced |

### Startup Sequence (flags set in order)

1. `hydro.intake_clear = true` — debris removed from screen
2. `hydro.valve.divert.position = closed` — stops bypass, fills penstock
3. `hydro.pressure` rises above minimum threshold
4. `hydro.valve.entry.position = open` — admits flow to turbine
5. `hydro.turbine.status = synced` — generator locks to grid frequency
6. `hydro.power_kw > 0` — power delivered; sets `hub.hydro_online`

## Reference Data

- [Part I Unlocks](../part-i-unlocks.md) — challenge IDs, ops rounds, discovery track
- [Hydro research notes](../research/hydro.md)
- [Story Overview](../story/story-overview.md) — first power beat
- [Regional Geography](../story/regional-geography.md) — Clearwater Run, Clearwater Diversion, Clearwater Station
- [energy-sims](../../../../sims/energy-sims/README.md) — plant-of-record engine and Clearwater fixtures
- [Learning Objectives](../learning-objectives.md)
