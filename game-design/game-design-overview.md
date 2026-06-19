# Game Design Overview

[DRAFT] — Core vision, pillars, and scope for Atomic Adventures.

## Elevator Pitch

Atomic Adventures is an immersive, reality-based fantasy adventure where players explore electricity production technologies—hydro, solar, and nuclear—through story-driven discovery. To advance, players must learn real physics and engineering concepts. Simulations are informative and fun, grounded in actual technology.

## Design Pillars

1. **Reality-Based Fantasy** — The world feels fantastical, but the science is real. No hand-waving on principles; players encounter genuine physics and engineering. Near-future **implementations** may exceed today's technology (advanced hydro, holo-readers, etc.) — see [World & Style Guide](content/story/world-and-style.md#sci-fi-boundaries).
2. **Learn to Progress** — Story gates require understanding. You can't brute-force your way through.
3. **Simulations That Teach** — Physics and engineering simulations are playable, accurate enough to be educational, and engaging enough to be fun.
4. **Technology as Adventure** — Each technology (hydro, PV, nuclear) is a distinct chapter with its own challenges and aesthetics.

## Core Loop

```
Explore → Encounter Problem → Learn Concept → Apply in Simulation → Unlock Story → Repeat
```

## Game Structure — Three Parts

The release game is **three parts**, each centered on one generation technology. Narrative detail lives in [Story Overview](content/story/story-overview.md); progression gates in [Progression Design](content/progression-design.md).

| Part | Technology | Setting | Story spine |
| ---- | ---------- | ------- | ----------- |
| **I** | Hydro | Surface campus | Forest arrival → hydro startup → **weeks of operations**; discover solar field on **eBuggy** tour |
| **II** | Photovoltaics | Surface campus | Restore the solar field discovered in Part I; compare variable solar to steady hydro |
| **III** | Gen IV SMR | Underground | Hidden elevator → dormant **small modular reactor**; **traveling party reunites** and helps operate the plant |

**Part I → II threshold:** Sustained hydro competence (`hub.hydro_operator_qualified`). The player has already **seen** the solar array from the buggy; Part II is learning to bring it online.

**Part II → III threshold:** PV restoration complete (or operational enough to justify baseload need). The **hidden elevator** and reactor tease from Part I discoveries pay off.

**Part III cast:** Zanzibar alone through Parts I–II; the rest of the **traveling party finds the compound** in Part III. Running and keeping a reactor going takes more than one person — NPC roles support operations, maintenance, and story without replacing the player's learning.

## Scope

- **Near-future setting** — Roughly 100 years of continued energy-tech advancement assumed; secret DoE research campus in Maine
- **Sci-fi liberties** — Advanced implementations (e.g. high-efficiency hydro beyond late-1900s norms, holo-readers) while core physics stays real

### In Scope — Release Trilogy

| Part | Technology | Simulation focus |
| ---- | ---------- | ---------------- |
| I | Hydroelectric | Diversion / penstock, run-of-river; startup then operations |
| II | Photovoltaic | Panel layout, irradiance, inverters, grid integration; contrast with hydro |
| III | Gen IV SMR | One **real-world SMR design in development today** (e.g. Natrium-class sodium-cooled fast reactor — exact choice TBD) |

**Extension packs (future):** Alternate SMR models swappable as content packs without changing the Part III story spine.

### Deferred — Not Core Trilogy

- **AP-1000 Gen III+ PWR** — Spec retained in [nuclear-ap1000-simulation.md](content/subject-matter/nuclear-ap1000-simulation.md) for optional or expansion content
- **Fusion (tokamak)** — Research spec only; aspirational future chapter
- **Wind, geothermal** — Possible later expansion
- **Fossil fuels** — Out of scope unless needed for contrast or backstory
- **Full grid-level simulation** — May be simplified or abstracted

## Target Audience

- Players curious about energy and technology
- Educators looking for engaging STEM content
- Fans of puzzle-adventure and narrative games

## Platform

- **Frontend:** Vue 3 + Vite (playable game in `game/`)
- **Simulations:** Web-based (Canvas/WebGL) Vue components
- **Deployment:** Web-first (Vercel); native/mobile possible later

## Success Criteria (Design Phase)

- [ ] Story outline complete and coherent across all three parts
- [ ] Each trilogy technology has a clear simulation spec
- [ ] Learning objectives mapped to story beats
- [x] Art direction and tone defined — see [World & Style Guide](content/story/world-and-style.md)
- [ ] Progression feels rewarding and non-frustrating

## Open Questions

- How deep should each simulation go? (full thermodynamic modeling vs. simplified — see [Simulation Overview](content/subject-matter/simulation-overview.md))
- Which SMR design anchors Part III at launch?
- Estimated playtime per part / full trilogy?
- How do party members divide reactor tasks without splitting the player's core learning loop?
