# Nuclear AP-1000 Simulation

[DRAFT] — Specification for Westinghouse AP-1000 PWR simulation.

## Scope

- **Reactor core** — Fission, neutron multiplication, reactivity
- **Primary loop** — Coolant flow, temperature, pressure
- **Steam generator** — Heat transfer to secondary
- **Safety systems** — Passive cooling, containment (simplified)

## Key Concepts to Teach

| Concept | Simulation Element |
|---------|-------------------|
| Criticality | k_eff = 1; control rods adjust reactivity |
| Decay heat | Power continues after shutdown |
| Coolant flow | Removes heat; loss of flow = problem |
| Defense in depth | Multiple safety systems |
| Passive safety | AP-1000's passive cooling features |

## Proposed Interactions

1. **Reactivity control** — Adjust control rods; maintain criticality
2. **Power maneuver** — Ramp up/down; observe temperatures, pressures
3. **Transient response** — Simulate trip; watch decay heat, passive systems

## Parameters (Simplified)

- Control rod position
- Coolant flow rate
- Inlet/outlet temperature
- Power level (%)

## Outputs

- Reactor power (MW)
- Core temperature
- Coolant temperature (hot/cold leg)
- Safety status indicators

## Failure Modes (Educational)

- Overheating (loss of coolant, loss of flow)
- Positive reactivity insertion
- *Handled with educational framing — what went wrong, how to prevent*

## Reference Data

- AP-1000 Design Control Document (NRC)
- Westinghouse technical specifications
- *TBD — Specific values for calibration*
