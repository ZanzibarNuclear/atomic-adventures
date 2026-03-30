# Fusion Reactor Simulation

[DRAFT] — Specification for fusion reactor simulation (tokamak / magnetic confinement).

## Scope

- **Tokamak** — Toroidal geometry, magnetic field, plasma
- **Confinement** — Why magnetic fields? Losses?
- **Heating** — Ohmic, NBI, RF
- **Ignition** — Lawson criterion, Q > 1

## Key Concepts to Teach

| Concept | Simulation Element |
|---------|-------------------|
| Plasma confinement | Magnetic field contains charged particles |
| Lawson criterion | nτE T — density, confinement time, temperature |
| Heating | Input power to reach ignition |
| Breakeven (Q=1) | Power out = power in |
| Instabilities | Disruptions (simplified) |

## Proposed Interactions

1. **Magnetic configuration** — Adjust field strength; see confinement quality
2. **Heating** — Add heating power; watch temperature, approach ignition
3. **Stability** — Push limits; observe disruption (educational)

## Parameters (Simplified)

- Magnetic field strength
- Plasma density
- Heating power
- Confinement time (or derived)

## Outputs

- Plasma temperature
- Fusion power
- Q (fusion gain)
- Stability indicator

## Simplifications

- Full MHD not required; phenomenological models OK
- Focus on intuition: confinement, heating, breakeven

## Reference Data

- ITER parameters
- NRL, PPPL educational resources
- *TBD — Calibration values*
