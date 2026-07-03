# Getting to Alpha

**Status:** Planned  
**Last updated:** 2026-07-03  
**Primary contracts:** [Story Beats](../contracts/story-beats.md), [Stage Views](../contracts/stage-views.md), [Holo-Reader](../contracts/holo-reader.md), [Control Panel](../contracts/control-panel.md), [Hydro Simulator](../contracts/hydro-simulator.md), [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md)  
**Quality checklist:** [Character, Inventory, and Game-View Regression Checklist](../quality/character-inventory-regression-checklist.md)

## Goal

Move the current hydro vertical slice from a promising first cut to an alpha
experience that a new player can understand, follow, and complete.

The hydro runtime, facility state, startup actions, and first console are now
in place. The remaining alpha gap is not mostly physics; it is player
comprehension and mode structure. A beginner needs to understand what hydro
power is, what Zanzibar is trying to do, which actions matter right now, and
whether they are playing the authored story or freely exploring.

Alpha should feel like:

1. Zanzibar can learn the basic idea of hydro power without prior knowledge.
2. Zanzibar can inspect a clear laminated instruction card before doing field
   work.
3. Zanzibar can bring the generator online and read a simpler control-room
   console.
4. The player can choose between a guided storyline and an open-world mode,
   rather than being expected to infer the canonical story while every action is
   available.

## Alpha Scope

Alpha requires the following work beyond the current build:

- beginner-friendly hydro lesson;
- visual laminated instruction card;
- simplified hydro console;
- explicit storyline mode versus open-world mode.

The other ideas in this plan are important, but they should not block alpha
unless they become necessary to make the four alpha requirements coherent.

## Decisions

- Treat alpha as a guided experience first. Open-world exploration is valuable,
  but it should be an explicit alternate mode, not the default assumption for a
  story beat.
- Teach hydro power from everyday references: waterwheels, flowing streams,
  dams, Hoover Dam, pipes, turbines, generators, and electricity.
- Assume most players have never heard the word `penstock`.
- Prefer images and diagrams over text-only explanations.
- Keep the first lesson compact. This is internal scoping guidance only, not
  lesson metadata and not player-facing text.
- Keep quiz questions short and distributed throughout the lesson rather than
  saving all assessment for the end.
- Present the instruction card as an object, not as ordinary prose in the story
  panel.
- Keep the alpha console focused on the few things a beginner needs:
  prerequisites, station power state, pressure, turbine speed, flow, output,
  warnings, and what to do next.
- Defer AI-assisted station operation, full electrical-system modeling, buggy
  driving simulation, and battery/fleet modeling until after alpha.

## Wave 1 - Hydro Lesson Rewrite

**Purpose:** Make the hydro lesson approachable for a beginning player.

The current hydro learning path needs to explain the basics to someone who has
seen a waterwheel or a picture of Hoover Dam, but has not thought about how
water becomes electricity.

- [x] Rewrite the hydro lesson for beginners.
- [x] Split the lesson into multiple pages so each idea is small.
- [x] Add visual-first explanations for:
      - water stored high or flowing downhill;
      - gravity and height difference;
      - flow rate;
      - intake;
      - penstock as a pressure pipe;
      - turbine;
      - generator;
      - tailrace or water leaving the plant;
      - why debris, closed valves, and leaks reduce power.
- [x] Add frequent images or diagrams. The lesson should feel illustrated, not
      like a textbook page.
- [x] Add short quiz questions throughout the lesson.
- [x] Keep the full lesson compact without player-facing time estimates.
- [x] Award the existing hydro knowledge/progression effects only after the
      player completes the lesson or required checks.
- [x] Test lesson selection, completion, idempotent awards, save/load, and
      return-to-map behavior.

**Exit criterion:** A new player can explain, in plain language, that water
falls or flows through a pipe, spins a turbine, turns a generator, and makes
electricity, and can connect that idea to the actions Zanzibar must perform.

### Wave 1 Addendum - Lesson Page/Frame Expansion

The beginner hydro rewrite needs more structure than the current flat
single-block section model. The holo-reader contract defines the target shape:
lessons contain pages, pages contain framed learning objects, and frames contain
ordered mixed content blocks such as paragraphs, images, diagrams, formulas, and
quiz frames.

Implementation sequence:

- [x] Extend the learning model to normalize both `pages` and legacy `sections`.
   Runtime content should prefer `pages` when present and mechanically wrap
   legacy sections into pages/frames for display.
- [x] Update `LessonRenderer` to render one page at a time, with Back/Next
   controls, page progress, and frames containing ordered blocks. Keep quiz
   completion behavior equivalent to the current all-required-checks model.
- [x] Update the Content Builder so authors can add, remove, reorder, and preview
   pages, frames, blocks, and quiz frames. Builder editing should expose
   multiple paragraph blocks inside one frame.
- [x] Migrate `hydro-power-intro-alpha` from many single-block sections into a
   shorter multi-page lesson with a few mixed-content frames per page.
- [ ] After authored learning content no longer uses legacy `sections`, remove the
   compatibility path in a later cleanup.

## Wave 2 - Laminated Instruction Card

**Purpose:** Turn the startup directions into a visual carried artifact.

The instruction card should temporarily replace the map viewing area, like the
holo-reader does, but with a different look: a laminated front-and-back card
that Zanzibar can inspect.

- [ ] Define an instruction-card focused view or document-style close-up.
- [ ] Let the card open from the authored instruction artifact or relevant
      story/action.
- [ ] Show the card large in the viewing area.
- [ ] Present a front side with the startup checklist:
      1. Clear debris and open the intake.
      2. Align the upstream/diversion valve.
      3. Open the turbine valve or powerhouse pipe valve.
      4. Return to the control room.
      5. Connect station power.
      6. Check the console.
- [ ] Present a back side with a mini-map of the hydro system.
- [ ] Use visual labels for the intake, valve locations, powerhouse, control
      room, and water path.
- [ ] Make the card an inventory/backpack item or confirm it is already
      represented as one.
- [ ] Keep card state separate from player progression; reading the card may
      set a flag, but the card itself should not directly repair equipment.
- [ ] Test opening, flipping, returning to map, carrying/access from inventory,
      save/load, and stale/missing content handling.

**Exit criterion:** Before doing field work, a player can inspect a visual
artifact that tells them what to do and where the hydro system pieces are.

## Wave 3 - Simplified Alpha Console

**Purpose:** Keep the control-room console useful without overwhelming a new
player.

The current console proves the technical loop, but alpha should reduce the
display to the few signals a beginner can act on.

- [ ] Review the current console layout after hands-on play.
- [ ] Identify which readouts are required for alpha and which should move to
      an advanced/details view.
- [ ] Keep a clear system status area:
      - station power online/offline;
      - intake ready/not ready;
      - valves ready/not ready;
      - generator online/offline;
      - next recommended action.
- [ ] Keep three core telemetry readings visible:
      - pressure;
      - turbine speed;
      - power output.
- [ ] Decide whether flow and net head stay visible in alpha or become
      expandable details.
- [ ] Reduce graph count if the console feels busy.
- [ ] Keep diagnostics in plain language.
- [ ] Keep historical report/event markers available, but make them secondary
      if they distract from startup.
- [ ] Test online/offline, missing prerequisites, warning/fault cases, return
      to map, and save/load while the console is open or recently closed.

**Exit criterion:** The console answers three beginner questions quickly:
`Is the station powered?`, `What is happening right now?`, and `What should I
do next?`

## Wave 4 - Storyline Mode and Open-World Mode

**Purpose:** Stop asking one interface to carry two incompatible experiences.

Open access to rooms, outdoor nodes, and many actions makes it too easy for a
player to lose the authored story thread. Alpha needs an explicit split:

- **Storyline mode** — the player is Zanzibar in the canonical story. Many
  actions, timings, and transitions may be forced or gated so the story remains
  coherent.
- **Open-world mode** — the player explores freely, defines their own goals,
  and tries to figure things out without following the canonical story.

### Storyline Mode Requirements

- [ ] Add an explicit mode selection or new-game choice.
- [ ] Decide whether storyline mode is the default for alpha.
- [ ] In storyline mode, gate or hide actions that would break the current
      narrative beat.
- [ ] Allow forced movement, forced time passage, and limited action sets where
      the story requires it.
- [ ] Show current objective or next story task clearly.
- [ ] Preserve Zanzibar's authored voice and canonical story beats.
- [ ] Prevent optional exploration from obscuring critical hydro startup steps.
- [ ] Test story progression through the hydro startup sequence with mode gates
      active.

### Open-World Mode Requirements

- [ ] Let open-world mode expose broad room, map, and action access.
- [ ] Keep safety rails for impossible or invalid state, but do not force the
      canonical story sequence.
- [ ] Make it clear that open-world mode is experimental/freeform and may not
      follow the authored narrative.
- [ ] Preserve save/load, inventory, flags, character state, and facility state.
- [ ] Test starting in open-world mode, switching if supported, and completing
      hydro startup out of story order if allowed.

**Exit criterion:** A player knows whether they are following Zanzibar's story
or freely experimenting, and the UI behavior matches that choice.

## Future Stage - Electrical Affordances

**Purpose:** Make station power matter broadly after alpha.

Once station power is online, anything electrical should have a consistent way
to express that it can be powered, switched, charged, plugged in, unplugged, or
otherwise used.

- [ ] Define a simple powered-object model for authored building/world items.
- [ ] Add actions such as `turn on`, `turn off`, `plug in`, `unplug`, and
      `charge` where appropriate.
- [ ] Decide which electrical objects are alpha-visible and which are later.
- [ ] Keep these affordances connected to facility state, not ad hoc flags.

## Future Stage - eBuggy Charging and Driving

**Purpose:** Make the buggy a key reward for restoring power.

Charging the eBuggy should open more of the hex map and eventually introduce a
vehicle dashboard or gauge panel.

- [ ] Define the eBuggy battery state.
- [ ] Add a charge action that depends on station power.
- [ ] Decide how charged range maps to hex movement.
- [ ] Add expanded reachable hexes once the buggy is charged.
- [ ] Create a first buggy gauge panel or close-up.
- [ ] Defer full driving simulation until after the alpha story loop is stable.

## Future Stage - AI Station Assistant

**Purpose:** Explore a control-room assistant without making it an alpha
dependency.

The idea of a chatbot or agent connected to the control-room console is
promising, but it should wait until the basic station model, console, and story
flow are stable.

- [ ] Define what the assistant can know: telemetry, event log, facility state,
      lesson content, and current objective.
- [ ] Define what the assistant cannot do: bypass field actions, mutate story
      state directly, or solve challenges without player consent.
- [ ] Prototype only after alpha needs are met.

## Future Stage - Part I Batteries and Hidden Storage

**Purpose:** Resolve the power-buffer story and simulation model.

The current hydro generator assumes a hidden battery/inverter buffer. Part I
needs an authored explanation for where those batteries are and how much they
matter.

- [ ] Decide the station battery location.
- [ ] Decide whether the battery bank is visible, hidden, or discovered later.
- [ ] Decide whether the eBuggy is one vehicle or part of a small fleet.
- [ ] Set rough battery capacities for the station buffer and buggy.
- [ ] Decide whether battery charge is simulated numerically in Part I or kept
      as coarse states.

## Future Stage - Close-Up Visuals for Hydro Actions

**Purpose:** Make field work tactile and place-specific.

Each hydro action would ideally open a close-up visual that temporarily
replaces the map:

- intake close-up for clearing debris and opening the intake;
- diversion/upstream valve close-up for turning the valve;
- pressure gauge and powerhouse pipe valve close-up;
- powerhouse/turbine peek showing spinning machinery and flowing water.

For alpha, still images plus story beats may be enough. Later, these can become
interactive close-ups with stateful controls.

- [ ] Choose a best-effort still-image approach for the first pass.
- [ ] Add close-up entry points from relevant actions or story beats.
- [ ] Keep field action effects host-owned and validated.
- [ ] Test opening/returning, action completion, repeated views, save/load, and
      missing asset handling.

## Alpha Acceptance Checklist

- [ ] A beginner-friendly hydro lesson exists and can be completed in roughly
      30 minutes.
- [ ] The lesson uses enough images/diagrams that the core idea is visible
      before it is technical.
- [ ] The instruction card opens as a visual focused view and includes a
      checklist plus mini-map.
- [ ] The instruction card can be carried or accessed from inventory/backpack.
- [ ] The console is simplified for alpha and gives a clear next action.
- [ ] The game explicitly supports storyline mode and open-world mode, or at
      minimum clearly gates alpha as storyline mode while marking free
      exploration separately.
- [ ] The hydro startup path works end to end in storyline mode.
- [ ] Save/load preserves lesson, card, mode, inventory, hydro facility state,
      and console behavior.
- [ ] `npm run test` passes from the repository root.

## Implementation Notes

- Keep authored lesson/card content in the canonical SQLite/content pipeline.
- Use generated or searched bitmap images for lesson and card visuals when
  helpful; avoid turning the beginner lesson into text-only exposition.
- Do not make builder support a prerequisite unless the content cannot be
  authored safely without it.
- Prefer a clear alpha path over a fully general system. Generalize only when a
  second or third concrete object proves the abstraction.
- Update tests and contracts when mode behavior changes story or action
  availability.
