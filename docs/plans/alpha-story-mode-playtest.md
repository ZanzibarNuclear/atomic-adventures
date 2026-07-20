# Alpha Story Mode Playtest Script + A1 Audit

**Status:** Script ready; high-confidence fixes landed (hole arc, cards, sleep, station handoff)  
**Last updated:** 2026-07-18  
**Source of truth:** live `game/content/atomic-adventures.sqlite` + runtime (`useStoryArc`, hydro facility actions)  
**Parent plan:** [getting-to-alpha.md](getting-to-alpha.md)

## Purpose

Guide a full **Story mode** survival → hydro run for alpha acceptance item:

> The full survival-to-hydro Story mode run has one final hands-on browser pass
> for scene prose order and confusing affordances.

Use this script for browser play. Check expected location, beat, flags, and
facility state after each step. Log failures under [A1 Findings](#a1-findings).

## Starting state (new Story mode game)

| Field | Expected |
| --- | --- |
| Play mode | `story` (recommended default) |
| Arc | `part-i-opener` |
| Beat | `survive-in-the-woods` |
| Place | outdoors |
| Hex | `origin` |
| Clock | Part I opening clock (Day 1 afternoon) |
| Inventory | Field backpack on character; half Neutron bar + half water bottle inside |
| Hydro facility | offline; intake closed/not clear; valves closed; `startupComplete: false` |
| Instruction card | on `fixed:control-room-console` (control-room stand `console`) |
| Flags of note | none of the story/hydro progression flags below |

### Canonical arcs (live)

1. **`part-i-opener`** (woods → fence → **gate**) → completion card → **`part-i-station`**
2. **Alternate:** from the fence, crawl **`south-pines-hole`** → **`part-i-fence-hole`** → side man door → merge into **`part-i-station`** at `solve-first-crisis`
3. **`part-i-station`** (shelter → sleep) → completion card → **`understand-building`**
4. **`understand-building`** → hydro online / startup complete (no next arc yet)

Gate and hole are both valid Story-mode routes. They rejoin when Zanzibar is inside the large bay.

---

## Playtest script

### Legend

- **Do** — player action
- **Expect** — runtime state after the action
- **Prose check** — what the player should understand from scenes/UI
- **Pass?** — mark during browser run

---

### Phase 0 — Mode selection

| Step | Do | Expect | Prose check | Pass? |
| --- | --- | --- | --- | --- |
| 0.1 | Open game with no save (or New Game) | Mode chooser appears before map play | Story is default/recommended; Open-world is clearly experimental | |
| 0.2 | Choose **Story mode** | `playMode=story`, arc `part-i-opener`, beat `survive-in-the-woods`, hex `origin` | Opening scene “Lost in the woods” / intro | |

---

### Phase 1 — Woods to fence (`part-i-opener`)

#### 1A. Origin → east pines

| Step | Do | Expect | Prose check | Pass? |
| --- | --- | --- | --- | --- |
| 1.1 | Read intro scene | Scene `intro`; beat still `survive-in-the-woods` until leave | Low on provisions; need to keep moving west | |
| 1.2 | Choose **Keep walking west** (or move to `east-pines`) | Hex `east-pines`; flag `story.intro`; beat → `keep-moving-west` | Scene `east-pines`: west/uphill/downhill choice | |

#### 1B. East pines → center pines (canonical)

| Step | Do | Expect | Prose check | Pass? |
| --- | --- | --- | --- | --- |
| 1.3 | Choose **Continue west** | Hex `center-pines`; flag `story.east-pines`; beat → `reach-the-gate` | Fence line blocks west; must follow fence | |
| 1.4 | Optional detour: **Head uphill** first | Beat → `far-pines`; summit glimpse; can return via north-bend or center-pines | Detour costs time/energy; does not soft-lock | |

#### 1C. Fence → gate

| Step | Do | Expect | Prose check | Pass? |
| --- | --- | --- | --- | --- |
| 1.5 | From center-pines, **Follow the fence uphill** or downhill | Flag `story.center-pines`; hex `north-bend` or `south-pines` | Guidance still “follow the fence / find where it leads” | |
| 1.6 | Reach `gate-woods` | Beat completes into `find-a-way-past-fence` when location is `gate-woods` or `utility-yard` | Scene `the-gate`: guardhouse + closed gate | |
| 1.7 | Choose **Inspect the gate** | Flag `story.gate.inspected`; gate open/cross becomes possible | Scene/follow-up explains vines holding gate | |
| 1.8 | Open and cross `compound-gate` | Flags `story.gate.open` (on open) and **`compound.gate-passed`** (on cross) | Crossing feels intentional; not automatic from reading alone | |
| 1.9 | Arc handoff | Beat completes; arc `part-i-opener` marked complete; short completion card; after dismiss → arc `part-i-station`, start beat `look-for-shelter` | Card is short and non-spoiling | |

**Alternate path (valid Story arc — fence hole):**

| Step | Do | Expect | Notes |
| --- | --- | --- | --- |
| 1.A1 | From fence, go to `south-pines`, search/discover hole, cross `south-pines-hole` | Flag `compound.fence-hole-passed`; active arc → **`part-i-fence-hole`**, beat `approach-side-entrance` | Does not require gate inspect/open |
| 1.A2 | Reach east/back man door (`large-bay-man-front`, ideally via `man-door-path`) | Hole arc completes; **completion card**; merge to **`part-i-station`** beat **`look-for-shelter`** | Join at backside scene (`large-bay-man-front-2`), then open door into bay like the gate path |

**Canonical outdoor hex spine:**  
`origin` → `east-pines` → `center-pines` → (`north-bend` or `south-pines`) → `gate-woods` → (cross gate) → `west-slope` / `utility-yard`

---

### Phase 2 — Shelter and first night (`part-i-station`)

| Step | Do | Expect | Prose check | Pass? |
| --- | --- | --- | --- | --- |
| 2.1 | After opener card, continue into compound | Arc `part-i-station`, beat `look-for-shelter`; west-slope / yard / exterior nodes | Seek shelter before dark | |
| 2.2 | Reach exterior `large-bay-man-front` | Beat advances toward `look-for-shelter` / man-door scene | Side door is locked; forced entry is allowed by story | |
| 2.3 | Break/open `large-bay-man`, enter `large-bay` | Indoors room `large-bay`; beat → `solve-first-crisis` | Empty garage bay; stairs up | |
| 2.4 | Optional: set `story.the-garage` via front-entrance “Look for a way in” if that scene is hit | Flag `story.the-garage` unlocks kitchen building actions that require it | Do not soft-lock if player only used man door | |
| 2.5 | Reach `conference` then `kitchen` | Scenes for Day 1 rooms | Food/water available | |
| 2.6 | Get food and water | Prefer building actions: **Tastee Tack rations** (`eat-rations`) and **river water** (`purify-water`) → flags `day1.found-food`, `day1.found-water` + real satiety/hydration effects. Kitchen choice **Eat and drink** only sets the same flags (no item/stat effects). | Player understands they ate/drank | |
| 2.7 | Enter `library` | Scene `library-arrival` | Safe place to rest | |
| 2.8 | Choose **Sleep** (library-arrival) | Flags `library.sleep-1`, `day-2.started`, `day1.complete`; milestone `library.sleep-1`; time advances toward Day 2 | Overnight transition is clear | |
| 2.9 | Arc handoff | `part-i-station` complete; completion card; dismiss → arc `understand-building`, beat `understand-building` | Card is coherent (no draft notes) | |

**Action IDs allowed on `solve-first-crisis` (story-forward):**  
`door-open:library-hallway`, `door-open:conference-kitchen`, `door-open:conference-garage-stair`, `move-room:kitchen`, `action:eat-rations`, `action:purify-water`, `move-room:library`, `action:rest-in-library`

**Completion condition:** flag `library.sleep-1` (not merely `day1.complete`).

**Known risk:** indoor action `rest-in-library` sets `day1.complete` / `story.library-arrival` but **not** `library.sleep-1`. Sleep choice is the reliable beat completer.

---

### Phase 3 — Understand building + instruction card (`understand-building`)

| Step | Do | Expect | Prose check | Pass? |
| --- | --- | --- | --- | --- |
| 3.1 | Wake / continue Day 2 | Scene `library-explore` when in library (story beat `understand-building`) | Pipe along cascade; holo-readers need power; priority is restore power | |
| 3.2 | Navigate to `control-room` | Room `control-room`; scene `control-room` | Covered console; laminated card in binder pocket | |
| 3.3 | Stand at console; open/read **laminated startup card** | Document stage view `hydro-startup-instruction-card`; flags `hydro.startup_card_read`, `hydro.outdoor-actions`, `hydro.discovered`; quest `restore-hydro` started | Card is a visual object (front checklist + back mini-map), not plain story prose | |
| 3.4 | Optionally take card into hand/backpack | Instance can leave `fixed:control-room-console` | Carried access still works later | |
| 3.5 | Beat advance | `hydro.startup_card_read` completes beat → `inspect-intake` | Player knows field steps before leaving | |

**Read action require:** item `hydro-startup-instruction-card` with access `nearby` (console holder or carried).

---

### Phase 4 — Field startup sequence

Follow the card order. Facility patches come from `applyHydroStartupAction` on the matching indoor/exterior action IDs.

| Step | Do | Location | Action ID | Flags set | Facility expect | Beat completion | Pass? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Go outside to intake path | exterior `intake-entrance` / `upstream-bank` | move | — | — | `inspect-intake` completes at `upstream-bank` → `clear-open-intake` | |
| 4.2 | Clear debris | `upstream-bank` | `clear-intake-debris` | `hydro.clear-intake-debris` | `intakeClear=true`, debris 0 | — | |
| 4.3 | Open intake | `upstream-bank` | `open-intake` | `hydro.open-intake` | `intakeOpen=true` | beat → `align-diversion-valve` | |
| 4.4 | Align diversion valve | `midstream-bank` | `align-pipeflow` | `hydro.align-pipeflow` | `manualValves.upstreamOpen=true` | beat → `open-turbine-valve` | |
| 4.5 | Open powerhouse/turbine valve | `downstream-bank` | `open-turbine-valve` | `hydro.open-turbine-valve` | `manualValves.powerhouseOpen=true` | beat → `return-control-room` | |
| 4.6 | Return to control room | room `control-room` | move | — | — | beat → `connect-power` | |
| 4.7 | Connect station power | `control-room` | `connect-power` | `hydro.level-1-complete`, **`hub.hydro_online`** | `online=true`, `startupComplete=true` | see note below | |
| 4.8 | Open generator console | control-room console stage | `hydro-console:open` / console view | — | console shows power online + next action | intended beat `check-console` | |
| 4.9 | Confirm startup complete | — | — | — | `startupComplete=true` | beat `complete-startup` | |

**Prerequisite chain on building actions (flags):**  
`hydro.outdoor-actions` → clear debris → `hydro.clear-intake-debris` → open intake → `hydro.open-intake` → align valve → `hydro.align-pipeflow` → turbine valve → `hydro.open-turbine-valve` → connect power.

**Story beat completion chain (facility paths):**

| Beat | completesWhen |
| --- | --- |
| `clear-open-intake` | `facility.hydro.intakeOpen == true` |
| `align-diversion-valve` | `facility.hydro.manualValves.upstreamOpen == true` |
| `open-turbine-valve` | `facility.hydro.manualValves.powerhouseOpen == true` |
| `return-control-room` | location control-room |
| `connect-power` | `facility.hydro.online == true` |
| `check-console` | `facility.hydro.online == true` |
| `complete-startup` | `facility.hydro.startupComplete == true` |

**Known risk:** `connect-power` sets both `online` and `startupComplete`, so `check-console` and `complete-startup` may auto-complete in the same tick **without** the player opening the console. Confirm whether the console step is skipped and whether that confuses the player.

---

### Phase 5 — Powered world consistency (alpha electrical bar)

After `hub.hydro_online` / facility online:

| Step | Do | Expect | Pass? |
| --- | --- | --- | --- |
| 5.1 | Stay in control room | Play panel / status: console powered; lights/outlets active language | |
| 5.2 | Visit library | Holo-reader available; “powered and ready” status; can open beginner lesson | |
| 5.3 | Optional: kitchen stove stand | `turn-on-electric-stove` available only with power | |
| 5.4 | Optional: small-bay EV charger | `charge-ev` available with power (charging depth is post-alpha) | |
| 5.5 | Developer or save-edit power off (if easy) | Powered objects no longer claim to be active | |

**Alpha bar:** powered objects must not contradict station power. Detailed plug/unplug/brownout is out of scope.

**Lessons (post-power, not arc-gated):**

| Lesson ID | Title | Completion award |
| --- | --- | --- |
| `hydro-power-stream-to-socket` | Hydro Power From Stream To Socket | knowledge `hydro-head-and-flow` |
| `hydro-power-intro` | Hydro Power, Water You Waiting For? | knowledge `hydro-head-and-flow` |

Suggested alpha lesson: **stream-to-socket** (beginner multi-page). Not required to finish `understand-building`, but required for alpha pillar “learn hydro.”

---

### Phase 6 — Save/load checkpoints

| Checkpoint | When | Verify after load |
| --- | --- | --- |
| S1 | After gate cross / opener card | playMode, arc/beat, flags, hex |
| S2 | After library sleep | Day 2 clock, `library.sleep-1`, inventory, vitals |
| S3 | After card read, before field work | card held/on console, `hydro.startup_card_read` |
| S4 | Mid field (intake open, valves still closed) | facility partial state |
| S5 | After power online | `hub.hydro_online`, facility online, console behavior |

---

### Phase 7 — Final acceptance ticks

| # | Check | Pass? |
| --- | --- | --- |
| A | Beginner can explain water → turbine → generator → electricity (lesson or card + field) | |
| B | Instruction card inspected as visual artifact before field work | |
| C | Generator online; simplified console answers powered / now / next | |
| D | Story mode guided the path without objective UI | |
| E | No soft-lock on canonical path | |
| F | Save/load preserves mode, story, inventory, hydro facility | |
| G | `npm run test` and `npm run build:game` still green after fixes | |

---

## Quick reference — progression flags

| Flag / milestone | When it should appear |
| --- | --- |
| `story.intro` | leave origin via intro choice |
| `story.east-pines` | continue west from east-pines |
| `story.center-pines` | follow fence from center-pines |
| `story.gate.inspected` | inspect gate choice |
| `story.gate.open` | open compound-gate |
| `compound.gate-passed` | **cross** compound-gate (canonical) |
| `compound.fence-hole-passed` | **cross** south-pines-hole (alternate arc) |
| `story.fence-gap-searched` | optional south-pines “search base of fence” choice |
| `story.the-garage` | garage front “Look for a way in” |
| `day1.found-food` / `day1.found-water` | eat/purify actions or kitchen choice |
| `library.sleep-1` | library Sleep choice (arc completion) |
| `day1.complete` / `day-2.started` | sleep path |
| `hydro.startup_card_read` | read laminated card |
| `hydro.outdoor-actions` / `hydro.discovered` | read card |
| `hydro.clear-intake-debris` → `hydro.open-intake` → `hydro.align-pipeflow` → `hydro.open-turbine-valve` | field actions in order |
| `hub.hydro_online` / `hydro.level-1-complete` | connect-power |

---

## A1 Findings

Findings from **content + runtime audit** (2026-07-18). Browser confirmation still required where noted.

### Blockers / high risk (likely break or soft-lock)

| ID | Severity | Area | Finding | Evidence | Browser? |
| --- | --- | --- | --- | --- | --- |
| F1 | **Fixed** | Gate / hole alternate | Hole is now a separate arc `part-i-fence-hole`. Crossing `south-pines-hole` sets `compound.fence-hole-passed` and branches from opener; entering `large-bay` merges into station at `solve-first-crisis`. | runtime + content 2026-07-18 | Browser confirm discovery UX |
| F2 | **Fixed** | First night completion | `rest-in-library` now also sets `library.sleep-1` and `day-2.started` so the action path completes the station arc. | building action `set_flags` | Browser confirm |
| F3 | **Fixed** | Station arc start | Removed broken `carry-on-into-compound`. Station `startBeat` is `look-for-shelter`. | story arcs | Browser confirm |
| F4 | **Medium-High** | End of hydro arc | `connect-power` sets facility `online` **and** `startupComplete`. Beats `check-console` and `complete-startup` both complete on those conditions, so they can auto-fire in one tick without opening the console. Alpha exit criterion “check the console” may be skipped. | `startupActions.js` + beat completesWhen chain | Confirm whether console is forced/opened |

### Confusing affordances / prose polish

| ID | Severity | Area | Finding | Evidence | Browser? |
| --- | --- | --- | --- | --- | --- |
| F5 | **Fixed** | Arc completion cards | Draft notes removed; cards shortened (no spoiler notes). Hole path has its own short card. | completion.card fields | Yes |
| F6 | **Medium** | Food/water dual path | Kitchen scene choice **Eat and drink** only sets flags (`day1.found-food`, `day1.found-water`). Real satiety/hydration come from `eat-rations` / `purify-water`, which also require `story.the-garage`. Player can “eat” in prose/flags without inventory/stat change, or fail to see kitchen actions if they never set `story.the-garage`. | story_choices kitchen; building actions require | Confirm UI labels |
| F7 | **Medium** | Control-room revisit prose | Control-room revisit lists a **7-step** procedure (includes leak check, PSI, electrical panel) that does not match the alpha **6-step** laminated card / facility action model (no leak-patch step, no PSI gate in alpha actions). | scene `control-room` revisit vs card checklist vs actions | Yes |
| F8 | **Low-Medium** | Library Day 2 prose | `library-explore` is a long multi-location monologue (bathroom, breakfast, stairs) while the player is still in the library. Risks desync: prose says Zanzibar already ate breakfast / left the room while the player has not moved. | scene `library-explore` text | Yes |
| F9 | **Low** | Typos / tone | e.g. “Partical Physics”, “Quantum Machanics”, “somem time”, “Get you water here” heading — polish, not blockers. | scene text | Optional |
| F10 | **Low** | Lesson timing vs alpha pillars | Beginner lesson is power-gated via holo-reader, not a story beat. Canonical arc can finish startup **before** any lesson. Alpha pillar 1 still needs a deliberate post-power lesson visit in the playtest (Phase 5). | learning require / library prose | Confirm holo-reader gate |

### Consistency notes (not necessarily bugs)

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| N1 | Info | Electrical model | Powered objects (lights, outlets, holo-reader, console, stove, EV charger) are authored; status lines and power-gated actions exist. Detailed plug/unplug remains post-alpha. |
| N2 | Info | Instruction card placement | Instance `hydro-startup-instruction-card-4` starts on `fixed:control-room-console` — matches plan. |
| N3 | Info | Starting kit | Backpack + half bar + half water bottle on character — supports early survival pressure. |
| N4 | Info | Story action gating | Runtime `isActionAllowed` currently returns true for normal play (only `mustRest` restricts). `storyForwardActions` mainly mark/prompt story-forward actions rather than hard-hide others. Detours are physically possible; guidance is soft. |

---

## Browser pass log

Fill in during the hands-on run.

| Date | Tester | Build / commit | Result |
| --- | --- | --- | --- |
| 2026-07-18 | content/code audit (agent) | worktree `woe-review` @ `65ac8b4e` | Script written; findings F1–F10 logged |
| 2026-07-18 | high-confidence fixes (agent) | same worktree | F1 hole arc, F2 rest flags, F3 station start, F5 card copy; tests green for story arc; **browser pass still open** |
| | | | |

### Browser session checklist

- [ ] Phase 0 mode select
- [ ] Phase 1 woods → gate (canonical)
- [ ] Phase 1 alternate hole path (F1)
- [ ] Phase 2 shelter → sleep (test Sleep vs rest-in-library for F2)
- [ ] Phase 3 card open/flip/carry
- [ ] Phase 4 full field + connect power
- [ ] Phase 4 console open (F4)
- [ ] Phase 5 powered affordances + one lesson
- [ ] Phase 6 save/load at S1–S5
- [ ] Phase 7 acceptance ticks

---

## Suggested fix order (remaining)

1. **Browser pass** — gate path + hole path (1.A1–1.A2) + sleep path.  
2. **F4** — complete `check-console` only after console opened / stage view seen, not merely `online`.  
3. **F6–F8** — prose and food-path consistency once the path feels solid.

---

## Out of scope for this playtest

- eBuggy driving / range  
- AI station assistant  
- Battery bank modeling / brownouts  
- Interactive hydro close-ups beyond stills + actions  
- Open-world as primary path (one smoke start only, optional)
