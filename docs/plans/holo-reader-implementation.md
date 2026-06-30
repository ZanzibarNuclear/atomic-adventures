# Holo-Reader Implementation Plan

**Status:** Ready for implementation  
**Last updated:** 2026-06-30  
**Primary contracts:** [Holo-Reader Lessons](../contracts/holo-reader.md), [Stage Views](../contracts/stage-views.md), [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md), [Story Beats](../contracts/story-beats.md)  
**Related plan:** [Close-Up Views Implementation Plan](close-up-views-implementation.md)

## Goal

Implement the first playable holo-reader slice in the `game/` app: the player
sits at the powered library holo-reader, chooses an introductory hydro lesson,
views the lesson in a dedicated full-game holo-reader view, answers a
retryable multiple-choice question, and receives lesson-completion credit plus
hydro knowledge in the character inventory.

The first slice should also put the content infrastructure in place for future
lessons. Once this is complete, authors should be able to add the next ordinary
holo-reader lesson through Content Builder and content data without adding new
runtime code. Later lessons may still require new registered interaction or
simulation components when they introduce a genuinely new activity type.

## Capability 1 - Learning Content Infrastructure

**Purpose:** Store, validate, edit, and reference lessons as authored learning
content instead of hard-coded game UI.

- [ ] Add a canonical `learning-main` content document in
      `game/content/atomic-adventures.sqlite`.
- [ ] Add server repository, migration, validation, JSON API, revision history,
      SSE update, import, and export support for `learning-main`, following the
      existing coarse-document pattern used by world, building, and character
      content.
- [ ] Export production learning content to `/content/learning.json` during
      `npm run build:game`.
- [ ] Add a **Lessons** area to `/builder/content` alongside Character,
      Artifacts, and Preview.
- [ ] Let authors create and edit lesson metadata, section order, text,
      formula blocks, symbol tables, worked examples, multiple-choice
      assessments, feedback, lesson duration, completion rules, and effects.
- [ ] Put lesson requirements in the same authoring pass as the lesson:
      external requirements such as a power-on flag and
      location/action context, plus internal requirements such as required
      assessment pass conditions.
- [ ] Let Story Builder choose a lesson ID from `learning-main` when authoring
      a lesson-loading choice.
- [ ] Validate cross-content references from story/world/content to lessons,
      and from lessons to character knowledge/effects.
- [ ] Reject missing lesson IDs, missing knowledge IDs, malformed assessments,
      unscorable answers, invalid completion effects, and lesson choices whose
      requirements cannot be evaluated.
- [ ] Keep lesson definitions separate from player progress. Lesson definitions
      are authored content; lesson completion and acquired knowledge are
      playthrough state.

**Exit criterion:** `learning-main` is editable in Content Builder and a second
ordinary lesson can be authored, referenced from a story choice, validated, and
loaded without writing runtime code.

## Capability 2 - Holo-Reader Lesson Browser and Launch Action

**Purpose:** Let the player browse available lesson titles when seated at the
library holo-reader, then launch a selected lesson.

- [ ] Add a stand-level action for the library `holo-reader` stand that opens a
      lesson browser.
- [ ] Gate the browser action on the facility/library power flag. Choose the
      exact flag ID during implementation after auditing existing power and
      facility-state naming.
- [ ] List available lesson titles from `learning-main`, filtered by authored
      lesson availability requirements.
- [ ] Let the player choose `Hydro Power, Water You Waiting For?` from the
      browser and launch `hydro-power-intro`.
- [ ] Keep the launch as a view action: selecting it does not move the player,
      clear the current location, or directly grant knowledge.
- [ ] Story choices may still open a specific lesson directly where useful,
      using the existing `view` choice pattern:

  ```yaml
  choices:
    - text: Load Hydro Power, Water You Waiting For?
      view:
        kind: lesson
        payload:
          lessonId: hydro-power-intro
          source: library-holo-reader
          mode: learn
      require:
        flags:
          all: [library-power-on]
  ```

- [ ] Validate that `lessonId` exists in `learning-main`. Missing lesson IDs
      are authoring/runtime errors that should be surfaced clearly during
      development and validation.

**Exit criterion:** Sitting at stand `holo-reader` with power available opens a
lesson browser, and selecting the authored intro lesson opens
`hydro-power-intro` by ID.

## Capability 3 - Full Holo-Reader View Mode

**Purpose:** Replace the ordinary game presentation with the chosen lesson
while the player is mentally immersed in the holo-reader.

- [ ] Add a player-facing `lesson` or `holo-reader` game-view renderer.
- [ ] When the lesson opens, replace the whole game area below the persistent
      header. The map, active story beat, narrative card, and play panel are
      hidden while the lesson is open.
- [ ] Preserve the player's logical location, room/stand, save state, and
      current story context so exiting the lesson restores the library.
- [ ] Provide an Exit Holo-Reader button at all times, including before lesson
      completion. Exiting returns to the map/story view around the character.
- [ ] Surface missing or invalid lesson references as errors, not as generic
      placeholder content.
- [ ] Keep transient lesson UI state, such as current section and selected
      answer, separate from committed lesson progress.
- [ ] If the player exits before completion, discard the transient lesson state.
      The next attempt starts from the beginning.

**Exit criterion:** Selecting the lesson choice swaps into a full holo-reader
view, and Exit Holo-Reader returns to the same library location without
movement or story-state loss.

## Capability 4 - First Intro Hydro Lesson

**Purpose:** Teach the simplest theory needed before the player uses or reasons
about hydro power.

- [ ] Create the first lesson definition with stable ID `hydro-power-intro`.
- [ ] Set the authored lesson title to
      `Hydro Power, Water You Waiting For?`.
- [ ] Set the default authored lesson duration to 30 in-game minutes.
- [ ] Use `../welcome/content/simulators/hydro-power.md` and
      `../welcome/app/components/simulators/HydroPowerSimulator.vue` as source
      material, rewritten for the game.
- [ ] Extract the formula and source wording from `hydro-power.md`, and extract
      the useful teaching scenarios from `HydroPowerSimulator.vue`: flow, gross
      head, head loss, efficiency, net head, and plant-style examples.
- [ ] Port the small `hydraulicPowerWatts` calculation from
      `../welcome/utils/fluidMechanics.ts` into a tested local game module for
      lesson examples and quiz answer checks.
- [ ] Use the `welcome` prototype as source material, not a runtime dependency:
      copied or adapted content should live in `game/` content, assets, or
      registered modules.
- [ ] Keep the lesson short and in-world. Suggested sections:

  1. Water at height stores gravitational potential energy.
  2. Water moves through an intake and penstock to a turbine.
  3. The turbine spins a generator.
  4. Usable power depends mostly on flow, net head, and efficiency.
  5. Head losses reduce the head that reaches the turbine.

- [ ] Present the key formula:

  ```text
  P_elec = eta * rho * g * Q * H_net
  ```

- [ ] Define the symbols:

  | Symbol | Meaning | Simple unit |
  | --- | --- | --- |
  | `P_elec` | Electrical power produced | watts |
  | `eta` | Overall efficiency from water to wires | fraction from 0 to 1 |
  | `rho` | Density of water | about 1000 kg/m3 |
  | `g` | Gravity | about 9.8 m/s2 |
  | `Q` | Flow through the turbine | m3/s |
  | `H_net` | Net head after losses | meters |

- [ ] Include a few simple worked examples:

  ```text
  Example A:
  eta = 0.8, rho = 1000, g = 9.8, Q = 1, H_net = 10
  P_elec = 0.8 * 1000 * 9.8 * 1 * 10 = 78,400 W, about 78 kW

  Example B:
  Same system, but Q doubles from 1 to 2 m3/s.
  P_elec doubles to about 157 kW.

  Example C:
  Same system, but H_net doubles from 10 to 20 m.
  P_elec doubles to about 157 kW.
  ```

- [ ] Avoid advanced pipe-flow material in this first lesson except for the
      simple idea that losses reduce `H_net`.
- [ ] Add an accessible text path for every formula, visual, or animated idea.

**Exit criterion:** The player can read the intro hydro lesson and understand
that flow and net head both scale electrical power.

## Capability 5 - Retryable Multiple-Choice Quiz

**Purpose:** Let the player demonstrate real understanding while treating wrong
answers as useful learning attempts.

- [ ] Add one multiple-choice assessment section to `hydro-power-intro`.
- [ ] Let the player answer, receive immediate feedback, and retry until the
      correct answer is selected.
- [ ] Do not persist wrong attempts. Wrong answers exist to teach in the moment,
      not to shame or score the player.
- [ ] Keep the player in the lesson after a wrong answer, showing feedback that
      points back to the concept rather than simply saying "wrong."
- [ ] Mark the assessment passed only when the correct answer is selected.
- [ ] Persist only the passing timestamp for the assessment or lesson.
- [ ] Do not grant completion effects before the passing answer.

Suggested first question:

```text
Two small hydro setups use the same water and the same efficiency.

Setup A: Q = 1 m3/s and H_net = 20 m
Setup B: Q = 2 m3/s and H_net = 10 m

Which setup produces more electrical power?
```

Choices:

| Choice | Feedback |
| --- | --- |
| A produces more | Not quite. A has twice the head, but only half the flow. |
| B produces more | Not quite. B has twice the flow, but only half the head. |
| They produce the same | Correct. In this formula, flow and net head multiply, so both setups have the same `Q * H_net`. |
| There is not enough information | The efficiency and water are the same, so comparing `Q * H_net` is enough here. |

**Exit criterion:** The quiz can be failed, retried, and passed, and only the
passing answer unlocks lesson completion.

## Capability 6 - Completion Credit and Knowledge Inventory

**Purpose:** Commit visible character progress after the player completes the
lesson.

- [ ] Add or confirm a knowledge definition:

  ```yaml
  knowledge:
    - id: hydro-head-and-flow
      label: Hydro Power, Water You Waiting For?
      description: Flow rate and net head combine with efficiency to determine hydroelectric power.
      group: hydro
      visible: when-acquired
      sourceLabel: Holo-reader lesson
  ```

- [ ] Define lesson completion effects:

  ```yaml
  completion:
    mode: assessment
    requireAssessment: hydro-power-intro-same-power
    durationMinutes: 30
    effects:
      - { op: knowledge.acquire, id: hydro-head-and-flow }
  ```

- [ ] Store lesson progress separately from authored lesson content:

  ```js
  {
    lessons: {
      "hydro-power-intro": {
        viewedAt: "...",
        completedAt: "...",
        passedAssessments: {
          "hydro-power-intro-same-power": {
            passedAt: "..."
          }
        }
      }
    }
  }
  ```

- [ ] Apply completion effects through the existing validated character effects
      service.
- [ ] Advance game time by the lesson's authored duration when completion is
      committed. Use 30 minutes as the default duration when the lesson does
      not specify one.
- [ ] Make completion idempotent: replaying the lesson or quiz does not
      duplicate one-time knowledge or repeatedly spend completion time.
- [ ] After completion, show an award/rejoin screen naming the acquired
      knowledge and offering a button to complete and return to the world.
- [ ] Show the acquired knowledge in the Character view's Knowledge tab.
- [ ] Allow future story choices, world actions, and simulations to require
      `knowledge: { all: [hydro-head-and-flow] }`.

**Exit criterion:** Passing the quiz records lesson completion, advances the
authored lesson time once, adds `hydro-head-and-flow` to the character's
knowledge inventory, and shows an award screen before returning to the world.

## Implementation Phases

### Phase 1 - Learning Content Document and Builder

- [ ] Add `learning-main` persistence, API, export/import, validation, revision
      history, and SSE update support.
- [ ] Add Content Builder lesson editing for metadata, sections, assessments,
      requirements, completion rules, effects, preview, and reference search.
- [ ] Add cross-content validation between learning, story, world, and
      character definitions.
- [ ] Add the `hydro-power-intro` lesson content and quiz to `learning-main`.

### Phase 2 - Choice Action and View Switch

- [ ] Add the power-gated action for stand `holo-reader` that opens the lesson
      browser.
- [ ] Wire lesson-browser selection and direct story choice `view.kind: lesson`
      to the game-view controller.
- [ ] Render a placeholder full-screen holo-reader shell for the selected
      lesson ID.
- [ ] Replace the whole game area below the header while the lesson is open.
- [ ] Restore the library map/story context on exit.
- [ ] Test invalid lesson references, power-off gating, and repeated open/close
      cycles.

### Phase 3 - Lesson Renderer

- [ ] Port the required hydro power calculation from the `welcome` helper into
      a local tested module.
- [ ] Render lesson title, summary, ordered sections, formula text, symbol
      table, and worked examples from `learning-main`.
- [ ] Keep the design focused and readable inside the full holo-reader view.
- [ ] Preserve keyboard navigation and text alternatives.
- [ ] Add a lightweight progress indicator if the lesson has multiple sections.

### Phase 4 - Assessment Flow

- [ ] Render the multiple-choice quiz from authored assessment data.
- [ ] Show feedback after each selected answer.
- [ ] Allow retry until correct.
- [ ] Keep wrong answers transient.
- [ ] Persist only the passed timestamp when the correct answer is selected.

### Phase 5 - Completion Effects

- [ ] Commit lesson progress and `knowledge.acquire` atomically after the quiz
      passes.
- [ ] Advance lesson completion time once.
- [ ] Show the award/rejoin screen and return button.
- [ ] Confirm replay is idempotent.
- [ ] Confirm the Character Knowledge tab shows `hydro-head-and-flow`.
- [ ] Add a requirement-evaluation test fixture showing that future content can
      require `hydro-head-and-flow`.

## Test Plan

- [ ] Unit test `learning-main` validation.
- [ ] Unit test cross-content validation for story lesson references and
      knowledge completion effects.
- [ ] Unit test quiz scoring, retry behavior, and non-persistence of wrong
      attempts.
- [ ] Unit test idempotent completion effects and one-time lesson duration.
- [ ] Component test the full holo-reader view with the intro lesson.
- [ ] Integration test opening the lesson browser from the power-gated
      `holo-reader` stand action.
- [ ] Integration test selecting `hydro-power-intro` from the browser.
- [ ] Integration test that power-off state prevents opening the lesson browser.
- [ ] Integration test exiting the holo-reader returns to the library without
      movement or story-state loss.
- [ ] Integration test exiting before completion starts the lesson from the
      beginning on the next attempt.
- [ ] Integration test that `hydro-head-and-flow` appears in character
      knowledge after passing the quiz.
- [ ] Regression test that wrong answers do not grant knowledge.

Before finishing implementation, run:

```bash
npm run test
```

## Implementation Research

- Choose the exact power-on flag ID by auditing current story, world, and
  facility-state naming during implementation. The examples use
  `library-power-on` as a placeholder.
- Confirm where stand `holo-reader` is defined and whether it already has an
  action surface suitable for the lesson browser.
- Review `../welcome/content/simulators/hydro-power.md`,
  `../welcome/app/components/simulators/HydroPowerSimulator.vue`, and
  `../welcome/utils/fluidMechanics.ts` immediately before implementation to
  extract the source formula, teaching scenarios, and calculation helper.

## Plan Review Notes

- The plan now uses the `welcome` prototype in three concrete ways: concept
  text from `hydro-power.md`, scenario/control ideas from
  `HydroPowerSimulator.vue`, and a testable power calculation from
  `fluidMechanics.ts`.
- The biggest implementation gap is the new stand-level lesson browser. The
  existing story choice `view` pattern can open a known lesson, but browsing
  lessons from a stand may need a small world/stand action surface or a
  reusable fixture-action hook.
- The second gap is production export and live content refresh for
  `learning-main`; this should be built with the same discipline as story,
  world, building, and character documents so lessons are not a separate
  hard-coded path.
- The third gap is deciding the local module boundary for hydro calculations.
  The first lesson only needs `P_elec = eta * rho * g * Q * H_net`, but putting
  that in a tested helper now will make later simulator-backed assessments less
  fragile.
