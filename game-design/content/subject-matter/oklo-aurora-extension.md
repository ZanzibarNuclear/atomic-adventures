# Oklo Aurora Extension — Simulation Spec

[DRAFT] — **Post-game extension**: waste **pyroprocessing** plus an optional **Aurora fast-reactor module**. Unlocked **after Part III** when the campus **Aalo-class SMR is already operational**. Does **not** replace Part III ([nuclear-gen4-simulation.md](nuclear-gen4-simulation.md)).

## Extension purpose

After the trilogy, the player has hydro, PV, and an **open-cycle thermal SMR** online. This extension adds:

```
Sealed wing discovered → restore pyroprocessing → U/TRU fuel → optional Aurora fast module
        (Aalo SMR keeps running on fresh LEU UO₂)
```

Teaches **closed fuel cycle** and **why fast reactors pair with recycling** — extra depth for players who want it, not required to finish the story.

See [Reactor & Extension Catalog](../reactor-catalog.md) for placement in the product line.

## Unlock (draft)

| Requirement | Role |
| ----------- | ---- |
| Part III complete | Trilogy story done |
| `hub.smr_operational` (or equivalent) | **Aalo SMR running** — extension assumes baseload already solved |
| Optional: story beat | Holo-reader or cask discovery foreshadowing recycling wing |

**Does not:** swap Part III reactor model, rewrite elevator threshold, or gate trilogy completion.

## Research references

| Topic | Document |
| ----- | -------- |
| Oklo Aurora reactor + facilities | [oklo-aurora.md](../research/oklo-aurora.md) |
| Electrorefining / pyroprocessing | [pyroprocessing.md](../research/pyroprocessing.md) |
| Sodium coolant (shared with Part III) | [sodium-cooled-reactors.md](../research/sodium-cooled-reactors.md) |
| Part III base SMR | [aalo-atomics.md](../research/aalo-atomics.md) |

## Scope

### In scope (extension)

- **Pyroprocessing line** — simplified **electrorefining** (molten salt bath, U/TRU co-product, fission-product waste stream)
- **Cask pad / hot cell** — spent fuel intake (LWR waste fiction and/or campus legacy casks)
- **Metal fuel fabrication** — U/TRU pins for fast reactor
- **Aurora Powerhouse module** (optional second unit) — pool-type **sodium-cooled fast reactor** consuming recycled **U/TRU** or fresh **HALEU U-Zr**
- **Parallel operation** — **Aalo SMR** continues; load-sharing or lore-only interaction between units

### Out of scope (v1 extension)

- Replacing or retuning Part III Aalo startup chain
- Full PUREX chemistry or commercial oxide dissolution
- NRC/DOE licensing gameplay
- Nuclear Magnate economic loop (separate future game — same catalog)

### Not the same as MSR

**Pyroprocessing** uses molten salt as a **recycling bath**. **Molten salt reactors** use salt as **reactor coolant/fuel** — separate catalog entry (`ext-msr`).

## Calibration targets (Aurora module)

From [oklo-aurora.md](../research/oklo-aurora.md) — **Powerhouse** design, not obsolete 2020 heat-pipe COL.

| Parameter | Target |
| --------- | ------ |
| Electric output | **15 MWe** module (scalable in lore) |
| Spectrum | **Fast** — consumes **U/TRU** from pyro line |
| Coolant | Sodium pool + steam turbine BOP |
| Refuel interval | **10–20 years** (long-life core) |

## Key concepts to teach

### Pyroprocessing (extension core)

| Concept | Simulation element |
| ------- | ------------------ |
| Spent fuel constituents | U, TRU actinides, fission products |
| Electrorefining | Molten salt + current; **U/TRU stay together** |
| Waste reduction narrative | Actinides back to reactor; FPs to disposal |
| Spectrum gate | U/TRU **cannot** fuel the **thermal Aalo SMR** — holo-reader / trip beat |

### Aurora fast module (optional capstone)

| Concept | Simulation element |
| ------- | ------------------ |
| Fast neutrons | Burn TRUs from recycled LWR waste |
| Metallic fuel | Negative feedback; EBR-II lineage |
| Sodium operations | Reuse Part III sodium literacy |
| Closed loop | Discharge → pyro → refabricate → reload |

## Proposed interactions

### Module A — Recycling line (primary extension)

1. **Unlock wing** — restore power and staffing to sealed recycling bay  
2. **Cask intake** — identify fuel types  
3. **Electrorefiner** — route U/TRU vs waste streams  
4. **Fabrication** — metal fuel for fast module  

### Module B — Aurora module (after pyro producing fuel)

1. **Fast reactor startup** — separate from Aalo; uses recycled or HALEU metal fuel  
2. **Parallel ops** — campus load across hydro + PV + Aalo + Aurora (simplified dispatch)  
3. **Closed cycle capstone** — Aurora discharge back to pyro  

**NPC roles:** hot-cell operator, electrochem tech, fast-reactor operator; player supervises key decisions.

## Integration with main trilogy

| Phase | Content |
| ----- | ------- |
| Parts I–II | Foreshadow: cask inventory, actinide holo-reader chapters |
| Part III | **Aalo SMR only**; sealed recycling wing visible but locked |
| **Extension** | SMR operational → unlock wing → pyro → optional Aurora |

## Failure modes (educational)

- **U/TRU loaded into Aalo** — spectrum mismatch; teach thermal vs fast fuel  
- **Wrong pyro stream routing** — co-recovery lesson  
- **Pyro before SMR online** — wing lacks power / staffing (extension gate)  

## Revision notes

- [x] Defined as post-SMR add-on, not Part III replacement (2026-06)  
- [ ] Extension unlock flags and map/building hooks  
- [ ] Challenge ID catalog for pyro + Aurora chains  
- [ ] Dispatch interaction between Aalo and Aurora (sim depth TBD)
