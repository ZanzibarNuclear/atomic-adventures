# Progression Design

[DRAFT] — How players advance through the game and learning content.

## Progression Model

```
Part I (surface — hydro startup → operations → solar discovered)
    → Part II (surface — PV restoration → baseload need)
    → Part III (underground — SMR + party reunion)
```

**Part I** — Pine forest through surface facility. **At least a few weeks** of game time. Early beats (arrival through first power) take days; the **core** is weeks of hydro maintenance and power management before hydro operator qualification opens Part II. The **eBuggy tour** discovers the solar field during Part I. See [Story Overview](story/story-overview.md#story-structure--parts-i-ii--iii).

**Part II** — Surface campus. Restore the solar array found in Part I; integrate PV with ongoing hydro. Ends when baseload need and PV milestones unlock the **hidden elevator**.

**Part III** — Underground Gen IV SMR. The **traveling party reunites** at the compound; reactor operation requires a team. Surface hydro and solar remain available.

- **Within part** — May allow some freedom (e.g., multiple puzzles, optional depth)
- **Across parts** — Complexity builds: steady hydro → variable solar → baseload nuclear

## Staged Complexity Through Real-World Challenges

The game must push players through **levels of increasing complexity**. Real-world engineering problems are the primary mechanism: each beat introduces one concept, constraint, or failure mode before the next layer appears.

### The "too easy, then real life" pattern

A recurring beat structure:

1. **Almost too easy** — The player solves a challenge and thinks, *Yes, I did it.*
2. **Reality check** — The game (story, logs, simulation feedback) says, *Hold on. That was too easy. In real life, there are problems — like this one…*
3. **Next problem** — The player applies new knowledge to solve the real constraint.
4. **Repeat** — Many rounds of this loop before the chapter or part threshold opens.

**Part I example:** The first challenge to start the hydro generator should feel almost trivial — a deserved win. Then operations and maintenance introduce genuine issues (flow, sync, load, wear, weather, campus demand, etc.). This cycle continues for **many rounds** across weeks of in-game time before hydro operator qualification gates Part II.

**Part III note:** Solo operation was plausible for hydro and mostly for PV integration; **SMR startup and sustained ops** justify NPC helpers without diluting the player's core simulation learning.

### Design goals

| Goal | How staged challenges help |
|------|------------------------------|
| **Avoid overwhelm** | Expertise builds in stages; the player masters one idea before the next piles on |
| **Sustain motivation** | Early wins build confidence; later problems feel earned, not arbitrary |
| **Plausible operator scope** | One person at a time for Parts I–II; **team support in Part III** when scale demands it |

This pattern should repeat at chapter scale (see difficulty curve below) and within each technology area — especially hydro through Part I operations.

## Difficulty Curve

| Chapter | Part | Complexity | Rationale |
|---------|------|------------|-----------|
| Act 0 (Hub) | I | Very low | Survival exploration; hydro startup gate; buggy reward |
| Hydro | I | Low → Medium | Startup, then weeks of operations + power management |
| PV | II | Low–Medium | More variables (tilt, shading, time); contrast with hydro |
| Gen IV SMR | III | Medium–High | Fast neutrons, coolant, safety; team-assisted operations |

_Deferred content (not trilogy): AP-1000 Gen III+, fusion — see [Game Design Overview](../game-design-overview.md)._

## Unlock Catalog

Part I defines concrete **challenge chains** and **discovery unlocks** in [Part I Unlocks](part-i-unlocks.md):

- **Progression** — Each step `requires` the previous challenge (e.g. hydro startup: clear intake → pressure rise → turbine valve → generator → Level 1 complete).
- **Discovery** — Campus exploration and dormant tech (buggy tour, battery storage, **solar field**, Part III reactor tease) parallel hydro ops; solar discovery foreshadows Part II; reactor tease foreshadows Part III.

Implementation: challenge IDs and flags feed story YAML `require` blocks and simulation gates — see [Story Data Format](story/story-data-format.md).

## Gate Types

1. **Simulation success** — Achieve target output or pass scenario
2. **Sustained operation** — Maintain hydro over in-game weeks (Part I → Part II threshold)
3. **Integration milestone** — PV contributing to campus load (Part II → Part III threshold)
4. **Puzzle** — Apply concept to solve in-world problem
5. **Dialogue/quiz** — NPC asks; correct answer unlocks
6. **Exploration** — Find document/artifact that teaches concept

*Prefer 1, 2, 3, and 4; use 5 and 6 sparingly.*

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
- [x] Three-part progression model — hydro → PV → SMR (2026-06)
- *Balance "stuck" vs. "challenged"*
- [x] Part I unlock catalog — hydro L1 chain, ops rounds, discovery track ([part-i-unlocks.md](part-i-unlocks.md)) (2026-06)
- [ ] Wire ops rounds to in-game calendar and sim scenarios
- [ ] Define Part II PV unlock catalog and Part III SMR gates
