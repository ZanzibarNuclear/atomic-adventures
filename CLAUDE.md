# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atomic Adventures is an educational adventure game where players explore electricity production technologies through story-driven discovery and simulation. Players restore dormant energy facilities in a Myst-inspired world, learning real physics and engineering to progress.

**Current phase:** Design & Planning (pre-implementation). No code yet — the repo contains design documentation only.

## Architecture Decision

**Bespoke web-native CYOA engine built with Vue 3 + Vite.**

Ren'Py, Twine, and Unity were evaluated and rejected. The sibling mini-game projects are web apps (Vue 3, Nuxt 3), so a web-native adventure frame lets them embed directly.

```
Story Engine (Vue 3)
├── Passage graph interpreter (YAML data files)
├── State manager (flags, items, documents, sim results)
├── Save/load (JSON serialization)
├── Simulation gates (pass/fail → branch)
├── Built-in sims (hydro, PV, nuclear, fusion as Vue components)
└── Mini-game embeds
    ├── isotope-explorer (Vue component)
    └── crazy-converter (iframe)
```

## Story Data Format

Story content lives in YAML files, one per area. See `design/content/story/story-data-format.md` for the full schema. Key concepts:

- **Passages** — Text + image + choices. The atomic unit.
- **Conditions** — `require: { all: [...], not: [...], items: [...] }`
- **Flags** — Dot-scoped booleans: `hydro.read_ops_manual`
- **Simulation gates** — Passage launches sim, gates on success/failure
- **Area transitions** — `go_to: hydro:arrival` (area:passage syntax)
- **Passage IDs** — kebab-case, unique within area
- **Item IDs** — flat kebab-case

## Directory Structure

```
design/
  docs/               — Game design overview, narrative design
  content/
    story/            — Story overview, world/style guide, data format spec
    subject-matter/   — Simulation specs (hydro, PV, AP-1000, Gen IV, fusion)
    learning-objectives.md
    progression-design.md
    art/              — Placeholder for visual assets
docs/
  next-steps-plan.md  — Roadmap with checkboxes
  tech-roadmap.md     — Implementation phases and dependencies
  project-structure.md
```

## Sibling Projects

These will embed as mini-games within the adventure:

- **`../crazy-converter/`** — Nuxt 3 + FastAPI + Rust/PyO3. Unit conversion tool. Embeds via iframe.
- **`../isotope-explorer/`** — Vue 3 + Rust/WASM. Nuclear simulation. Embeds as Vue component.

## World & Tone

- **Setting:** Future where energy technology has been lost. Infrastructure remains, knowledge is gone.
- **Inspiration:** Myst (atmosphere, exploration) + Tintin (protagonist personality)
- **Protagonist:** Zanzibar Nuhero — see `design/content/story/characters.md`
- **Story structure:** Part I (several weeks, surface — hydro operations) → Part II (below); Part I ends with a hidden elevator (hydro gate)
- **Core message:** Hopeful. Technology exists to help people thrive.

## Core Loop

Explore → Encounter Problem → Learn Concept → Apply in Simulation → Unlock Story → Repeat

## Level Order

1. Hydroelectric plant (most intuitive)
2. PWR reactor — AP-1000
3. Gen IV reactor — SFR
4. Solar array — PV
5. Fusion facility — Tokamak (most abstract)
