# Nuclear Gen IV Simulation

[DRAFT] — Specification for Part III advanced reactor simulations. **Sodium-cooled liquid-metal microreactor** is the default anchor; see research notes for calibration data.

## Part III Focus — SMR as trilogy climax

Part III is **SMR-centric** **underground**. Zanzibar descends via the hidden elevator (unlocked at the end of Part II) and must:

1. **Discover** a dormant advanced sodium-cooled reactor
2. **Learn** liquid-sodium heat transport, reactivity control, and inherent safety margins
3. **Restore** the reactor with **NPC team support** — operation at this scale is not a solo job
4. **Compare** baseload nuclear to the hydro and PV systems restored in Parts I–II

**Launch calibration candidate:** [Aalo-1 / Aalo-X](../research/aalo-atomics.md) — 30 MWth / 10 MWe, graphite-moderated thermal spectrum, LEU UO₂, pool-type sodium, air-cooled condensers. **Fixed for the trilogy** — not swappable at Part III.

**Post-game extensions** add optional systems after the SMR is running (e.g. [Oklo recycling + fast module](oklo-aurora-extension.md)). See [Reactor & Extension Catalog](../reactor-catalog.md).

## Research references

| Topic | Document |
| ----- | -------- |
| Sodium coolant, pool vs. loop, decay heat, SG boundary | [sodium-cooled-reactors.md](../research/sodium-cooled-reactors.md) |
| Aalo public specs, fuel pivot, systems map | [aalo-atomics.md](../research/aalo-atomics.md) |

## Scope

- **Primary (Part III):** Sodium-cooled **thermal-spectrum** microreactor aligned to Aalo-class design (graphite moderator, LEU UO₂, primary + secondary sodium, steam turbine, air cooling)
- **Post-game extensions:** Additional modules per [reactor-catalog.md](../reactor-catalog.md) — not Part III replacements
- **Out of scope for v1 sim:** Full neutronics codes, detailed fuel performance, licensing documentation

## Sodium vs. molten salt (MSR)

This spec covers **solid fuel + liquid sodium coolant**. **Molten salt reactors** use a different fluid (often fluoride/chloride salts), different corrosion chemistry, and sometimes **liquid fuel** — teach separately if we ship an MSR extension pack. Do not mix MSR mechanics into the default sodium sim.

## Key Concepts to Teach

### All sodium designs (Part III core)

| Concept | Simulation element |
| ------- | ------------------ |
| Liquid sodium coolant | High boiling point → **low pressure** operation; excellent heat transfer |
| Primary / secondary loops | Radioactive primary isolated from **steam generator** by IHX + secondary sodium |
| Sodium-water hazard | Double-wall steam generator; leak detection trips; why water never touches primary sodium |
| Decay heat | Must remove heat after shutdown; **passive circulation** and air-cooled paths (EBR-II heritage) |
| Reactivity control | Control rods; approach to criticality; power ascension in steps |
| Baseload vs. variable renewables | Contrast with Part I hydro dispatch and Part II solar variability |

### Thermal LMR (Aalo default)

| Concept | Simulation element |
| ------- | ------------------ |
| Graphite moderator | **Thermal neutron spectrum** — different from "fast reactor" designs |
| LEU UO₂ fuel | Familiar fuel form; enrichment and supply chain as story/world detail |
| Hybrid loop-pool vessel | Core, pumps, and primary heat exchangers in one sealed sodium tank |
| Load following | Match campus / data-center load — ties to integrated energy portfolio fiction |

### Fast sodium (post-game extension content)

Natrium-class SFR, Oklo Aurora module, etc. — see [reactor-catalog.md](../reactor-catalog.md). Not taught in base Part III.

| Concept | Simulation element |
| ------- | ------------------ |
| No moderator | Fast neutrons; different criticality physics |
| Breeding / fuel cycle | Transmutation, breeding ratio (simplified) |
| Metal vs. oxide fuel | Feedback differences (historical EBR-II tests used metal driver fuel) |

## Calibration targets (Aalo-1 simplified)

Use for "good enough" game numbers — see [aalo-atomics.md](../research/aalo-atomics.md) for sources and caveats.

| Parameter | Target | Player-facing? |
| --------- | ------ | -------------- |
| Thermal power | 30 MWth | Yes (meter) |
| Electrical output | 10 MWe | Yes (campus load) |
| Primary outlet temp | ~550 °C | Yes (gauge) |
| Pressure | Low / atmospheric pool | Optional indicator |
| Fuel | LEU UO₂ (~8% U-235 public claim) | Lore / holo-reader |
| Refuel cycle | 36 months | Late-game / epilogue |
| Module scale | 10 MWe unit; 50 MWe Pod = 5 modules | World layout TBD |

## Proposed Interactions

### Phase 1 — Sodium readiness (non-nuclear or low-power)

1. **Establish circulation** — Primary/secondary sodium flow, cover gas, temperatures in range
2. **Chemistry / purity** — Cold trap and plugging indicators (NPC-assisted maintenance)
3. **Steam boundary check** — Steam generator isolated; double-wall integrity verified

### Phase 2 — Startup

1. **Approach criticality** — Control rod withdrawal in steps; neutron flux indicator rises
2. **Power ascension** — Stepwise thermal power to target; verify temperature feedback stable
3. **Turbine sync** — Steam conditions → generator online → campus bus

### Phase 3 — Operations (with party)

1. **Load management** — Match reactor power to campus demand (hydro + PV + SMR baseload)
2. **Transient response** — Pump trip or load step; observe passive safety margins (simplified)
3. **Shutdown / decay heat** — Scram; player enables or verifies decay-heat removal path

**NPC roles (Part III):** turbine/BOP operator, sodium chemistry, monitoring — player retains supervisor / reactivity / key trip decisions.

## Parameters (Simplified player controls)

- Control rod position (or bank worth)
- Primary sodium flow / pump speed
- Secondary flow / steam pressure setpoint
- Generator load / campus demand allocation
- Decay-heat removal path (when in shutdown scenario)

## Outputs

- Reactor thermal power (MWth)
- Electrical power (MWe)
- Primary/secondary sodium temperatures
- Neutron flux / power level indicator (abstracted)
- Steam pressure and turbine status
- Safety status (trips, SG isolation, sodium leak alarms)

## Failure modes (educational, not punitive)

- **Power mismatch** — Load exceeds generation; teach baseload coordination with hydro/PV
- **SG leak indication** — Trip and isolate; explain sodium-water reaction without graphic catastrophe
- **Insufficient decay-heat removal** — Temperature creep after shutdown; restore passive cooling
- **Sodium plugging / low flow** — Chemistry maintenance required (NPC beat)
- **Overpower transient** — Rod insert; temperature feedback (simplified)

## Post-game extensions

Optional content after Part III SMR is operational — see [Reactor & Extension Catalog](../reactor-catalog.md):

- **[Oklo Aurora + recycling](oklo-aurora-extension.md)** — pyroprocessing + fast module (additive)
- Natrium / SFR, MSR, AP-1000, fusion — catalog placeholders

Base Part III remains **Aalo-class thermal LMR** only.

## Reference Data

- [Aalo Atomics research notes](../research/aalo-atomics.md)
- [Sodium-cooled reactors — general](../research/sodium-cooled-reactors.md)
- IAEA Gen IV reports (conceptual background)
- EBR-II passive safety test program (decay heat teaching)
- [Oklo Aurora extension](../research/oklo-aurora.md) — optional fast reactor + pyroprocessing pack
- [Nuclear AP-1000](nuclear-ap1000-simulation.md) — deferred; PWR comparison optional in holo-readers

## Revision Notes

- [x] Link Aalo research and distinguish thermal LMR vs. fast SFR (2026-06)
- [ ] Pick in-universe reactor name and module count (10 vs. 50 MWe campus fit)
- [ ] Define Part III unlock catalog (mirror part-i-unlocks pattern)
- [ ] Wire challenge IDs and sim component gates
