# Getting to Alpha

**Status:** In progress — pillars shipped; end-to-end Story pass and polish remain  
**Last updated:** 2026-07-20  
**Public reference build:** https://fun.atomicambitions.com (main deploy)  
**Playtest script:** [alpha-story-mode-playtest.md](alpha-story-mode-playtest.md)  
**Quality checklist:** [Character, Inventory, and Game-View Regression Checklist](../quality/character-inventory-regression-checklist.md)

**Primary contracts:** [Play Modes And Story Mode](../contracts/play-modes-and-story-mode.md), [Story Beats And Scenes](../contracts/story-beats.md), [Stage Views](../contracts/stage-views.md), [Holo-Reader](../contracts/holo-reader.md), [Control Panel](../contracts/control-panel.md), [Hydro Simulator](../contracts/hydro-simulator.md), [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md)

---

## Goal

Ship a hydro vertical slice that a new player can understand, follow, and
complete in **Story mode**: woods survival → compound → first night → laminated
startup card → field hydro actions → station power online → readable console
and (at least once) the beginner hydro lesson.

Alpha is **not** a general simulation platform, eBuggy campaign, AI assistant,
or full electrical model. Those stay post-alpha unless a hole appears in the
survival-to-hydro loop.

### Alpha should feel like

1. Zanzibar can learn the basic idea of hydro power without prior knowledge.
2. Zanzibar can inspect a clear laminated instruction card before field work.
3. Zanzibar can bring the generator online and read a simpler control-room console.
4. The player chooses Story mode (recommended) or experimental Open-world mode
   before play begins.

---

## Shipped pillars (do not re-open unless broken)

These were the original four alpha pillars. Treat them as done unless a
playtest or bug proves otherwise.

| Pillar | Where it lives |
| --- | --- |
| Beginner hydro lesson (multi-page, illustrated, quizzes) | Learning content + holo-reader stage view |
| Laminated startup instruction card (artifact, front checklist + back mini-map) | Document stage view + control-room console stand |
| Simplified hydro console | Hydro console stage view + facility runtime |
| Story mode vs Open-world mode | Mode chooser, `useStoryArc` / open-world controller, saves |

Related plumbing that is also in place for the alpha loop:

- Hydro facility state and startup actions (clear/open intake, valves, connect power).
- Powered-object consistency when station power is online (lights, outlets, holo-reader, console, stove, EV charger hooks).
- Fence-hole alternate Story arc (`part-i-fence-hole`) merging back into station arc.
- Completion cards for arc handoffs (opener, hole, station).

---

## Definition of done

Alpha is ready when **all** of the following are true:

- [ ] A new player can finish **survival → hydro online** in Story mode without a soft-lock.
- [ ] Scene prose order and actions agree with the card/console model (no contradictory procedures).
- [ ] Food/water and first-night paths complete the station arc and apply understandable wellbeing effects (or intentional, labeled alternatives).
- [ ] After power, electrical affordances do not claim to be active when the station is offline.
- [ ] Player can open the beginner hydro lesson after power (pillar 1 exercised at least once in the run).
- [ ] Save/load preserves mode, arc/beat, inventory, flags, and hydro facility state at mid-path checkpoints.
- [ ] Hands-on browser pass logged (manual findings section below).
- [ ] `npm run test` and `npm run build:game` still pass from repo root (see also test-effectiveness work item).
- [ ] Prioritized punchlist below is empty of P0 items (P1/P2 optional for alpha call).

---

## Working punchlist (seed — sort after manual testing)

Priorities will be reordered after manual findings are in. **Do not treat this
list as closed.** Items marked *audit* came from content/runtime review, not
yet confirmed in browser.

### P0 — Likely blockers or trust breakers

| ID | Source | Item | Notes |
| --- | --- | --- | --- |
| P0-1 | audit F4 | End-of-hydro console beat can auto-skip | `connect-power` sets `online` **and** `startupComplete`. Beats `check-console` and `complete-startup` both complete on those, so “check the console” may not require a real player step (console may flash via `onEnter`). |
| P0-2 | audit F6 | Food/water dual path | Kitchen choice **Eat and drink** only sets flags. Real satiety/hydration actions require `story.the-garage` (garage-front scene). Man-door-only path may “complete” night without real recovery. |
| P0-3 | process | Full manual Story mode browser pass | Gate path + hole path + sleep + field + power + lesson + save/load. Script: [alpha-story-mode-playtest.md](alpha-story-mode-playtest.md). |
| P0-4 | process | Automated play path coverage | Playwright/smoke path that exercises mode select → early story → (later) key gates. Unit suite alone is not trusted as path proof. |

### P1 — Confusing path / prose that undermines alpha

| ID | Source | Item | Notes |
| --- | --- | --- | --- |
| P1-1 | audit F7 | Control-room revisit is 7 steps | Includes leak check, 60 PSI, electrical panel language that does not match the alpha 6-step card + real actions. |
| P1-2 | audit F8 | Library Day 2 monologue vs location | `library-explore` narrates bathroom/breakfast/stairs while player is still in the library. |
| P1-3 | audit F10 | Lesson not on critical path | Beginner lesson is power-gated via holo-reader, not a story beat. Arc can finish before any lesson; still need a deliberate post-power lesson visit for pillar 1. |
| P1-4 | audit | Soft Story action gating | Runtime mainly *prompts* story-forward actions; hard-hide of out-of-order mutations is limited (`mustRest` is the main hard stop). Detours can feel aimless. |

### P2 — Polish and hygiene

| ID | Source | Item | Notes |
| --- | --- | --- | --- |
| P2-1 | audit F9 | Typos / tone | e.g. “Partical Physics”, “Quantum Machanics”, “somem time”, “Get you water here”. |
| P2-2 | audit | Stale production JSON snapshot | Checked-in `game/public/content/utility-station.json` lagged SQLite for `rest-in-library` flags; confirm build export path and live site after deploy. |
| P2-3 | process | Verify and improve effectiveness of automated tests | Hypothesis: many tests pin content existence or incidental structure, not player-facing invariants. Audit suite; keep invariant tests; delete or replace misleading ones. |
| P2-4 | docs | Refresh stale `feature-gaps.md` and contract status labels | Gaps still list shipped work (mode select, StoryArc, holo MVP, etc.). Misleads alpha triage. |
| P2-5 | browser-confirm | Fixed items need human confirm | F1 hole arc, F2 rest/sleep flags, F3 station start beat, F5 completion card copy. |

### Explicitly post-alpha (do not expand alpha unless loop is blocked)

- Detailed plug/unplug/turn-off and brownout/load modeling.
- eBuggy battery, charge range, gauge panel, driving simulation.
- AI station assistant.
- Part I battery bank location/capacity story beyond the hidden buffer assumption.
- Interactive hydro field close-ups (intake/valve/turbine) beyond stills + actions.
- Scene Builder full rename / first-class Scenes workspace (`scene-builder-workspace.md`).
- Holo-reader author validation warnings and richer completion rules.
- Close-up rides, video kinds, simulation outcome sandbox (beyond current console/lesson/document).

---

## Findings from manual testing

Use this section as a **raw capture log**. Do not prioritize here during the
run — dump observations, then we sort into the punchlist.

**How to log**

- Date, build (local commit or public URL), Story vs Open-world.
- Where you were (hex / room / exterior node), what you did, what you expected, what happened.
- Soft-lock, confusion, prose contradiction, missing action, wrong flag, save bug, UI dead-end.
- Optional: severity guess (`blocker` / `confusing` / `polish`).

### Session template

```
### YYYY-MM-DD — <name> — <local | fun.atomicambitions.com> — <commit or “main”>

- Context: Story mode, new game (or load from …)
- Path: gate | hole | mixed

#### Findings
1. [blocker|confusing|polish] <short title>
   - Where:
   - Did:
   - Expected:
   - Saw:
   - Notes:

#### Pass notes (what felt fine)
-
```

### Sessions

<!-- Add new sessions above this line, newest first -->

### YYYY-MM-DD — (template reserved)

_No sessions logged yet. First pass in progress._

---

## Odds and ends from other plans

Reviewed `docs/plans/*` against code and contracts (2026-07-20). Items below
are leftovers to consider with manual notes — not automatic alpha scope.

| Plan | Status | Alpha relevance | Action |
| --- | --- | --- | --- |
| [alpha-story-mode-playtest.md](alpha-story-mode-playtest.md) | Script + audit; browser open | **Primary** acceptance instrument | Keep until browser log green |
| [close-up-views-implementation.md](close-up-views-implementation.md) | Phase 2 (location images) done; rides/sims later | Low for loop if lesson/console/card work | Keep as roadmap; fold done pieces into contracts over time |
| [holo-reader-follow-ups.md](holo-reader-follow-ups.md) | Player MVP done; author warnings open | Player path is alpha; Wave 3 warnings are not | Keep until warnings → `holo-reader` / `feature-gaps` |
| [scene-builder-workspace.md](scene-builder-workspace.md) | Needs rethinking; mostly unfinished | Authoring only | Keep; **post-alpha** for player ship |
| story-arc-builder-simplification | Implemented; absorbed by play-modes contract | None | **Deleted** 2026-07-20 |
| story-mode-migration-plan | Runtime migration complete | None | **Deleted** 2026-07-20; remaining naming debt lives in scene-builder plan |
| story-mode-technical-design | Superseded by contracts | None | **Deleted** 2026-07-20 |

### Contract / docs hygiene (consider with punchlist)

- `docs/contracts/feature-gaps.md` is **stale**: still lists mode selection, StoryArc runtime, holo MVP, and other shipped work as open.
- `location-media.md` status still says Planned while location image close-ups ship.
- `play-modes-and-story-mode.md` still labeled “Target” though the model is live.
- `stage-views.md` mentions `video` / `ride` kinds not present in runtime.

### Automated playtesting note

Manual browser play remains the source of truth for prose and confusion.
Automated path smokes (Playwright against local or public) should prove:

1. Mode chooser appears for a new game.
2. Story mode starts into the opener scene/map.
3. Later: gate/hole, sleep, card, field chain, power, console, lesson.

**Existing short smoke** (already in the game package):

```bash
# with dev server on :5173
npm run browser:smoke -w game
```

Covers: Story + Open-world mode select, Origin → East Pines, no objective UI.

**Extensible alpha smoke** (screenshots + findings log):

```bash
npm run playtest:alpha-smoke -w game
# or: BASE_URL=https://fun.atomicambitions.com node game/scripts/alpha-play-smoke.mjs
```

Artifacts: `game/tmp/playtest-artifacts/` (gitignored).

| Date | Target | Script | Result |
| --- | --- | --- | --- |
| 2026-07-20 | local `:5173` | `browser:smoke` | ok — Story/Open-world, Origin→East Pines |
| 2026-07-20 | local `:5173` | `playtest:alpha-smoke` | **7 pass / 0 fail** — mode chooser, Story, opener prose, first choice |

These only cover the **opening minutes**. Extending toward gate / sleep / card / power is punchlist **P0-4**.

Unit/integration tests remain useful only where they protect **named
invariants** (see AGENTS.md). Effectiveness audit is punchlist **P2-3**.

---

## Decisions (still current)

- Guided Story mode first; Open-world is explicit and experimental.
- Teach hydro from everyday references (waterwheels, streams, dams, pipes, turbines, generators). Assume players have never heard `penstock`.
- Prefer images/diagrams over text-only lessons.
- Keep the first lesson compact (internal scoping only — not player-facing time estimates).
- Quiz questions short and distributed through the lesson.
- Instruction card is an object (stage view), not only story-panel prose.
- Alpha console: prerequisites, station power, pressure, turbine speed, flow/output as needed, warnings, next action.
- Defer AI station ops, full electrical modeling, buggy driving, battery/fleet modeling until after alpha.

---

## Related playtest script phases (quick map)

| Phase | Focus |
| --- | --- |
| 0 | Mode selection |
| 1 | Woods → fence (gate canonical; hole alternate) |
| 2 | Shelter, food/water, library sleep |
| 3 | Instruction card |
| 4 | Field startup + connect power + console |
| 5 | Powered world + beginner lesson |
| 6 | Save/load checkpoints |
| 7 | Acceptance ticks |

Full tables and expected flags: [alpha-story-mode-playtest.md](alpha-story-mode-playtest.md).

---

## Implementation notes

- Canonical content: `game/content/atomic-adventures.sqlite`. YAML is snapshot import/export only.
- Production reads exported `/content/*.json` from the build pipeline; do not trust stale checked-in public snapshots without re-export.
- Prefer a clear alpha path over a fully general system; generalize when a second concrete object demands it.
- Update contracts and tests when behavior changes; delete obsolete plans once contracts absorb them.
)
