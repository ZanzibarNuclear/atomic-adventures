# Oklo Aurora — Research Notes

[DRAFT] — Real-world reference for the **post-game Oklo extension** (pyroprocessing + optional Aurora fast module). **Not story canon** until folded into [oklo-aurora-extension.md](../subject-matter/oklo-aurora-extension.md). **Does not replace** Part III [Aalo-1](aalo-atomics.md).

Oklo Inc. (Santa Clara, CA) develops **Aurora Powerhouse** — a **sodium-cooled, fast-spectrum, metal-fueled** microreactor line — and a **vertically integrated fuel cycle** including **pyroprocessing** to recycle used nuclear fuel into **U/TRU metallic fuel**. This is a different teaching profile from [Aalo-1](aalo-atomics.md) (thermal-spectrum sodium LMR, fresh LEU UO₂).

## Product line (as publicized)

| Name | Role | Power (public) | Notes |
| ---- | ---- | -------------- | ----- |
| **Aurora (original concept)** | 2020 COL application | **~4 MWth / 1.5 MWe** | Heat pipes + **sCO₂** Brayton; underground module; **NRC denied COL Jan 2022** (insufficient information) — historical, not current Powerhouse |
| **Aurora Powerhouse / Aurora-INL** | First commercial deployment | **15 MWe** initial; **up to 75 MWe** (NRC pre-app); company also cites **50 MWe** and **100 MWe** variants | **EBR-II-derived** pool sodium fast reactor; **steam turbine** (Siemens Energy SST-600 class); INL site; target **~2027** operation |
| **Aurora Fuel Fabrication (A3F)** | INL fuel plant | — | Fabricates **metal fuel**; **HALEU from recycled EBR-II spent fuel** (~5 t planned); DOE authorization path |
| **Advanced Fuel Center** | Oak Ridge, TN | — | **$1.68B** campus; commercial **pyroprocessing** + fabrication; **early 2030s** production target |

Oklo brands reactors as **“powerhouses”** — integrated plant modules, often depicted **underground** with community-facing design.

## Design evolution (read before calibrating the sim)

Oklo’s design **changed substantially** after the 2022 COL denial:

| Era | Coolant / heat transport | Power conversion | Spectrum / fuel |
| --- | ------------------------ | ---------------- | --------------- |
| **2019–2020 microreactor** | Potassium **heat pipes** | **Supercritical CO₂** | Fast; **HALEU U-Zr metal** |
| **Aurora Powerhouse (current)** | **Liquid sodium pool** + intermediate loop (EBR-II lineage) | **Steam turbine** (Siemens) | Fast; **HALEU U-Zr** or **recycled U/TRU** |

Extension pack and any “underground fast reactor” fiction should use the **Powerhouse / EBR-II sodium pool** model, not the obsolete heat-pipe COL design — unless we deliberately set a story beat in the abandoned first-generation module.

## Core reactor parameters (Powerhouse — simplified calibration)

Public figures vary by year and variant; use as **game targets**, not licensing values.

| Parameter | Value | Confidence |
| --------- | ----- | ---------- |
| **Reactor type** | **Pool-type sodium-cooled fast reactor (SFR)** | High (NRC pre-app, Oklo) |
| **Neutron spectrum** | **Fast** | High |
| **Coolant** | **Liquid sodium** (primary; intermediate sodium loop to steam generator in current architecture) | High |
| **Electric output** | **15 MWe** (first unit); scalable **50–75 MWe** (and higher in company materials) | Medium — confirm variant for campus fit |
| **Operating temperature** | **450 °C+** (ND legislative briefing slide) | Medium |
| **Operating pressure** | **Atmospheric / low pressure** pool | High |
| **Fuel — fresh** | **Metallic U-Zr alloy**, **HALEU** up to **19.75% U-235** | High |
| **Fuel — recycled** | **U/TRU mixture** from pyroprocessing (U + transuranic actinides together) | High (Oklo testimony) |
| **Refueling interval** | **10–20 years** without refuel (company materials; “decades” in early Aurora marketing) | Medium |
| **Containment** | **Underground**, multi-layer / cask-like module | High (early COL; powerhouse renderings) |
| **Safety** | **Inherent + passive** — negative feedback (especially with metal fuel); EBR-II SHRT heritage | High |
| **Power conversion** | **Steam Rankine** (Siemens turbine) in current commercial path | High |
| **Cooling water** | Designed to operate **without large external water sources** for ultimate heat rejection in some variants (air/dry cooling themes in microreactor era — confirm for Powerhouse BOP) | Medium |
| **Design life / license** | **40+ years** (ND briefing) | Medium |
| **EBR-II heritage** | Same INL site; first core fuel from **recycled EBR-II spent fuel** | High |

### Metal fuel teaching points (IFR / EBR-II lineage)

| Property | Why it matters in-game |
| -------- | ---------------------- |
| **High thermal conductivity** | Easier heat removal from fuel pins |
| **Negative reactivity feedback** | Core tends to self-limit power transients |
| **Compatible with pyroprocessing** | Recycled **U/TRU metal** can return to fabrication |
| **Fast spectrum** | Burns **transuranics** that LWRs leave behind |

Early fuel spec in National Academies briefing: **U-10Zr** in **SS-316 cladding**, enrichment to **19.75%**, discharge burnup targets increasing over product generations.

### Control (design-dependent)

Original microreactor concept: **rotating reflector drums** + **gravity-aided shutdown rods**. Powerhouse details in public NRC white papers — treat control as **shutdown margin + reactivity control** abstractions in v1 sim unless we license deeper detail.

## Waste recycling — Oklo’s fuel cycle

Oklo’s extension differentiator is **closed cycle**, not just reactor ops.

### Feedstock plan (public)

1. **Near term:** **EBR-II spent fuel** at INL → electrorefining → **HALEU** for first Aurora-INL core  
2. **Commercial scale:** **LWR used fuel** (oxide) from U.S. fleet → pyroprocess → **U/TRU** metal for Aurora  
3. **Later:** Aurora’s **own discharged fuel** recycled at Oak Ridge

See [pyroprocessing.md](pyroprocessing.md) for process teaching.

### Why fast reactors for recycled fuel

- **Thermal LWRs** cannot use U/TRU mix as drop-in fuel  
- **Fast neutrons** fission **transuranic actinides** that accumulate in spent LWR fuel  
- Oklo claims: deeper burn, less fresh uranium, **smaller disposal volume** and **shorter toxicity lifetime** for remaining waste (company / industry advocacy — present as engineering goal, not guaranteed outcome in sim)

### Facility map (real world → game fiction)

```
[LWR spent fuel casks / EBR-II legacy material]
        ↓
[Pyroprocessing plant — electrorefiner in molten salt]
        ↓
[Metal fuel fabrication — U/TRU or HALEU U-Zr]
        ↓
[Aurora Powerhouse fast reactor]
        ↓
[Electricity to campus / data center]
        ↓
(Eventually) discharged Aurora fuel → back to pyroplant
```

Campus extension: add a **recycling bay** wing (Oak Ridge / FCF analog) connected to the Part III underground powerhouse.

## Licensing and status (context)

| Milestone | Status (public, 2025–2026) |
| --------- | --------------------------- |
| **2020 COL application (1.5 MWe concept)** | **Denied** Jan 2022; resumed **pre-application** for Powerhouse |
| **NRC pre-application (Aurora Powerhouse)** | Active — docket **99902095**; readiness assessment for combined license |
| **DOE site use permit (INL)** | Granted **2019** |
| **Aurora-INL construction** | Ground broken; environmental reviews completed (2024–2025 reporting) |
| **Recycling facility NRC engagement** | **Pre-application** (Dec 2024 public meeting on security / material categorization) |
| **Oak Ridge recycling plant** | Announced **Sep 2025**; production **early 2030s** |

Game fiction can ignore licensing delays; real-world status explains why specs are still moving.

## Comparison: Aurora extension vs. Part III SMR (Aalo)

| | **Part III (Aalo-class)** | **Oklo extension (additive)** |
| -- | ------------------------- | ------------------------------ |
| When | Trilogy climax | **After SMR operational** |
| Spectrum | **Thermal** (graphite) | **Fast** (Aurora module) |
| Fuel | **LEU UO₂** | **HALEU U-Zr** or **recycled U/TRU** |
| Unique loop | Baseload after hydro + PV | **Spent fuel → pyro → fast reactor** |
| Relationship | Required story | **Optional**; Aalo **continues running** |

## Systems map (Powerhouse — simplified)

```
[Metallic fast-reactor core — HALEU or U/TRU]
        ↓ primary sodium (pool)
[Intermediate sodium loop]
        ↓
[Sodium-to-steam generator — double-wall heritage from EBR-II family]
        ↓ steam
[Siemens steam turbine-generator] → campus load
        ↓
[Condenser / heat rejection]
```

**Extension add-on:**

```
[Spent fuel storage / cask pad]
        ↓
[Electrorefiner + salt process cells]
        ↓
[Metal fuel fabrication]
        ↓ feeds core reload
```

## Operating narrative (extension beats)

1. **Discover casks** — LWR waste or legacy DoE fuel stored at campus  
2. **Restore pyro line** — molten salt electrochemistry, stream routing (U/TRU vs waste)  
3. **Fabricate metal fuel** — alloy, cladding, quality checks  
4. **Fast reactor startup** — different neutronics briefing than Aalo (no graphite moderator)  
5. **Closed cycle** — discharge fuel routed back; contrast open cycle economics in holo-reader  

NPC roles: recycling technician, fuel fabricator, reactor operator, health physics — extends Part III team concept.

## Safety teaching hooks (Aurora-specific)

- **Metal fuel negative feedback** — contrast with player’s Part I/II experience (no meltdown fear-mongering; teach real feedback physics)  
- **Sodium + steam boundary** — same SG isolation lessons as [sodium-cooled-reactors.md](sodium-cooled-reactors.md)  
- **Fast reactor transients** — different reactivity coefficients than thermal designs  
- **Recycling hazards** — hot cell / remote handling, molten salt, radiological controls (simplified)  
- **Proliferation resistance narrative** — U/TRU co-recovery vs pure plutonium separation (factual description from Oklo/NRC materials)

## Implications for extension sim spec

1. **Two linked sims or one sim with two tabs:** pyroprocessing + fast reactor  
2. **Teach spectrum explicitly** — why LWR waste needs a **fast** receiver  
3. **Do not conflate** pyroprocessing molten salt with MSR reactor coolant  
4. **Power numbers:** default **15 MWe** module for campus scale unless we upscale  
5. **Fuel flags:** `fuel.haleu` vs `fuel.u-tru-recycled` affecting lore and unlock paths

## Open questions

- [ ] In-universe name for recycling wing vs. Aurora module  
- [ ] Campus load dispatch between Aalo and Aurora (sim depth)  
- [ ] How much oxide-to-metal conversion to show vs abstract  
- [ ] Catalog entry for Nuclear Magnate reuse — [reactor-catalog.md](reactor-catalog.md)

## Sources

- [NRC — Aurora Powerhouse pre-application](https://www.nrc.gov/reactors/new-reactors/advanced/who-were-working-with/pre-application-activities/okla-aurora-powerhouse.html)
- [NRC — 2020 Aurora COL (denied; historical 1.5 MWe specs)](https://www.nrc.gov/reactors/new-reactors/large-lwr/col/aurora-oklo)
- [Oklo — Aurora announcement (2019 concept)](https://oklo.com/newsroom/news-details/2019/Oklo-Announces-its-Aurora-Advanced-Fission-Clean-Energy-Plant/default.aspx)
- [Oklo — Oak Ridge Advanced Fuel Center (2025)](https://oklo.com/newsroom/news-details/2025/Oklo-Announces-Fuel-Recycling-Facility-as-First-Phase-of-up-to-1-68-Billion-Advanced-Fuel-Center-in-Tennessee/default.aspx)
- [Oklo — Oak Ridge recycling page](https://oklo.com/fuel-recycling/tennessee/default.aspx)
- [Oklo CEO testimony — electrorefining, U/TRU (Apr 2024)](https://www.congress.gov/118/meeting/house/117113/documents/HHRG-118-IF03-20240410-SD095.pdf)
- [Oklo NRC — pyroprocessing & recycling facility slides (Dec 2024)](https://www.nrc.gov/docs/ML2433/ML24331A245.pdf)
- [POWER — Aurora-INL / recycling groundbreaking](https://www.powermag.com/oklo-breaks-ground-on-inl-nuclear-fast-reactor-project-launches-private-fuel-recycling-facility/)
- [IAEA SMR database — Aurora](https://smr.nucnet.org/reactor/aurora) — fast LMR, 1.5–75 MWe, metallic U-Zr, HALEU
- [Pyroprocessing notes (this repo)](pyroprocessing.md)
- [Sodium-cooled reactors — general (this repo)](sodium-cooled-reactors.md)
