# Hydroelectric Simulation

[DRAFT] — Specification for hydroelectric power simulations.

## Scope

- **Campus hydro plant** — High-efficiency installation; advanced beyond typical late-20th-century dams (near-future sci-fi liberty). Core teaching still uses real head/flow/power relationships.
- **Dams** — Reservoir, head, spillway, turbine
- **Run-of-river** — Flow-dependent, minimal storage
- **Pumped storage** — Pump-turbine, upper/lower reservoirs (optional expansion)

## Key Concepts to Teach

| Concept | Simulation Element |
|---------|-------------------|
| Head (elevation difference) | Slider or terrain; affects power |
| Flow rate (Q) | Inflow vs. outflow; seasonal variation |
| Power formula: P = η ρ g Q H | Display P; let player vary Q, H |
| Reservoir dynamics | Storage, drawdown, refill |
| Turbine types | Kaplan vs. Francis vs. Pelton — different efficiency curves |

## Proposed Interactions

1. **Dam builder** — Place dam, set height; adjust spillway; see power output
2. **Flow manager** — Balance inflow, outflow, reservoir level; avoid overflow or depletion
3. **Turbine selector** — Choose turbine type for head/flow conditions

## Parameters (Simplified)

- Head (m)
- Flow rate (m³/s)
- Turbine efficiency (η)
- Reservoir capacity (optional)

## Outputs

- Power (MW)
- Reservoir level (if applicable)
- Efficiency indicator

## Failure Modes (Educational)

- Overflow (spillway design)
- Cavitation at high flow
- Low head → insufficient power

## Reference Data

- *TBD — Real dam examples (Hoover, Three Gorges, etc.) for calibration*
