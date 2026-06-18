# Technology Roadmap

[DRAFT] — Phasing and dependencies for design and implementation.

## Design Phase (Current)

| Milestone | Deliverables |
|-----------|--------------|
| Story complete | `story-overview.md` with full beats |
| Simulation specs | All tech specs with parameters, outputs |
| Learning map | Objectives aligned to story and simulations |
| Art direction | Style guide, concept art |
| Playable prototype | TBD — one simulation (e.g., hydro) |

## Tech Stack Decision

**Bespoke web-native CYOA engine built with Vue 3 + Vite.**

Ren'Py, Twine, and Unity were evaluated and rejected. The sibling mini-game projects (crazy-converter = Nuxt 3, isotope-explorer = Vue 3 + Rust/WASM) are web apps. A Vue 3 adventure frame lets them embed directly — no runtime bridging needed.

Key components:
- **Story engine** — Interprets a declarative passage graph (JSON/YAML) with choices, conditions, flags, and simulation gates
- **Simulation UIs** — Vue components for each technology (hydro, PV, nuclear, fusion)
- **Mini-game integration** — crazy-converter and isotope-explorer embed as components or iframes
- **State management** — Vue composables; save/load for player progress

See [Next Steps Plan](../../docs/next-steps-plan.md#6-tech-stack--scaffold--decided) for full architecture diagram.

## Prose rendering

Story beat text (`game/content/story/`) is rendered in the narrative card. **Today:** `proseParagraphs()` in `game/src/lib/prose.js` normalizes YAML block scalars — single newlines become spaces; blank lines become paragraph breaks.

**Planned:** add `renderProse()` as a **remark/rehype pipeline** in the same module (or adjacent), used by `NarrativeCard` and eventually choice labels. Stay on Vue 3 + Vite; no framework switch for rich text.

**Incremental path:**

| Step | Scope | Notes |
| ---- | ----- | ----- |
| Now | Paragraph normalization | `proseParagraphs()` — done |
| Next | Inline emphasis | `**bold**`, `*italic*`, `<u>underline</u>` via remark parse + sanitize |
| Later | Block Markdown | Lists, blockquotes, code in beat `text:` / `revisit:` |
| With wiki | Math & components | `remark-math` / KaTeX; MDC-style custom blocks for callouts |
| Shared | Document panel | Same `renderProse()` (or shared plugin set) for wiki-sourced artifacts |

**Design rules:**

- **Metadata** (triggers, choices, flags) stays in YAML; **body** prose can contain Markdown.
- Sanitize HTML output even for author-controlled content.
- Document the supported Markdown subset in [story-data-format.md](../design/content/story/story-data-format.md) when `renderProse()` lands.

The technical documentation wiki (below) can reuse this pipeline so in-game narrative and artifact panels render consistently.

## Implementation Phases (Future)

### Phase 1: Foundation

- Vue 3 + Vite project scaffold
- Story engine (passage renderer, choice handler, state/save-load)
- Story data format (JSON/YAML passage schema with gate conditions)
- First chapter (Hydro) — story, simulation, learning
- Integration contract for mini-games (events, result passing)

### Phase 2: Expansion

- PV chapter
- AP-1000 chapter
- Embed isotope-explorer as nuclear mini-game
- Embed crazy-converter as utility mini-game
- Improved simulation engine
- **Technical documentation wiki** (see below) — in-game artifact panel for manuals and reference material

### Phase 3: Advanced

- Gen IV chapter
- Fusion chapter
- Polish, accessibility, localization

### Phase 4: Living Game

- New Gen IV reactors as they come online
- Community content? Modding?
- Updates based on real-world tech news

## Technical documentation wiki

In-game artifacts (operations manuals, schematics, reference sheets) need **full rich text**: lists, blockquotes, math, diagrams, and styled callouts. That is a different problem from **story beats** (`game/content/story/`) and **world data** (`game/content/world/`).

**Do not migrate the playable `game/` app to Nuxt for this.** The game stays Vue 3 + Vite with its bespoke CYOA engine, maps, save/load, and simulation embeds. Rich narrative in story beats grows via `renderProse()` (remark/rehype — see [Prose rendering](#prose-rendering)).

**Separate wiki app** for technical documentation:

| Concern | Wiki (authoring site) | Game runtime |
| ------- | --------------------- | ------------ |
| Purpose | Author and maintain technical docs, lore, operator manuals | Play, explore, trigger story, run sims |
| Stack candidate | Nuxt 3 + Content module (MD/MDC, math, components) | Vue 3 + Vite (unchanged) |
| Content | Markdown collections with frontmatter (tags, facility, version) | YAML beats + world; artifact **references** by id |
| Delivery | Build-time or API export of parsed HTML/JSON | Custom **document panel** in game UI |

**Integration model (target):**

1. Wiki authors write docs as Markdown (e.g. `hydro/ops-manual.md`, `hub/e-buggy-spec.md`).
2. Build or sync step publishes a **manifest + rendered bodies** (static JSON bundle, or thin read API).
3. Story and world YAML reference artifacts by id — e.g. picking up a manual sets `documents.hydro.ops-manual` or adds an inventory item linked to `doc:hydro/ops-manual`.
4. Game UI opens a **document panel** (not the narrative card): scrollable, styled prose, optional search within the doc. Same panel can list “Documents found” from player state.

**Why split:**

- World YAML stays structured spatial/game data; story YAML stays triggers/choices/flags.
- Wiki tooling (collections, preview, math, MDC components) does not entangle with map hot-reload or `useStory`.
- Docs can be updated or extended without shipping a full game release if served from API later.

**Open decisions (when scoped):**

- Static bundle in game build vs. hosted wiki API
- Shared remark/MDC component set between wiki preview and in-game panel renderer (align with `renderProse()`)
- Localization and versioning for facility-specific manual revisions

## Dependencies

- **Story** → Drives simulation requirements
- **Learning objectives** → Drive puzzle and gate design
- **Simulation specs** → Drive implementation scope
- **Art** → Can proceed in parallel with design
- **Mini-game projects** → Must define integration contract (Phase 1) before embedding (Phase 2)
- **Prose rendering** → `renderProse()` remark pipeline; narrative card now, document panel with wiki (Phase 2+)
- **Technical wiki** → Artifact ids in story/world YAML; document panel in game UI (Phase 2+)

## Real-World Tech Tracking

Gen IV and fusion are evolving. Maintain a watch list:

- **Natrium (TerraPower)** — Sodium-cooled; construction timeline
- **Kairos (TerraPower)** — Molten chloride
- **X-Energy Xe-100** — HTGR
- **ITER** — Fusion; first plasma, etc.
- *Add as new designs emerge*

## Revision Notes

- *Refine phases as design solidifies*
- *Set target dates when ready*
