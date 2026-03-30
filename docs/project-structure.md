# Project Structure

This document describes how the Atomic Adventures design project is organized.

## Directory Overview

```
atomic-adventures/
├── README.md                 # Project overview and quick links
├── docs/                     # Project-level documentation
│   └── project-structure.md  # This file
│
├── design/                   # All design work lives here
│   ├── docs/                 # Core design documents
│   │   ├── game-design-overview.md
│   │   ├── story-overview.md
│   │   └── narrative-design.md
│   ├── tech/                 # Technical & simulation specifications
│   │   ├── simulation-overview.md
│   │   ├── hydro-simulation.md
│   │   ├── photovoltaic-simulation.md
│   │   ├── nuclear-ap1000-simulation.md
│   │   ├── nuclear-gen4-simulation.md
│   │   └── fusion-simulation.md
│   ├── content/              # Learning content & progression
│   │   ├── learning-objectives.md
│   │   ├── progression-design.md
│   │   └── tech-roadmap.md
│   └── art/                  # Art assets, story art, references
│       ├── story/            # Story-specific art
│       ├── concepts/         # Concept art, mood boards
│       └── reference/        # Reference images, style guides
│
├── assets/                   # (Future) Production assets
│   ├── story/
│   ├── art/
│   └── reference/
│
└── .cursorrules or .cursor/  # (Optional) AI/editor rules
```

## Design Workflow

1. **Start in `design/docs/`** — Define vision, pillars, and story
2. **Specify in `design/tech/`** — Detail each simulation's scope and fidelity
3. **Plan in `design/content/`** — Map learning objectives to story beats
4. **Reference in `design/art/`** — Attach existing art, concepts, and references

## Document Conventions

- **Draft** — Mark sections as `[DRAFT]` when still evolving
- **TBD** — Use `TBD` for placeholders
- **Cross-reference** — Link between docs with relative paths (e.g., `../tech/hydro-simulation.md`)

## Future Additions

When moving from design to implementation:

- `src/` or `app/` — Application code (Vue/React frontend, etc.)
- `simulations/` — Simulation engine or modules
- `content/` — Localized text, dialogue, quest data
- `tests/` — Unit and integration tests
