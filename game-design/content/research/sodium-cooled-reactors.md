# Sodium-Cooled Reactors — Research Notes

[DRAFT] — Background for Part III simulation design. **Not story canon** until folded into [nuclear-gen4-simulation.md](../subject-matter/nuclear-gen4-simulation.md).

## Why sodium?

Liquid **sodium** is used as a reactor coolant because it:

| Property | Engineering consequence |
| -------- | ------------------------ |
| **High boiling point** (~883 °C at 1 atm) | Reactor can run hot while staying **low pressure** (often near atmospheric in pool designs) |
| **High thermal conductivity** | Efficient heat removal; compact cores possible |
| **Low viscosity** (when hot) | Good pumping characteristics; natural circulation feasible |
| **No moderator effect** (sodium itself) | Used in both **fast** reactors (no other moderator) and **thermal** designs (with graphite, etc.) |

Trade-offs the simulation should touch:

- **Reacts violently with water** — hydrogen fire risk if primary/secondary sodium contacts water or steam at a leak
- **Reacts with air** — fire if hot sodium exposed to oxygen; inert cover gas (typically nitrogen or argon) over free surfaces
- **Becomes radioactive** when irradiated — primary sodium is activated; keeps water/steam in a **separate loop** behind heat exchangers
- **Purity management** — oxides and impurities plug small passages; **cold traps** and chemistry control are operational reality

Historical programs with public data useful for teaching: **EBR-II** (pool-type fast reactor, passive safety tests), **FFTF**, **Clinch River**, **Superphénix**, **BN-800/600** (operating). Aalo explicitly cites EBR-II double-wall steam-generator tubes and broader sodium experience (~800 reactor-years globally, per Aalo marketing).

## Pool vs. loop layouts

| Layout | Description | Simulation hook |
| ------ | ----------- | ----------------- |
| **Pool** | Core, primary pumps, and primary heat exchangers sit in a large sodium-filled tank | Large thermal inertia; natural circulation paths; EBR-II, many microreactor concepts |
| **Loop** | Primary sodium piped out of vessel to heat exchangers | More piping, more leak paths; some large SFRs |
| **Hybrid loop-pool** | Sealed tank houses core and primary-side components; still "pool-like" containment | **Aalo-1** — primary vessel integrates core, rods, pumps, and heat exchangers in one tank |

For gameplay, pool/hybrid designs emphasize **passive decay-heat paths** (hot sodium rises, cooler sodium sinks) rather than pressurized emergency injection.

## Typical heat path (three loops)

Most sodium plants separate radioactive sodium from the water/steam side:

```
Core (fission heat)
  → Primary sodium loop (radioactive)
  → Intermediate heat exchanger (IHX)
  → Secondary sodium loop (non-radioactive sodium in many designs)
  → Steam generator (sodium ↔ water/steam, often double-walled tubes)
  → Turbine-generator
  → Condenser / heat rejection
```

**Aalo-X / Aalo-1** follows this pattern: primary sodium in the reactor vessel, **secondary sodium** carries heat to a **sodium-to-steam heat exchanger**, then a **Baker Hughes ~10 MWe turbine** and **air-cooled condensers** (no river cooling required — good fit for a sealed underground campus).

Teaching beat: the **steam generator boundary** is where sodium-water reaction risk is managed (double walls, leak detection, trip logic).

## Fast vs. thermal spectrum (do not conflate)

"Sodium-cooled" does **not** always mean "fast reactor."

| Type | Moderator | Neutron spectrum | Example |
| ---- | --------- | ---------------- | ------- |
| **SFR (sodium-cooled fast reactor)** | None (or minimal) | Fast | Natrium, BN-800, historic EBR-II breeder mission |
| **Thermal sodium reactor** | Graphite (typical) | Thermal | **Aalo-1** (graphite + LEU UO₂) |

Our Part III anchor candidate **Aalo** is a **thermal-spectrum liquid-metal microreactor**, not an SFR. Extension packs could swap in a **Natrium-class fast reactor** with different neutronics teaching (no moderator, breeding, different feedback).

Simulation specs should teach **sodium coolant behavior** for any sodium design; **neutron spectrum** lessons depend on which real design we ship.

## Safety and decay heat (EBR-II lessons)

EBR-II (62.5 MWth pool-type sodium reactor) demonstrated **inherent shutdown** and **passive decay-heat removal** in test programs (Shutdown Heat Removal Tests — SHRT):

1. **Loss of flow** — Core temperature feedback can shut the reactor down without scram in some designs; metal fuels behaved differently from oxide
2. **Natural circulation** — Primary sodium circulation can move decay heat to the pool volume when pumps stop
3. **Heat path to ultimate sink** — Secondary loop → steam system, or dedicated **decay-heat removal** loops (EBR-II used NaK-to-air shutdown coolers when steam path unavailable)
4. **Low pressure** — No LOCA blowdown like a PWR; challenges shift to **sodium fire**, **reactivity transients**, and **long-term decay heat**

Simplified game failure modes (educational):

- **Insufficient decay-heat removal** — temperature rise; player enables passive air cooling path or restores circulation
- **Steam generator leak** — trip reactor; isolate secondary; teach sodium-water hazard without punishing the player
- **Sodium purity / plugging** — reduced flow; cold-trap maintenance (good NPC task in Part III)
- **Load mismatch** — data-center-style **load following** (Aalo mission); tie to campus baseload narrative from Parts I–II

## Control and startup (generic + Aalo-aligned)

Typical power reactor startup phases useful for a game loop:

1. **Cold shutdown** — Rods in; sodium below operating temp; cover gas established
2. **Sodium fill / heat-up** — Circulate sodium; bring to operating temperature with external heating or low-power operation
3. **Approach to criticality** — Withdraw control rods in steps; neutron flux rises; zero-power tests calibrate rod worth (Aalo **Critical Test Reactor** program)
4. **Power ascension** — Stepwise increase to full thermal power; verify flow, temperatures, reactivity margins
5. **Turbine roll / sync** — Steam conditions stable; connect generator to campus load
6. **Sustained operation** — Load following, chemistry, maintenance, refueling window (36-month cycle for Aalo-1 commercial spec)

## Molten salt reactors (MSR) — not the same thing

[nuclear-gen4-simulation.md](../subject-matter/nuclear-gen4-simulation.md) lists MSRs as future extension content. MSRs use **molten salt** as coolant and often as fuel solvent — different chemistry, different hazards (corrosion, freeze plugs, tritium). Do not teach MSR mechanics when running a sodium simulation unless we explicitly swap reactor packs.

## Open questions for simulation design

- [ ] Anchor Part III on **Aalo (thermal sodium)** vs. **Natrium (fast sodium)** vs. abstract "Gen IV SMR"
- [ ] How much neutronics depth (rod worth, k_eff) vs. thermal-hydraulics (flow, temperature, power)
- [ ] Which EBR-II passive-safety scenarios are fair teaching beats without full plant complexity
- [ ] NPC task split: cold traps, BOP turbine, chemistry, fuel handling

## Sources (public)

- [Aalo — Aalo-X](https://www.aalo.com/aalo-x) — product specs, sodium rationale, air cooling, thermal spectrum
- [Aalo — 2026 plan / criticality program](https://www.aalo.com/post/aalos-2026-plan-criticality-and-beyond) — 30 MWth, 10 MWe, UO₂ + graphite, hybrid loop-pool, double-wall SG
- [Aalo — fuel pivot to 8% UO₂](https://www.aalo.com/post/unlocking-hypergrowth-our-bold-move-in-nuclear-fuel)
- [NRC ML24193A003 — Regulatory Plan for Idaho Nuclear Project](https://www.nrc.gov/docs/ML2419/ML24193A003.pdf) — pool-type sodium, safety features (note: fuel section predates UO₂ pivot)
- [IAEA SMR database — Aalo-1](https://smr.nucnet.org/reactor/Aalo-1) — 10 MWe, graphite moderator, 550 °C outlet, 36-month refuel, 80-year life
- EBR-II SHRT / passive safety — [OSTI ML15043A307 (DOE SFR overview)](https://www.nrc.gov/docs/ML1504/ML15043A307.pdf), EBR-II test summaries via OSTI
