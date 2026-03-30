# Simulation Overview

[DRAFT] — Philosophy and standards for physics and engineering simulations in Atomic Adventures.

## Goals

- **Informative** — Players learn real concepts (e.g., head vs. flow in hydro, neutron multiplication in nuclear)
- **Fun** — Interactions feel responsive and rewarding; failure is instructive
- **Reality-based** — Parameters and behaviors align with real technology where possible

## Simulation Fidelity Spectrum

| Level | Description | Example |
|-------|-------------|---------|
| **Conceptual** | Abstract representation; teaches idea, not numbers | Water flows downhill → turbine spins |
| **Simplified** | Real equations, simplified inputs/outputs | P = ρgQH with sliders |
| **Detailed** | Multiple coupled systems; closer to real design | Full PWR reactivity feedback |
| **Reference** | Links to real data (NRC, IAEA, manufacturer docs) | AP-1000 design control document |

**Design choice:** Start at Simplified; add Detail where it serves story and learning.

## Common Elements Across Simulations

1. **Inputs** — Player-adjustable parameters (flow rate, head, fuel enrichment, etc.)
2. **Outputs** — Power, efficiency, safety indicators
3. **Feedback** — Visual/audio response to changes
4. **Failure modes** — What happens when limits are exceeded? (Educational, not punitive)

## Technology-Specific Specs

- [Hydro](hydro-simulation.md)
- [Photovoltaic](photovoltaic-simulation.md)
- [Nuclear AP-1000](nuclear-ap1000-simulation.md)
- [Nuclear Gen IV](nuclear-gen4-simulation.md)
- [Fusion](fusion-simulation.md)

## Technical Considerations

- **Engine:** Web-based (JavaScript/WebGL) vs. game engine (Unity/Godot) — TBD
- **Performance:** Simulations should run at interactive framerates
- **Accuracy:** Define "good enough" for each system; cite sources for real data
