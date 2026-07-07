# Story Mode Model Migration Plan

**Status:** Proposed
**Last updated:** 2026-07-07
**Primary design:** [Story Mode Technical Design](story-mode-technical-design.md)
**Impacted areas:** playable game, Story Builder, content API, SQLite content,
runtime JSON exports, tests, contracts

## Goal

Move the current Story mode implementation into the condensed model described
in [Story Mode Technical Design](story-mode-technical-design.md):

- `Scenario` becomes `StoryArc`.
- Current `Step` becomes `StoryBeat`.
- Current prose-focused `StoryBeat` becomes `Scene`.
- Story mode uses one controller, `useStoryArc`, instead of split progression
  and prose controllers.
- Policy objects collapse into beat-authored actions, engine-provided possible
  actions, and helper functions.

This should happen over multiple safe sessions. Keep the game playable after
each phase.

## Ground Rules

- Do not preserve old terminology as permanent compatibility concepts.
- Use compatibility shims only as temporary migration scaffolding.
- Keep canonical authored content in `game/content/atomic-adventures.sqlite`.
- Update tests, fixtures, contracts, builder labels, and exported JSON as terms
  change.
- Run `npm run test` after meaningful runtime, movement, story, or builder
  changes.
- Prefer proving the new runtime model before migrating all builder UI and
  SQLite field names.

## Phase 0 - Confirm Target Decisions

**Purpose:** Record the settled design decisions before changing storage.

- [x] Choices live on `StoryBeat`; `Scene` owns prose variants.
- [x] Story mode combines beat-authored actions with engine-provided possible
      actions. The engine remains the final guard rail for physical possibility.
- [x] Significant actions produce meaningful state changes or milestones. Most
      actions are ordinary history, not completion events.
- [x] Do not lock the model to one fixed Part I arc boundary. The current arc is
      named "Part I Opener," and Story Builder must support trying different
      arc shapes.
- [x] `story` replaces `storyline` as the story-mode save key.
- [x] Do not track general action history at this time.
- [x] Track completed milestones as part of game state.
- [x] Story Builder should allow authors to change current story arcs. It does
      not need old-draft preservation or arc-comparison machinery.

**Exit criterion:** The design document has no unresolved naming or shape
questions that block implementation.

## Phase 1 - Contract Vocabulary

**Purpose:** Make the written target vocabulary clear before code moves.

- [x] Update `docs/contracts/play-modes-and-storyline.md` or replace it with a
      new Story mode contract that uses `StoryArc`, `StoryBeat`, and `Scene`.
- [x] Update `docs/contracts/story-beats.md` so the prose object is called
      `Scene`, not `StoryBeat`.
- [x] Update roadmap and planning references where they describe scenarios,
      steps, storyline, or objectives.
- [x] Explicitly document that the objective UI has been removed and that
      player guidance comes from scenes, choices, and visible actions.
- [x] Add a short note that open-world mode reuses scenes and world systems
      through a separate controller with fewer constraints.

**Exit criterion:** Docs describe the target model without requiring the reader
to understand the old split.

## Phase 2 - Runtime Normalization Layer

**Purpose:** Let old content load as the new shape without changing SQLite yet.

- [ ] Add a normalizer that maps current `storyline.scenarios` to `storyArcs`.
- [ ] Map current `scenario` fields to `StoryArc`.
- [ ] Map current `step` fields to `StoryBeat`.
- [ ] Map current story prose beats to `Scene` candidates.
- [ ] Preserve current scene selection criteria while moving them into a pure
      helper such as `selectSceneForBeat`.
- [ ] Add unit tests for old-shape input producing new-shape runtime data.
- [ ] Add tests for terminology edge cases: missing arc, missing beat, missing
      scene, stale next beat, stale next arc.
- [ ] Normalize existing `storyline` save state into the new `story` save key
      during save/load migration.
- [ ] Add milestone state to game-state normalization if it is not already
      represented by an existing durable field.

**Exit criterion:** Runtime can consume current exported content through the
new internal model.

## Phase 3 - Build useStoryArc Beside Existing Controllers

**Purpose:** Prove the single-controller model before deleting anything.

- [ ] Create `game/src/composables/useStoryArc.js`.
- [ ] Resolve active arc and active beat from normalized content and save state.
- [ ] Read and update milestone completion through game state.
- [ ] Apply beat enter effects once.
- [ ] Select active scene through the pure scene-selection helper.
- [ ] Build story actions from beat choices, beat-authored actions, and valid
      engine-provided world/system actions.
- [ ] Apply choices and story actions through the same movement/effects/stage
      view boundaries as today.
- [ ] Evaluate completion conditions and advance to `next` or `nextArc`.
- [ ] Expose one UI-facing object: `activeArc`, `activeBeat`, `activeScene`,
      `storyActions`, `applyStoryAction`, and `storyError`.
- [ ] Add focused tests for beat stability: ordinary movement should not
      advance the beat unless the completion condition is met.
- [ ] Add tests for scene variation within one beat.

**Exit criterion:** `useStoryArc` passes its own tests against the current Part
I content through the normalization layer.

## Phase 4 - Wire Story Mode Gameplay To useStoryArc

**Purpose:** Move the playable game to the new controller.

- [ ] Replace `useStoryline` and `useStory` usage in `GameView.vue` with
      `useStoryArc` for Story mode.
- [ ] Route StoryOverlay or its successor from `activeScene`.
- [ ] Route play-panel story choices/actions from `storyActions`.
- [ ] Keep ordinary outdoor and indoor movement governed by map/building rules.
- [ ] Keep stage views, inventory, vitals, developer tools, and save/load
      working.
- [ ] Confirm objective UI remains absent.
- [ ] Update gameplay tests in `game/src/views`, `game/src/composables`, and
      `game/src/lib/maps` to assert story beat/scene behavior instead of
      storyline step/objective behavior.
- [ ] Run `npm run test`.

**Exit criterion:** The playable Part I story path works through `useStoryArc`
with tests green.

## Phase 5 - Remove The Split Runtime

**Purpose:** Trim the parts that caused confusion.

- [ ] Delete or retire `useStoryline`.
- [ ] Delete or demote `useStory` to pure scene-selection helpers.
- [ ] Remove `ActionPolicy` as a named runtime model.
- [ ] Replace `AllowedPolicy` buckets with beat-authored actions and
      engine-provided possible actions where possible.
- [ ] Rename `CompletionPredicate` helpers to `CompletionCondition`.
- [ ] Rename `StepEffect` helpers to `BeatEffect`.
- [ ] Remove stale `storyline` terminology from runtime code and tests.
- [ ] Run `rg` for `scenario`, `step`, `storyline`, `objective`,
      `AllowedPolicy`, `ActionPolicy`, and `Predicate`; classify leftovers as
      either still-valid unrelated words or migration debt.
- [ ] Run `npm run test`.

**Exit criterion:** Story mode runtime code uses the new vocabulary and one
controller.

## Phase 6 - Story Builder Migration

**Purpose:** Make authoring match the new mental model.

- [ ] Rename Scenario panel to Story Arc panel.
- [ ] Rename scenario list, labels, buttons, validation messages, and tests.
- [ ] Rename Step editing UI to Story Beat editing UI.
- [ ] Move prose-scene authoring under each Story Beat.
- [ ] Let authors add, remove, reorder, and preview Scenes for a beat.
- [ ] Replace allowed-policy bucket editing with authored-action editing.
- [ ] Keep reference pickers for hexes, rooms, exterior nodes, transitions,
      items, lessons, documents, stage views, and indoor/outdoor actions.
- [ ] Replace completion predicate UI with completion condition UI.
- [ ] Replace step effect UI with beat effect UI.
- [ ] Add preview for "active beat + selected scene + visible actions."
- [ ] Keep Story Builder focused on editing current arcs and beats. Do not add
      old-draft comparison or preservation machinery.
- [ ] Run builder and repository tests.

**Exit criterion:** Story Builder authors arcs, beats, scenes, actions,
completion conditions, and beat effects without showing the old Step/Scenario
split.

## Phase 7 - Server, SQLite, Export, And API Names

**Purpose:** Move canonical content and API shapes after runtime and builder
behavior are proven.

- [ ] Add migration for canonical SQLite document shape if needed.
- [ ] Rename server model functions from storyline/scenario/step terms to
      story arc/beat/scene terms.
- [ ] Update validation errors to use author-facing new terms.
- [ ] Update `/api/storyline` route naming only if the route rename is worth the
      deployment/API churn; otherwise document it as a transport legacy until a
      later API cleanup.
- [ ] Update production export from `storyline.json` to a new name only if the
      runtime and deployment scripts are ready together.
- [ ] Update import/export commands if story arc snapshots become a separate
      export shape.
- [ ] Update tests for repository round-tripping, validation, and JSON export.
- [ ] Run `npm run test`.

**Exit criterion:** Canonical content, validation, and exported runtime JSON use
the new model or have explicitly documented temporary transport names.

## Phase 8 - Open-World Controller

**Purpose:** Reuse the new content pieces with fewer constraints.

- [ ] Define the open-world controller responsibilities after Story mode is
      stable.
- [ ] Reuse Scene selection for ambient descriptions.
- [ ] Reuse world, item, facility, stage-view, character, inventory, and effect
      boundaries.
- [ ] Avoid canonical active beat progression unless an explicit open-world
      activity needs it.
- [ ] Ensure open-world UI does not imply Zanzibar's authored canonical timing.
- [ ] Add open-world tests for broad access and ambient scene behavior.

**Exit criterion:** Open-world mode has its own controller and does not pull
Story mode back into split responsibilities.

## Phase 9 - Final Cleanup

**Purpose:** Remove migration scaffolding and old names.

- [ ] Delete compatibility normalization for old scenario/step content once
      SQLite and exported fixtures are migrated.
- [ ] Remove old fixtures and tests that preserve prior names.
- [ ] Remove comments that explain old terminology unless they are in migration
      history.
- [ ] Update all docs and quality checklists to current terms.
- [ ] Run full test suite.
- [ ] Do a browser pass through Story mode and Open-world mode.

**Exit criterion:** The codebase no longer contains the old model as a parallel
concept, and Story mode is understandable from docs, builder UI, content, and
runtime code.
