# Pyroprocessing — Research Notes

[DRAFT] — Background for the **Oklo Aurora waste-recycling extension pack**. **Not story canon** until folded into [oklo-aurora-extension.md](../subject-matter/oklo-aurora-extension.md).

Electrorefining-based **pyroprocessing** is Oklo’s chosen path to recycle used nuclear fuel into **fast-reactor metallic fuel**. This note covers the process generically; vendor-specific deployment in [oklo-aurora.md](oklo-aurora.md).

## Why recycling appears in the game

Parts I–II teach **open-cycle** electricity (hydro, PV). Part III brings a **thermal SMR** online with fresh fuel. The **Oklo Aurora extension** (post-game) adds pyroprocessing and an optional **fast module** — see [reactor-catalog.md](reactor-catalog.md).

## Used fuel — what is in the cask?

After years in a **light water reactor (LWR)**, fuel assemblies still look like fresh fuel rods, but composition has changed:

| Constituent | Role | Recyclable in fast reactor? |
| ----------- | ---- | --------------------------- |
| **Unused uranium** | Still fissile/fertile | Yes |
| **Transuranic actinides (TRU)** | Plutonium, americium, curium, etc. from neutron capture | Yes — **fast spectrum** fissions many TRUs |
| **Fission products** | Lighter elements from split nuclei | No — waste for disposal |

LWRs are **thermal** reactors: they extract only a small fraction of the fuel’s energy (~2–5% typical utilization). Fast reactors can burn TRUs and access more of the energy content — the educational hook Oklo emphasizes.

## Pyroprocessing vs. aqueous reprocessing (PUREX)

| | **Pyroprocessing (electrorefining)** | **Aqueous reprocessing (e.g. PUREX)** |
| -- | ------------------------------------ | ------------------------------------- |
| **Medium** | Molten salt electrolyte, high temperature | Nitric acid aqueous chemistry |
| **Plutonium** | **U + TRU kept together** — no pure Pu product stream (proliferation-resistance claim) | Can separate pure plutonium |
| **Footprint** | Smaller, fewer steps (Oklo / Argonne claim) | Large chemical plants (La Hague, Rokkasho) |
| **Fuel forms** | Suited to **metallic** fast-reactor fuel; oxide LWR fuel can be adapted | Traditional LWR oxide / MOX paths |
| **U.S. commercial status** | Oklo pursuing first commercial plant (Oak Ridge, early 2030s); **INL Fuel Conditioning Facility** operates for EBR-II material | No U.S. commercial LWR reprocessing today |

For the game: pyroprocessing is **electrochemistry in molten salt**, not the same as the **molten salt reactor (MSR)** coolant/fuel loop — salt here is a **process bath**, not the reactor coolant.

## Electrorefining — simplified process flow

Oklo’s public description (Congress testimony, NRC slides) follows Argonne/INL lineage:

```
Used fuel (oxide from LWRs and/or metallic from Aurora)
        ↓
Prepare for electrorefiner (oxide may need conversion to metal — separate step)
        ↓
Electrorefiner — molten salt, applied voltage
        ↓
┌───────────────────┬────────────────────────────┐
│ U/TRU metal       │ Uranium stream (depleted TRU) │
│ → fast reactor    │ → alternate uses / storage    │
│   fuel fabrication│                               │
└───────────────────┴────────────────────────────┘
        ↓
Fission products + cladding waste → conditioned for disposal
        (smaller volume / shorter radiotoxicity lifetime — company claim)
```

**Teaching points:**

1. **Actinides stay mixed** — no separated weapons-usable plutonium stream in the electrochemical design Oklo describes
2. **U/TRU product** is excellent **fast-reactor fuel** but **cannot** go back into today’s LWR fleet (wrong spectrum)
3. **Not 100% elimination** — fission products still need disposal; recycling **reduces** long-lived actinide burden

## INL Fuel Conditioning Facility (FCF)

Operating precedent Oklo cites:

- Located at **Idaho National Laboratory**
- Uses **electrorefining** on **metallic EBR-II spent fuel**
- Oklo’s **first Aurora-INL core** plans **~5 metric tons HALEU** recovered from EBR-II used fuel via this technology chain
- **Aurora Fuel Fabrication Facility (A3F)** at INL — fabricates metal fuel for Aurora Powerhouse (DOE authorization path)

Game fiction: campus underground could include a **dormant recycling line** analogous to FCF + A3F, restored in the extension.

## Oak Ridge Advanced Fuel Center (commercial scale)

Oklo’s **privately funded** recycling campus (announced 2025):

- **Oak Ridge, Tennessee** — East Tennessee Technology Park (~248 acres)
- Up to **$1.68B** investment; **800+ jobs** (company figures)
- **First U.S. commercial electrorefining plant** (company claim); production target **early 2030s** after NRC licensing
- Feedstock plan: **LWR used fuel** first, then **Aurora spent fuel**
- TVA exploring recycling utility spent fuel at the site

## Simulation hooks (extension pack)

Simplified gameplay loop — not a full fuel-cycle simulator:

| Stage | Player learns | Game mechanic (draft) |
| ----- | ------------- | --------------------- |
| **Inventory casks** | What’s in spent fuel | Inspect cask / holo-reader |
| **Acceptance & prep** | Fuel form matters (oxide vs metal) | Sort / prep mini-step |
| **Electrorefiner** | U/TRU vs waste streams | Adjust current, monitor streams; keep U+TRU together |
| **Fuel fabrication** | Metal alloy, cladding | Fabricate pins for Aurora core |
| **Reactor reload** | Closed cycle | Load recycled fuel; contrast with fresh HALEU economics (lore) |

**Failure modes (educational):** wrong stream routing; overheated salt pot; attempting to use U/TRU in thermal reactor (story beat explaining spectrum mismatch).

## Story integration (extension)

- Unlocks **after Part III** when the **Aalo SMR is operational** — restore sealed recycling wing on campus  
- **Aalo keeps running**; Aurora fast module is an **additional** unit for U/TRU fuel  
- Reinforces DoE campus fiction: full fuel-cycle demo was always here, dormant until the team can operate it

## Open questions

- [ ] Extension unlock: `hub.smr_operational` + wing restoration beats
- [ ] How much LWR cask lore vs. in-universe Aurora-only recycling
- [ ] Regulatory/education tone for TRU and proliferation resistance (keep factual, not polemical)

## Sources

- [Oklo CEO testimony — spent fuel & electrorefining (Congress, Apr 2024)](https://www.congress.gov/118/meeting/house/117113/documents/HHRG-118-IF03-20240410-SD095.pdf)
- [Oklo NRC slides — pyroprocessing overview (Dec 2024)](https://www.nrc.gov/docs/ML2433/ML24331A245.pdf)
- [Oklo — Oak Ridge fuel recycling](https://oklo.com/fuel-recycling/tennessee/default.aspx)
- [DOE EM — Oak Ridge Oklo investment](https://www.energy.gov/em/articles/em-cleanup-paves-way-17-billion-energy-investment-oak-ridge)
- Argonne/INL Fuel Conditioning Facility — via Oklo and ANS coverage
