# Holo-Reader Implementation Plan

**Status:** MVP implemented; Wave 2 ready  
**Last updated:** 2026-06-30  
**Primary contracts:** [Holo-Reader Lessons](../contracts/holo-reader.md), [Stage Views](../contracts/stage-views.md), [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md), [Story Beats](../contracts/story-beats.md)  
**Related plan:** [Close-Up Views Implementation Plan](close-up-views-implementation.md)

## Goal

Implement the first playable holo-reader slice in the `game/` app: the player
sits at the powered library holo-reader, chooses an introductory hydro lesson,
views the lesson in a dedicated full-game holo-reader view, answers a
retryable multiple-choice question, and receives lesson-completion credit plus
hydro knowledge in the character inventory.

The first slice also establishes the authored learning-content infrastructure
for future lessons. Authors should be able to add the next ordinary
holo-reader lesson through Content Builder and content data without adding new
runtime code. Later lessons may still require new registered interaction or
simulation components when they introduce a genuinely new activity type.

## Current Implementation Status

The MVP slice is implemented and playable.

- [x] Added canonical `learning-main` content in
      `game/content/atomic-adventures.sqlite`.
- [x] Added learning repository, migration, validation, JSON API, revision
      history, SSE update handling, import, and export support.
- [x] Exported production learning content to `/content/learning.json` during
      `npm run build:game`.
- [x] Added a **Lessons** area to `/builder/content`.
- [x] Added Story Builder support for choosing a lesson ID on
      `view.kind: lesson` choices.
- [x] Added a stand-level library `holo-reader` lesson browser action.
- [x] Gated the browser action on station power and authored lesson
      availability. The audited power flag is `hub.hydro_online`.
- [x] Added the full holo-reader game view below the persistent header.
- [x] Hid the map, active story beat, narrative card, and play panel while the
      lesson is open.
- [x] Preserved the player's logical location and returned to the library view
      on exit.
- [x] Added `hydro-power-intro` with title
      `Hydro Power, Water You Waiting For?`.
- [x] Added the key formula, symbols, worked examples, and a retryable
      multiple-choice quiz.
- [x] Cleared old quiz feedback when a new answer is selected.
- [x] Showed a certificate-style acknowledgement after the correct answer.
- [x] Added lesson completion state to player saves.
- [x] Applied completion effects through the existing character-effect service.
- [x] Advanced authored lesson time once and made replay idempotent.
- [x] Awarded `knowledge.acquire: hydro-head-and-flow` after passing the quiz.
- [x] Removed the separate `library-read-hydro` action so hydro learning now
      flows through the holo-reader lesson path.
- [x] Added Dev Tools Settings with a station-power override for testing.

Verification already run after the MVP:

```bash
npm run test
npm run build:game
```

## Deliberate Changes From The Original Plan

- Story-choice examples should use the current normalized shape:

  ```yaml
  choices:
    - text: Load Hydro Power, Water You Waiting For?
      view:
        kind: lesson
        id: hydro-power-intro
        source: library-holo-reader
  ```

  Story choice requirements are not part of the current story-choice schema,
  so power gating for the normal library path lives on the stand/browser
  availability path.

- Lesson progress currently stores `completedAt`. The original richer shape
  with `viewedAt` and per-assessment `passedAssessments` is deferred until it
  is needed by lesson analytics, multi-question lessons, or resume behavior.

- The first Content Builder Lessons editor is functional but not polished:
  complex fields such as sections, quiz, and completion effects are edited as
  JSON blocks. This is acceptable for the MVP but should improve before lesson
  authoring becomes routine.

- The lesson examples are currently authored text. The local tested hydro
  calculation helper from the `welcome` project has not yet been ported.

## Wave 2 - Lesson Content And Learning Quality

**Purpose:** Make the first lesson feel complete and educational rather than a
thin proof of concept.

- [x] Revisit `../welcome/content/simulators/hydro-power.md` and port the
      strongest explanatory material into `hydro-power-intro`.
- [x] Use `../welcome/app/components/simulators/HydroPowerSimulator.vue` for
      teaching scenarios: flow, gross head, head loss, efficiency, net head,
      and plant-style comparisons.
- [x] Keep the first lesson focused on the theory behind hydro power:
      gravitational potential energy, intake, penstock, turbine, generator,
      flow, net head, efficiency, and simple head-loss intuition.
- [x] Avoid detailed laminar/turbulent pipe-flow material in this intro lesson
      except for the simple idea that losses reduce `H_net`.
- [x] Add more worked examples that reinforce linear scaling with `Q`,
      `H_net`, and `eta`.
- [x] Consider changing the first quiz question to compare two setups with the
      same `Q * H_net`, as described in the original plan.
- [ ] Add accessible text for every formula, symbol table, and visual idea.

**Exit criterion:** The first hydro lesson can stand on its own as a short,
clear learning experience before the player uses hydro knowledge elsewhere.

## Wave 2 - Hydro Calculation Helper

**Purpose:** Avoid hard-coded arithmetic in lesson content and prepare for
future simulator-backed assessments.

- [x] Review `../welcome/utils/fluidMechanics.ts`.
- [x] Port the needed `hydraulicPowerWatts` or equivalent calculation into a
      local `game/` module.
- [x] Add unit tests for hydraulic power and electrical power calculations.
- [ ] Use the helper for authored example verification, quiz answer checks, or
      content validation where practical.
- [x] Keep the `welcome` project as source material only; do not add a runtime
      dependency on the sibling project.

**Exit criterion:** Hydro lesson examples and future quiz logic have a tested
local calculation boundary.

## Wave 2 - Content Builder Authoring Polish

**Purpose:** Make adding the next ordinary holo-reader lesson possible without
editing JSON by hand.

- [ ] Replace raw JSON editing for lesson sections with structured controls
      for section type, title, text, formula, symbol rows, and worked examples.
- [ ] Replace raw JSON editing for quiz questions with structured controls for
      prompt, answer options, correct answer, and feedback.
- [ ] Replace raw JSON editing for completion effects with a reusable
      character-effects editor or a lesson-specific wrapper around it.
- [ ] Add structured controls for lesson availability requirements, including
      required flags and required knowledge.
- [ ] Add a lesson preview inside Content Builder that renders the lesson with
      the same renderer used by the game view.
- [ ] Improve validation messages so authors can fix malformed lesson content
      without inspecting raw JSON paths.

**Exit criterion:** A second ordinary lesson can be authored, previewed,
validated, saved, and launched without code changes or hand-written JSON.

## Wave 2 - Validation And Cross-References

**Purpose:** Surface broken lesson references during authoring, not during
play.

- [x] Validate story-choice `view.kind: lesson` IDs against `learning-main`.
- [ ] Add reference search from lesson completion effects to character
      knowledge and other character catalogs.
- [ ] Add reference search from story choices to lessons.
- [x] Reject missing lesson IDs, missing knowledge IDs, malformed assessments,
      unscorable answers, and invalid completion effects.
- [x] Add tests for story lesson references and lesson completion effect
      references.

**Exit criterion:** Missing or stale lesson references are caught in server
validation and authoring workflows.

## Wave 2 - Holo-Reader UI Tests And Polish

**Purpose:** Lock down the behavior the player now exercises manually.

- [ ] Component test `HoloReaderView` with the intro lesson.
- [ ] Test that selecting a new answer clears prior feedback.
- [ ] Test that wrong answers do not grant knowledge.
- [ ] Test that correct answers show the certificate/finish affordance.
- [ ] Integration test that power-off state prevents the browser action at the
      `holo-reader` stand.
- [ ] Integration test opening the lesson browser from powered `holo-reader`.
- [ ] Integration test selecting `hydro-power-intro` from the browser.
- [ ] Integration test exiting before completion starts the lesson from the
      beginning on the next attempt.
- [ ] Integration test exiting after completion returns to the same library
      location.
- [ ] Consider a lightweight progress indicator or section navigation if the
      enriched lesson becomes long enough to need it.

**Exit criterion:** Holo-reader behavior is covered by tests rather than only
manual playthrough.

## Wave 2 - Lesson Progress Shape

**Purpose:** Decide whether the MVP `completedAt` state is enough for near-term
gameplay.

- [ ] Decide whether to add `viewedAt`.
- [ ] Decide whether to add per-assessment pass records:

  ```js
  {
    lessons: {
      "hydro-power-intro": {
        viewedAt: "...",
        completedAt: "...",
        passedAssessments: {
          "double-flow": {
            passedAt: "..."
          }
        }
      }
    }
  }
  ```

- [ ] If added, migrate save state carefully and keep wrong attempts
      transient.
- [ ] Keep completion idempotent: replaying the lesson must not repeatedly
      spend time or duplicate awards.

**Exit criterion:** Lesson progress state is shaped intentionally for the next
set of lessons rather than prematurely over-modeled.

## Done Criteria For Wave 2

- [x] The hydro intro lesson is richer and uses the welcome prototype as source
      material.
- [x] Hydro calculations have a tested local helper or an explicit decision is
      recorded to defer it.
- [ ] Content Builder can author normal lessons with structured controls.
- [x] Lesson reference validation catches stale story and completion-effect
      references.
- [ ] Holo-reader UI behavior has component and integration coverage.
- [ ] `npm run test` passes.
- [ ] `npm run build:game` passes.

## Notes For Future Waves

- Later lessons may embed simulations or other registered interaction
  components. Those should be added as explicit lesson section/activity types
  rather than ad hoc fields inside the first hydro lesson schema.
- Dev Tools Settings are development-only and are intended for testing state
  such as station power. They must remain absent from production builds.
- Keep lesson definitions separate from player progress. `learning-main` is
  authored content; lesson completion and acquired knowledge are playthrough
  state.
