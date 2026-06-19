# Learning Objectives

[DRAFT] — What players should understand by the end of each chapter/technology.

## Design Principle

Learning objectives drive story gates. A player cannot advance until they demonstrate understanding (through simulation success, puzzle solution, or in-world assessment).

## By Part / Technology

### Part I — Hydro (startup through operations)

| Objective | Assessment |
|-----------|------------|
| Understand head and flow determine power | Correctly predict P from Q, H in simulation |
| Know penstock → turbine → generator chain | Complete Level 1 startup: clear intake → pressure rise → turbine valve → generator ([unlocks](part-i-unlocks.md#hydro--level-1-startup)) |
| Operate this plant reliably | Complete maintenance routine over in-game weeks |
| Manage campus power supply and demand | Balance loads without brownouts; pass power-management scenarios |
| Recognize turbine types | Choose appropriate turbine for conditions (sandbox / later) |

### Part II — Photovoltaic

| Objective | Assessment |
|-----------|------------|
| Understand irradiance and tilt | Optimize panel placement for output |
| Know shading impact | Identify and mitigate shading |
| Grasp inverter role | Size system correctly |
| Compare variable solar to steady hydro | Integrate PV with ongoing hydro ops without destabilizing campus load |

### Part III — Gen IV SMR

| Objective | Assessment |
|-----------|------------|
| Understand fast vs. thermal neutrons | Explain why the SMR has no moderator |
| Know coolant properties (e.g. sodium) | Anticipate coolant behavior in transient |
| Grasp inherent safety | Explain negative feedback |
| Recognize baseload role | Explain why hydro + solar led to needing the reactor |

### Deferred — Optional / Expansion Content

**AP-1000 Gen III+** and **fusion** specs remain in `subject-matter/` for future packs; not part of the release trilogy learning path.

**Oklo Aurora extension** (post-game, after SMR operational) — pyroprocessing + optional fast module: [oklo-aurora-extension.md](subject-matter/oklo-aurora-extension.md). Catalog: [reactor-catalog.md](reactor-catalog.md).

| Objective | Assessment |
|-----------|------------|
| Understand spent-fuel constituents (U, TRU, fission products) | Identify recyclable vs waste streams in cask/holo-reader |
| Explain why fast reactors pair with recycling | U/TRU fuel usable in Aurora, not in thermal LWR |
| Describe electrorefining at high level | Route U/TRU product vs waste in simplified pyro sim |
| Recognize proliferation-resistance claim | U and TRU stay mixed — contrast with PUREX (lore) |
| Operate closed fuel cycle | Process casks → fabricate metal fuel → run fast reactor |

## Cross-Cutting Concepts

- **Efficiency** — All technologies have losses; where do they go?
- **Grid integration** — How does variable (solar) vs. baseload (nuclear) vs. dispatchable (hydro) differ?
- **Scale** — Orders of magnitude (kW vs. GW)

## Revision Notes

- [x] Map objectives to three-part release structure (2026-06)
- *Align with story beats in [Story Overview](story/story-overview.md)*
