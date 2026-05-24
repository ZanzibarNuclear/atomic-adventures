# Game Design Overview

[DRAFT] — Core vision, pillars, and scope for Atomic Adventures.

## Elevator Pitch

Atomic Adventures is an immersive, reality-based fantasy adventure where players explore electricity production technologies—hydro, solar, and nuclear—through story-driven discovery. To advance, players must learn real physics and engineering concepts. Simulations are informative and fun, grounded in actual technology.

## Design Pillars

1. **Reality-Based Fantasy** — The world feels fantastical, but the science is real. No hand-waving on principles; players encounter genuine physics and engineering. Near-future **implementations** may exceed today's technology (advanced hydro, holo-readers, etc.) — see [World & Style Guide](content/story/world-and-style.md#sci-fi-boundaries).
2. **Learn to Progress** — Story gates require understanding. You can't brute-force your way through.
3. **Simulations That Teach** — Physics and engineering simulations are playable, accurate enough to be educational, and engaging enough to be fun.
4. **Technology as Adventure** — Each technology (hydro, PV, nuclear) is a distinct "realm" or chapter with its own challenges and aesthetics.

## Core Loop

```
Explore → Encounter Problem → Learn Concept → Apply in Simulation → Unlock Story → Repeat
```

## Scope

- **Near-future setting** — Roughly 100 years of continued energy-tech advancement assumed; secret DoE research campus in Maine
- **Sci-fi liberties** — Advanced implementations (e.g. high-efficiency hydro beyond late-1900s norms, holo-readers) while core physics stays real

### In Scope (Design Phase)

- Hydroelectric power (dams, run-of-river, pumped storage)
- Photovoltaic power (solar panels, inverters, grid integration)
- Nuclear: Westinghouse AP-1000 PWR (Gen III+)
- Nuclear: Gen IV sodium-cooled fast reactor
- Nuclear: Other Gen IV designs as they come online in real life
- Fusion reactor (tokamak / magnetic confinement concepts)

### Out of Scope (For Now)

- Fossil fuels (coal, gas) — unless needed for contrast or backstory
- Wind, geothermal — possible future expansion
- Full grid-level simulation — may be simplified or abstracted

## Target Audience

- Players curious about energy and technology
- Educators looking for engaging STEM content
- Fans of puzzle-adventure and narrative games

## Platform Considerations

- **Frontend:** Vue.js or React (per project conventions)
- **Simulations:** Web-based (WebGL/Canvas) or integrated engine — TBD
- **Deployment:** Web-first; native/mobile possible later

## Success Criteria (Design Phase)

- [ ] Story outline complete and coherent
- [ ] Each technology has a clear simulation spec
- [ ] Learning objectives mapped to story beats
- [ ] Art direction and tone defined
- [ ] Progression feels rewarding and non-frustrating

## Open Questions

- How deep should each simulation go? (e.g., full thermodynamic modeling vs. simplified)
- What is the tone? (Serious, whimsical, hopeful, cautionary?)
- Single-player only, or any multiplayer/social elements?
- Estimated playtime per technology / full game?
