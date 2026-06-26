# Simulation Overview

[DRAFT] — Philosophy and standards for physics and engineering simulations in Atomic Adventures.

## Release Trilogy

| Part | Simulation spec |
| ---- | ----------------- |
| I | [Hydro](hydro-simulation.md) |
| II | [Photovoltaic](photovoltaic-simulation.md) |
| III | [Nuclear Gen IV / SMR](nuclear-gen4-simulation.md) |

Deferred / post-game: [AP-1000](nuclear-ap1000-simulation.md), [Fusion](fusion-simulation.md), [Oklo extension](oklo-aurora-extension.md). Full list: [reactor-catalog.md](../reactor-catalog.md).

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

**Release trilogy:**

- [Hydro](hydro-simulation.md) — Part I
- [Photovoltaic](photovoltaic-simulation.md) — Part II
- [Nuclear Gen IV / SMR](nuclear-gen4-simulation.md) — Part III

**Deferred / expansion:**

- [Nuclear AP-1000](nuclear-ap1000-simulation.md)
- [Fusion](fusion-simulation.md)
- [Oklo Aurora + pyroprocessing](oklo-aurora-extension.md)

## Technical Considerations

- **Engine:** Web-based (JavaScript/WebGL) vs. game engine (Unity/Godot) — TBD
- **Performance:** Simulations should run at interactive framerates
- **Accuracy:** Define "good enough" for each system; cite sources for real data
