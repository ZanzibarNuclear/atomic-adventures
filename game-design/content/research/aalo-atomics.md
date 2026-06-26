# Aalo Atomics — Research Notes

[DRAFT] — Real-world reference for Part III SMR simulation calibration. **Not story canon** until folded into [nuclear-gen4-simulation.md](../subject-matter/nuclear-gen4-simulation.md).

Aalo Atomics (Austin, TX; founded 2023) is building **extra-modular reactors (XMR)** — factory-fabricated **sodium-cooled, graphite-moderated, thermal-spectrum** microreactors aimed at **AI data-center power**. Their near-term path is **DOE-authorized experimental operation at Idaho National Laboratory**, not full NRC commercial license for Aalo-X.

## Product line (as publicized)

| Name | Role | Power (public) | Notes |
| ---- | ---- | -------------- | ----- |
| **Aalo-X** | Experimental pilot at INL | **30 MWth → 10 MWe** | Proves unit cell for commercial Pod; targets **criticality July 4, 2026** (DOE Test Reactor Pilot Program); powers experimental co-located data center |
| **Aalo-1** | Commercial module | **30 MWth → 10 MWe** per module | Factory-built; same technology as Aalo-X after qualification |
| **Aalo Pod** | Commercial plant | **50 MWe standard** (5 × Aalo-1 modules, shared turbine/BOP) | Also described: single 10 MWe module up to **200 MWe** multi-unit stations; **100 MWe** flagship (10 modules) in NRC regulatory plan |
| **Aalo-0** | Non-nuclear integral test | Full-scale sodium, no fuel | ~60,000 lb flowing sodium at operating conditions; thermal-hydraulic qualification |
| **CTR** | Critical Test Reactor | Zero-power (~watts–kW) | In-house critical facility for rod worth, flux mapping, reactivity insertion tests before Aalo-X power startup |
| **Sodium Test Loop (STL)** | Component test loop | Non-nuclear | Heat exchangers, cold traps, plugging meters, I&C at temperature |

**Designation note:** IAEA/SMR database lists **Aalo-1 (Aalo-X)** as one design entry — pilot reactor is the Aalo-X demonstrator of the Aalo-1 product.

## Core design parameters (for simulation calibration)

Values below are **public marketing / regulatory / database figures** — use as simplified game targets, not engineering guarantees.

| Parameter | Value | Confidence |
| --------- | ----- | ------------ |
| **Reactor type** | Pool-type **liquid metal reactor (LMR)**; **hybrid loop-pool** primary vessel | High (Aalo, NRC plan) |
| **Neutron spectrum** | **Thermal** (graphite moderator in core) | High (Aalo 2026 blog, IAEA SMR DB) |
| **Primary coolant** | Sodium | High |
| **Secondary coolant** | Sodium (non-radioactive loop to steam generator) | High (Aalo 2026 blog) |
| **Thermal power** | **30 MWth** | High |
| **Electric power** | **10 MWe** (~33% thermal efficiency — game-derived) | High |
| **Reactor outlet temperature** | **550 °C** | Medium (IAEA SMR DB; confirm against final design) |
| **Operating pressure** | **Low / non-pressurized** pool | High (NRC plan: "non-pressurized, pool-type") |
| **Fuel (current)** | **LEU UO₂ pellets** — company describes **8% U-235** enrichment for supply-chain scale; Aalo-X blog also says **≤5%** LEU with graphite | Medium — **fuel form changed** (see below) |
| **Fuel cycle** | **Once-through** | High (IAEA SMR DB) |
| **Refueling interval** | **36 months** (commercial Aalo-1) | Medium (IAEA SMR DB) |
| **Design lifetime** | **80 years** | Medium (IAEA SMR DB) |
| **Heat rejection** | **Air-cooled condensers**; no external water source required | High (Aalo-X pages, Public Power article) |
| **Steam generator** | Sodium-to-steam HX; **double-walled tubes** (EBR-II heritage) | High (Aalo 2026 blog) |
| **Turbine** | **Baker Hughes 10 MWe** steam turbine-generator set (Aalo-X) | High (press release, Mar 2026) |
| **Site** | **INL** — adjacent to Materials and Fuels Complex (Aalo-X) | High |

### Fuel evolution (important for story + sim)

Aalo **pivoted fuel strategy** for speed and supply chain:

| Phase | Fuel | Rationale (company) |
| ----- | ---- | ------------------- |
| Early / MARVEL-inspired | **U-Zr-H** (uranium zirconium hydride) | Strong negative feedback; aligned with INL MARVEL microreactor lineage |
| **Current commercial path** | **8% enriched UO₂** | "No unobtanium" — existing enrichment, conversion, fabrication infrastructure |

Partnerships on current path:

- **Urenco USA** — LEU supply (UF₆)
- **Global Nuclear Fuel (GNF)** — fabricated fuel rods/assemblies for **Aalo-X** (delivery early 2026)

The [NRC Regulatory Plan (ML24193A003)](https://www.nrc.gov/docs/ML2419/ML24193A003.pdf) still describes **U-Zr-H** and **LEU+** — treat as **pre-pivot documentation**; game should default to **UO₂ + graphite** unless we deliberately set the story in the earlier design era.

## MARVEL lineage

Aalo's reactor development is **inspired by INL's MARVEL** microreactor (100 kWth, U-Zr-H, sodium heat pipes / integrated design — DOE microreactor program). Aalo planned to combine MARVEL neutronics test data with full-scale non-nuclear rigs. For narrative: the campus underground SMR can plausibly be a **near-future DoE research installation** in the same family as MARVEL/Aalo without naming Aalo in-universe.

## Systems map (simplified for gameplay)

```
[Graphite-moderated core + LEU UO₂ fuel + control rods]
        ↓ primary sodium (in vessel)
[Primary pumps / natural circulation]
        ↓
[Intermediate heat exchanger — inside or integrated with vessel]
        ↓ secondary sodium (non-radioactive)
[Sodium-to-steam generator — double-walled tubes]
        ↓ steam
[10 MWe turbine-generator] → campus / data-center load
        ↓
[Air-cooled condensers]
```

**Auxiliary systems** worth modeling lightly:

- Cover gas / sodium chemistry (**cold traps**, plugging meters)
- **Reactivity control & protection** — custom digital I&C; redundant shutdown
- **Decay-heat removal** — passive natural circulation + air cooling (Aalo-X testing objectives)
- **Fuel handling / refueling** — factory and on-site refuel strategy; 36-month commercial cycle

## Operating narrative (Aalo-X test program)

Public schedule concepts useful for Part III beat structure:

1. **Non-nuclear commissioning** — sodium fill, inert purge, circulation tests (Aalo-0 / STL precede this)
2. **Fuel load** — UO₂ assemblies + graphite moderator matrix in vessel
3. **Zero-power criticality** — CTR experiments precede; rod calibration, flux mapping
4. **Criticality → power ascension** — stepwise to **30 MWth**; includes **100-hour full-power endurance** goal
5. **Grid / load sync** — turbine-generator; **load-following** experiments for data-center duty
6. **Extended run / burnup** — months of operation; fuel performance data; optional refueling demonstration

Part III **party reunion** aligns with real ops needs: Aalo trains **ex-Navy nuclear operators** alongside engineers; sodium chemistry, BOP, and control-room roles can map to NPCs while the player runs core reactivity and plant supervisor decisions.

## Safety teaching hooks (Aalo-specific)

- **Low pressure + high temperature** — sodium enables both; contrast with PWR Part-III player memory of hydro pressure (penstock) and PV (no thermal fuel)
- **Double-wall steam generator** — engineered barrier for sodium-water reaction; trip on leak detection
- **Air cooling** — fits underground/sealed campus without river dependency (matches our Maine facility fiction)
- **Thermal spectrum + UO₂** — more familiar fuel form to players than metallic fast-reactor fuel; good for education
- **Negative feedback** — still teachable via temperature/doppler mechanisms; less dramatic than U-Zr-H intrinsic safety claims

## Deployment claims (context only)

- **Commercial Pods ~2030** (company timeline; subject to licensing and construction reality)
- **Small footprint**, colocated with load — aligns with campus underground + surface hydro/PV fiction
- **Factory "Gigawatt Factory"** — modular shipment; parallels Myst restoration fantasy (dormant but intact)

## Implications for `nuclear-gen4-simulation.md`

1. **Rename teaching scope** from "SFR only" to **sodium-cooled reactors** with Aalo as default **thermal LMR** anchor.
2. **Remove "no moderator"** as universal rule — Aalo uses **graphite**.
3. **Extension pack:** Natrium / SFR as post-game add-on — see [reactor-catalog.md](reactor-catalog.md).
4. **Sim parameters** — start with table above; 3–5 player-facing controls (rod position, primary flow, secondary flow / steam pressure, load setpoint, decay-heat path).
5. **Molten salt** remains a **separate** future pack — not Aalo.

## Open questions

- [ ] In-universe reactor name vs. real Aalo licensing (fictionalize vs. educational partnership framing)
- [ ] Whether campus SMR is **one Aalo-1 module (10 MWe)** or **Pod-scale (50 MWe)** — affects load-matching with Part I hydro + Part II PV
- [ ] How much of CTR/zero-power startup to gamify vs. skip to approach-criticality
- [ ] Update regulatory-plan citations when NRC docs reflect UO₂ pivot

## Sources

- [Aalo-X product page](https://www.aalo.com/aalo-x)
- [Aalo's 2026 Plan: Criticality and Beyond](https://www.aalo.com/post/aalos-2026-plan-criticality-and-beyond) (Feb 2026)
- [Unlocking Hypergrowth: fuel pivot to 8% UO₂](https://www.aalo.com/post/unlocking-hypergrowth-our-bold-move-in-nuclear-fuel)
- [Aalo + MARVEL announcement](https://www.aalo.com/post/aalo-atomics-to-build-a-commercial-reactor-inspired-by-marvel)
- [GNF fuel fabrication contract](https://www.businesswire.com/news/home/20260303295968/en/Aalo-Atomics-Signs-Contract-to-Secure-Fabricated-Fuel-Rods-From-Global-Nuclear-Fuel) (Mar 2026)
- [American Public Power — Aalo-X groundbreaking](https://www.publicpower.org/periodical/article/aalo-atomics-breaks-ground-experimental-modular-nuclear-reactor-secures-funding)
- [IAEA SMR database — Aalo-1](https://smr.nucnet.org/reactor/Aalo-1)
- [NRC ML24193A003 — Regulatory Plan](https://www.nrc.gov/docs/ML2419/ML24193A003.pdf)
