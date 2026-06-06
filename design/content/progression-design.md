# Progression Design

[DRAFT] — How players advance through the game and learning content.

## Progression Model

```
Part I (several weeks, surface campus — hydro startup → operations) → Part II (below)
```

**Part I** — Pine forest through surface facility. **At least a few weeks** of game time. Early beats (arrival through first power) take days; the **core** is weeks of hydro maintenance and power management before the hidden elevator opens Part II. See [Story Overview](story/story-overview.md#story-structure--parts-i--ii).

**Part II** — What lies below the elevator. Scope TBD.

Within each part, technology chapters may follow a linear order (complexity builds). Part I vs. Part II chapter assignment is not yet decided.

- **Within chapter** — May allow some freedom (e.g., multiple puzzles, optional depth)

## Staged Complexity Through Real-World Challenges

The game must push players through **levels of increasing complexity**. Real-world engineering problems are the primary mechanism: each beat introduces one concept, constraint, or failure mode before the next layer appears.

### The "too easy, then real life" pattern

A recurring beat structure:

1. **Almost too easy** — The player solves a challenge and thinks, *Yes, I did it.*
2. **Reality check** — The game (story, logs, simulation feedback) says, *Hold on. That was too easy. In real life, there are problems — like this one…*
3. **Next problem** — The player applies new knowledge to solve the real constraint.
4. **Repeat** — Many rounds of this loop before the chapter or part threshold opens.

**Part I example:** The first challenge to start the hydro generator should feel almost trivial — a deserved win. Then operations and maintenance introduce genuine issues (flow, sync, load, wear, weather, campus demand, etc.). This cycle continues for **many rounds** across weeks of in-game time before the hidden elevator gates Part II.

### Design goals

| Goal | How staged challenges help |
|------|------------------------------|
| **Avoid overwhelm** | Expertise builds in stages; the player masters one idea before the next piles on |
| **Sustain motivation** | Early wins build confidence; later problems feel earned, not arbitrary |
| **Plausible solo operator** | One person could not realistically do *everything* at once and survive; **one focused challenge at a time** keeps the scenario serious enough to believe |

This pattern should repeat at chapter scale (see difficulty curve below) and within each technology area — especially hydro through Part I operations.

## Difficulty Curve

| Chapter | Complexity | Rationale |
|---------|------------|-----------|
| Act 0 (Hub) | Very low | Survival exploration; hydro startup gate; buggy reward |
| Hydro (Part I) | Low → Medium | Startup, then weeks of operations + power management |
| PV | Low–Medium | More variables (tilt, shading, time) |
| AP-1000 | Medium | Less intuitive; safety-critical |
| Gen IV | Medium–High | New concepts (fast neutrons, sodium) |
| Fusion | High | Most abstract; cutting-edge |

## Unlock Catalog

Part I defines concrete **challenge chains** and **discovery unlocks** in [Part I Unlocks](part-i-unlocks.md):

- **Progression** — Each step `requires` the previous challenge (e.g. hydro startup: clear intake → pressure rise → turbine valve → generator → station power → Level 1 complete).
- **Discovery** — Campus exploration and dormant tech (buggy tour, battery storage, solar field, Act II reactor tease) parallel hydro ops; they foreshadow chapters without replacing the hydro competence gate.

Implementation: challenge IDs and flags feed story YAML `require` blocks and simulation gates — see [Story Data Format](story/story-data-format.md).

## Gate Types

1. **Simulation success** — Achieve target output or pass scenario
2. **Sustained operation** — Maintain hydro over in-game weeks (Part I → Part II threshold)
3. **Puzzle** — Apply concept to solve in-world problem
4. **Dialogue/quiz** — NPC asks; correct answer unlocks
5. **Exploration** — Find document/artifact that teaches concept

*Prefer 1, 2, and 3; use 4 and 5 sparingly.*

## Feedback Loops

- **Positive** — Success → story reward → motivation
- **Corrective** — Failure → hint or explanation → retry
- **Avoid** — Punishment without learning; dead ends

## Optional Depth

- **Casual path** — Simplified simulations; fewer concepts
- **Deep path** — Full fidelity; more parameters
- *TBD — Single path vs. difficulty select*

## Revision Notes

- [x] Staged complexity pattern — real-world challenges, "too easy then real life" loop (2026-06)
- *Balance "stuck" vs. "challenged"*
- [x] Part I unlock catalog — hydro L1 chain, ops rounds, discovery track ([part-i-unlocks.md](part-i-unlocks.md)) (2026-06)
- [ ] Wire ops rounds to in-game calendar and sim scenarios
