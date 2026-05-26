# Hydroelectric Simulation

[DRAFT] — Specification for hydroelectric power simulations.

## Part I Focus — Hydro as the spine of Part I

Part I is **hydro-centric**. Zanzibar must:

1. **Start** the campus diversion plant (one-time startup gate)
2. **Learn** this plant in depth — the Upper Penstock system on Mill Brook, not hydro in the abstract
3. **Operate** it reliably for **weeks** — maintenance routine, responding to stream conditions
4. **Manage** campus power — balance generation against load across campus circuits
5. **Qualify** for Part II — sustained competent operation unlocks the hidden elevator

There is **no large dam or reservoir**. Water is diverted from Mill Brook through a **penstock** to a **turbine–generator** in the hillside **powerhouse**, controlled from the **hydro control room** in the main building.

See [Hydro research notes](../research/hydro.md) and [Story Overview](../story/story-overview.md#beat--hydro-operations-core-of-part-i).

## Plant Layout (Campus)

```
Mill Brook (mountain stream)
      │
      ▼
  Intake / weir ──► penstock (pipe downhill) ──► turbine ──► generator
      │                                              │
      └────────────── tailrace back to brook ◄────────┘
                              │
                    transmission to campus
                              │
                    Hydro control room (main building)
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
- **Part II gate** — Elevator access requires demonstrated operational competence

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

### Proposed flow

1. **Check conditions** — Head and available flow displayed (from plant telemetry). Turbine type is fixed (appropriate for this site).
2. **Open intake** — Set diversion flow (Q). Too little → insufficient power; too much → educational warning (environmental bypass / intake limits).
3. **Penstock online** — Confirm pressure stable (implicit once flow is set — or one explicit "open penstock valve" step).
4. **Start turbine** — Spinner reaches operating speed; efficiency (η) shown for current Q and H.
5. **Sync generator** — Match campus load; power (MW) crosses threshold → **success**.

### Success criteria (startup)

- Power output ≥ campus minimum (TBD — calibrate for "lights + charge port")
- No fault states triggered (cavitation warning, overspeed, etc.)
- Sets story flag: `hub.hydro_online`

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

#### Part II gate (elevator)

The **hidden elevator** requires **sustained hydro competence** — not a single perfect run. Candidate gate conditions (TBD, may combine):

- Minimum **days/weeks** of uninterrupted operation
- Power-management scenarios passed (e.g., run holo-readers + charge EV without tripping)
- Maintenance tasks completed on schedule
- Story flag: `hub.hydro_operator_qualified` → elevator discoverable or powered

### Failure modes (educational, not punitive)

- **Insufficient flow** — Q too low for load; try again with guidance from manual
- **Insufficient head** — Explained if player somehow reduces H (unlikely in Part I — mostly for sandbox mode)
- **Cavitation / overspeed** — Flow too high for turbine design; teaches operating limits
- **Generator not synced** — Turbine spinning but no power delivered (startup phase)
- **Brownout** — Load exceeds generation; teaches power management
- **Neglected maintenance** — Intake clog or drift → reduced output or trip

## Proposed Interactions

### Phase 1 — Startup (required once)

1. **Intake / flow control** — Adjust Q; see P update in real time
2. **Turbine startup** — Bring system to operating speed
3. **Generator sync** — Connect to campus load; reach power threshold

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

## Reference Data

- *TBD — Small diversion hydro plants for calibration (head, flow, MW)*
- *TBD — Typical penstock length and elevation drop for Maine foothill terrain*
- *TBD — Campus load estimate (lighting, HVAC minimal, EV L2 charge)*

## Related Docs

- [Hydro research notes](../research/hydro.md)
- [Story Overview](../story/story-overview.md) — first power beat
- [Regional Geography](../story/regional-geography.md) — Mill Brook, Upper Penstock plant
- [Learning Objectives](../learning-objectives.md)
