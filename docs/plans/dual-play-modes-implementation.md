# Dual Play Modes Implementation Plan

**Status:** In progress
**Last updated:** 2026-07-06
**Primary contracts:** [Play Modes and Storyline Control](../contracts/play-modes-and-storyline.md), [Story Beats](../contracts/story-beats.md), [Character Wellbeing](../contracts/character-wellbeing.md), [Stage Views](../contracts/stage-views.md), [World Authoring](../contracts/world-authoring.md), [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md)
**Related alpha plan:** [Getting to Alpha](getting-to-alpha.md)

## Goal

Replace the hybrid beat-driven experience with two explicit play promises:

- **Story mode**: the player experiences Zanzibar's canonical Part I story
  from inside his point of view. The UI keeps plausible next actions visible
  without labeling the canonical path, objectives reflect Zanzibar's immediate internal concern, and
  storyline beats preserve discovery order.
- **Open-world mode**: the player explores freely as a player-authored run.
  The game uses general area descriptions and broad action access while still
  honoring world, facility, inventory, character, and wellbeing rules.

This plan supersedes the earlier "restrict every action to the current step"
interpretation. Story mode guides through prompts, beats, objectives, and
consequences; it should not remove ordinary movement when the world says the
movement is physically valid.

## Clarified Storyline Shape

Part I opens before the player knows what the game contains. Zanzibar is lost
in the forest; the path he followed disappeared hours ago, maybe days ago. He is
hungry, thirsty, and moving by instinct.

The first objective is:

```text
Keep moving. Find something that can help you survive.
```

The initial canonical arc is:

1. Move generally west, perpendicular to the mountain slope.
2. Reach the fence and discover it as an obstacle.
3. Choose a direction along the fence.
4. Noncanonical shortcut: go downslope, search the fence, and find a hole.
5. Canonical path: go upslope to a corner, then west to the gate.
6. Figure out how to open the gate.
7. Follow the road and discover the utility station.
8. Explore around the building.
9. Break in through the side garage door.
10. Discover the eBuggy, stairs, conference room, kitchen, food, and water
    purifier.
11. Resolve the first survival crisis.
12. Shift the objective to understanding what the building is for.
13. Shift later to restoring power and completing hydro startup.

## Current Problem

The first pass split mode state and added a scenario controller, but it leaned
too far toward gating. In Story mode, the initial objective named a distant
unknown destination and the action policy hid the ordinary movement action list,
even though map clicks still worked. That is not the intended player
experience.

The corrected model:

- Storyline objectives are internal, near-term, and intentionally mysterious.
- Storyline beats use Zanzibar's voice and canonical discovery order.
- Open-world beats are neutral area descriptions and player-authored discovery
  prompts.
- Story mode keeps plausible story-continuing or story-returning actions visible
  when physically available, but presents them like ordinary movement and actions.
- Ordinary movement remains available in Story mode.
- Wandering and detours are allowed, but time and wellbeing make them matter.

## Target Architecture

```txt
new game mode selection
  -> gameState.playMode
  -> useStoryline() when playMode === "story"
  -> current objective + action policy
  -> play panel merges authored prompts with ordinary movement/actions
  -> useStory() filters beats by mode and active step
  -> wellbeing/time systems apply pressure in both modes
```

In Story mode:

- the active step provides Zanzibar's current internal objective;
- storyline-scoped beats supply canonical prose;
- story-continuing movement/actions are not visually distinguished in the play panel;
- ordinary movement remains available when physically valid;
- nonmovement actions that reveal or mutate future story state can still be
  gated by step policy;
- excessive wandering can create wellbeing consequences.

In Open-world mode:

- the storyline controller is inactive;
- no canonical objective is shown;
- open-world beats describe places and systems without assuming Zanzibar's
  canonical arc;
- ordinary world/facility/character/inventory/wellbeing rules determine action
  visibility and consequences.

## Phase 1 - Contracts and Content Shape

**Purpose:** Align the written model with the clarified Storyline/Open-world
split.

- [x] Add [Play Modes and Storyline Control](../contracts/play-modes-and-storyline.md).
- [x] Revise [Story Beats](../contracts/story-beats.md) so beats support mode
      scoping but do not own sequencing.
- [x] Add a scenario content shape to the server-side model layer.
- [x] Store scenario content as the coarse `storyline-main` document.
- [x] Export scenarios to production runtime JSON.
- [x] Add scenario references to content-reference validation.
- [x] Revise the contracts so Story mode guides by prompts and prose rather
      than default movement restriction.
- [x] Document alpha survival pressure in
      [Character Wellbeing](../contracts/character-wellbeing.md).

**Exit criterion:** The content model can represent Zanzibar's opening survival
arc and hydro startup without overloading beat conditions or hiding ordinary
movement.

## Phase 2 - Save State and Mode Selection

**Purpose:** Let a new playthrough explicitly choose its promise.

- [x] Add `playMode` and inactive/active `storyline` state to
      `useGameState.js` snapshots.
- [x] Bump the save version and normalize older saves to the alpha default.
- [x] Add a new-game mode selection surface before normal play begins.
- [x] Make Story mode the default highlighted choice for alpha.
- [x] Label Open-world mode as freeform/experimental.
- [x] Keep existing save/load, clear save, and reset flows coherent with mode
      state.
- [x] Do not support open-world-to-storyline switching for alpha.

**Exit criterion:** A fresh alpha player chooses a mode, and save/load restores
that mode.

## Phase 3 - Storyline Controller

**Purpose:** Move canonical sequencing out of beats while preserving mystery and
player freedom.

- [x] Implement scenario loading through the content API and production JSON.
- [x] Add `useStoryline()` to resolve the active scenario, active step,
      objective, completion state, and next step.
- [x] Implement typed completion predicates for alpha:
      `flag`, `facility`, `location`, `holding`, and `lesson`.
- [x] Implement `onEnter` and `onComplete` effects for:
      flag effects, validated character/inventory effects, stage views, forced
      movement, and time passage.
- [x] Re-evaluate step completion when flags, facilities, inventory, lessons,
      clock, or location change.
- [x] Persist completed step IDs and current step ID.
- [x] Surface authoring errors clearly in development when the active step is
      missing or invalid.
- [x] Rename or reshape the alpha scenario from hydro-only startup to the full
      Part I survival-to-power arc.
- [x] Replace the opening objective with
      `Keep moving. Find something that can help you survive.`
- [x] Add early steps for forest movement, fence discovery, shortcut/gate
      branches, road discovery, station discovery, break-in, kitchen discovery,
      and first-crisis completion.
- [x] Keep hydro startup as the later "turn the power back on" objective arc.

**Exit criterion:** Storyline steps advance from immediate survival through
building discovery and then hydro startup without naming future discoveries too
early.

## Phase 4 - Story-Forward Action Policy

**Purpose:** Keep the story path visible without turning Story mode into
rails.

- [x] Define a normalized action identity scheme for movement, story choices,
      stage views, pickups, item actions, room actions, doors, switches,
      passages, searches, and map transitions.
- [x] Have `useStoryline()` produce an action policy for the current step.
- [x] Filter play-panel actions through the policy in Story mode.
- [x] Block stage-view and item-action bypasses through the same policy.
- [x] Change Storyline movement handling so ordinary movement actions remain
      visible when physically valid.
- [x] Keep story-continuing actions available without visually emphasizing the
      canonical path or suppressing valid detours.
- [x] Ensure a Storyline step always exposes at least one plausible
      story-continuing action when the player is at a valid story location.
- [x] Let known curiosity actions remain visible when they do not reveal future
      discoveries.
- [x] Gate only nonmovement or story-sensitive actions that would reveal,
      complete, or mutate future story state out of order.
- [x] Keep shell actions such as save/load, return-to-map, character/status,
      inventory inspection, and development diagnostics available according to
      contract rules.
- [x] Verify that storyline policy cannot bypass ordinary movement, door,
      holder, inventory, facility, or wellbeing rules.

**Exit criterion:** Story mode shows authored choices, ordinary movement, and
bounded curiosity as one neutral action set while preserving physical freedom
and consequences.

## Phase 5 - Beat Mode Scoping and Prose Migration

**Purpose:** Separate Zanzibar's canonical voice from open-world descriptions.

- [x] Add `modes` and `storylineStep` to beat import/export and Story Builder
      editing.
- [x] Add `modes` and `storylineStep` to beat normalization, validation, and
      runtime projection.
- [x] Update `useStory()` to filter beats by `gameState.playMode` and the
      active storyline step.
- [x] Let a storyline step select or prefer a beat by ID.
- [x] Audit opening forest, fence, gate, road, station, and hydro beats.
- [x] Move canonical Zanzibar prose into `modes: [story]` beats.
- [x] Add or revise `modes: [open-world]` area descriptions that do not assume
      Zanzibar's canonical story.
- [x] Preserve authored choice labels such as cardinal movement and story hints
      as neutral actions in Story mode.
- [x] Remove content patterns where a beat choice is the only thing preventing
      a story-breaking action.

**Exit criterion:** Storyline prose and open-world prose can coexist at the same
locations without competing for the same trigger or revealing unknown future
content.

## Phase 6 - Objective, Mode, and Consequence UI

**Purpose:** Make the mode clear and make the current concern feel like
Zanzibar's thought, not a quest spoiler.

- [x] Show the current mode in the game UI.
- [x] Show the current storyline objective prominently in Story mode.
- [x] Do not show a canonical objective in Open-world mode.
- [x] Ensure focused stage views such as the instruction card, holo-reader, and
      console do not hide the objective in a confusing way.
- [x] Keep the narrative card for prose; use objective UI for "what matters
      right now."
- [x] Revise objective copy to be internal and knowledge-limited.
- [x] Ensure early objectives never name the utility station, eBuggy, hydro
      system, startup card, or kitchen before discovery.
- [x] Surface wellbeing warnings clearly when wandering or strenuous actions
      push Zanzibar toward thirst, hunger, exhaustion, collapse, or death.
- [x] Add a simple failure/retry presentation for catastrophic vitals.

**Exit criterion:** A new player can tell they are in Zanzibar's story, knows
what matters immediately, and is warned when survival pressure becomes serious.

## Phase 7 - Alpha Survival Pressure

**Purpose:** Make the opening survival premise mechanically real enough for
alpha.

- [ ] Confirm movement and authored actions consistently advance time with an
      activity profile.
- [ ] Tune hydration, satiety, and energy drift for early Part I travel.
- [ ] Add or verify thresholds for warning, serious impairment, collapse, and
      failure.
- [ ] Ensure canonical progress to food/water is tense but survivable.
- [ ] Ensure repeated wandering or walking in circles can produce serious
      consequences.
- [ ] Connect food, water purification, and rest to resolving the first crisis.
- [ ] Add tests for time/wellbeing drift during repeated movement.

**Exit criterion:** The first objective has stakes: exploration is allowed, but
time and vitals matter.

## Phase 8 - Builder Support

**Purpose:** Make scenario and mode-scoped prose authoring maintainable.

- [x] Add a Scenario panel to `/builder/story`.
- [x] Support scenario metadata, ordered steps, internal objective text,
      associated beat, story-continuing actions, optional actions, completion
      predicates, forced effects, and next step.
- [ ] Provide selectors for hexes, rooms, exterior nodes, transitions, stage
      views, items, item actions, lessons, documents, and facility predicates.
      Hexes, rooms, exterior nodes, transitions, stage views, items, lessons,
      and documents now have structured controls; item-action and facility
      predicate authoring still need richer selectors beyond ID/JSON fields.
- [x] Add a step preview that shows story-continuing actions, optional actions,
      and ordinary available movement as one player-facing action set.
- [x] Add `modes` and `storylineStep` editing to Story Builder beat forms.
- [x] Add reference-aware rename and delete handling for storyline references
      in Story Builder, World Builder, and Content Builder.
- [ ] Show "referenced by storyline step" in relevant object detail panels.
      Rename/delete prompts now name storyline scenario and step references;
      persistent object detail panels can still add the same reference list.

**Exit criterion:** Authors can maintain the opening story arc and hydro arc
without manually copying IDs or hiding story logic in prose.

## Phase 9 - Hydro Startup Migration

**Purpose:** Keep the hydro startup path, but place it after survival and
discovery.

- [x] Create `part-i-opener` as the initial wilderness scenario and
      `part-i-station` as the follow-on station scenario.
- [x] Add hydro steps for reading the startup card, inspecting the intake,
      clear/open intake, align diversion valve, open turbine valve, return to
      control room, connect power, check console, and complete startup.
- [x] Rename/reframe the scenario as the broader Part I storyline or split the
      hydro startup into a later sub-arc.
- [ ] Move hydro startup beat prose into storyline-scoped step beats or
      open-world ambient/discovery beats.
- [ ] Verify the laminated card, beginner lesson, simplified console, inventory,
      and facility state still work in both modes after the new opening arc.

**Exit criterion:** Hydro startup remains a guided canonical sequence in
Story mode and a freeform experiment in Open-world mode, but it no longer
acts as the opening objective.

## Phase 10 - Tests and Browser Verification

**Purpose:** Lock down the split before building more content on it.

- [x] Unit test mode normalization, save/load, and reset behavior.
- [x] Unit test storyline step selection, completion predicates, forced effects,
      and missing-content diagnostics.
- [x] Unit test beat filtering by `modes` and `storylineStep`.
- [x] Unit test action-policy filtering for play-panel actions.
- [x] Regression test that both play-mode choices render the playable scene.
- [x] Smoke test guided hydro startup with storyline gates active.
- [x] Smoke test open-world startup with broad actions and valid out-of-order
      completion.
- [x] Add Playwright-based browser smoke visibility for local dev.
- [ ] Add browser coverage that Story mode shows story-continuing movement
      actions from the opening location without visual emphasis.
- [ ] Add browser coverage that Story mode permits valid detours while
      keeping the internal objective.
- [ ] Add browser coverage for the noncanonical fence-hole shortcut.
- [ ] Add browser coverage for the canonical gate-to-station path.
- [ ] Add tests for survival consequences from excessive wandering.
- [ ] Run `npm run test` and `npm run build:game` before finishing each
      implementation pass.

**Exit criterion:** Both modes are covered at the state, prose, action,
wellbeing, hydro journey, and browser-smoke levels.

## Deferred

These are deliberately not alpha requirements:

- switching an arbitrary open-world save back into Storyline;
- multiple simultaneous storylines;
- branching scenario graphs beyond the Part I opening shortcut shape;
- general boolean scripting for step conditions;
- AI-assisted station operation;
- full electrical-system modeling;
- account-wide progression or cross-device saves.
