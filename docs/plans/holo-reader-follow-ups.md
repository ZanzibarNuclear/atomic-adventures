# Holo-Reader Follow-Ups

**Status:** Partially implemented; validation-warning work remains  
**Last updated:** 2026-07-07  
**Primary contract:** [Holo-Reader Lessons](../contracts/holo-reader.md)

## Goal

Keep the holo-reader moving from a functional MVP toward a richer learning
surface without overbuilding speculative systems. The current slice gates
published lessons through the powered library holo-reader, renders the selected
lesson in the primary stage, checks retryable multiple-choice questions, shows a
certificate-style acknowledgement, commits `completedAt`, and applies completion
effects idempotently.

The first two follow-up tracks have mostly landed: the hydro lessons now use
authored pages, frames, images, diagrams, formulas, and quiz frames, and the
runtime requires all authored quiz questions to pass before lesson completion.
The remaining useful work is author-facing validation warnings and any future
completion-rule expansion only when richer lesson shapes demand it.

## Current Baseline

- `learning-main` is canonical lesson content in SQLite.
- `/builder/content` includes a Lessons area with structured controls for the
  implemented lesson schema.
- The runtime supports paged lessons with content and quiz frames.
- Content blocks include `paragraph`, `formula`, `symbols`, `examples`,
  `diagram`, and `image`.
- The runtime supports retryable `multiple-choice` quiz questions across pages
  and requires all authored questions to pass before emitting completion.
- Player lesson progress stores only `completedAt`.
- Completion is real: the player receives the certificate after passing the
  quiz, and `completeLesson` applies effects plus time once.

## Implementation Audit - 2026-07-07

Legend: `[x]` implemented, `[~]` partially implemented, `[ ]` not yet implemented.

### Implemented

- `game/server/learning-model.js` normalizes authored `pages`, `frames`,
  content blocks, quiz frames, and completion effects.
- `game/src/components/learning/LessonRenderer.vue` renders one page at a time
  with Back/Next controls, mixed content blocks, image captions, diagram steps,
  and quiz frames.
- `LessonRenderer` tracks selected answers and feedback per question, resets
  transient state when the lesson changes, and emits `pass-quiz` only after all
  authored quiz questions are correct.
- `/builder/content` includes a Lessons workspace that can add, remove, reorder,
  edit, save, and preview lesson pages, frames, blocks, questions, options, and
  completion effects.
- `hydro-power-stream-to-socket` is a beginner-oriented, illustrated,
  multi-page hydro lesson with images, a diagram, and three quiz questions.
  The original `hydro-power-intro` has also been upgraded to authored pages.
- Tests cover the seeded lessons, page/frame rendering, image and diagram
  blocks, multi-question completion, completion idempotency, saved lesson
  progress, and holo-reader selection/return behavior.

### Partially Implemented

- Duplicate IDs are validated for lessons, pages within the document, frames
  within a page, and answer options within a question. The runtime still keys
  quiz state by `question.id`, so duplicate question IDs across different quiz
  frames in the same lesson should be validated before broader authoring.
- The plan originally said `hydro-power-intro` should receive the visual model.
  The beginner-facing visual treatment now lives primarily in
  `hydro-power-stream-to-socket`, while `hydro-power-intro` remains as a more
  technical lesson upgraded to the same page/frame schema.

### Not Yet Implemented

- `validateLearningDocument` still returns `warnings: []`.
- Content Builder can display warnings returned by the API, but the learning
  model does not yet generate the author-quality warnings listed in Wave 3.
- No explicit completion-rule shape has been added. That remains intentional
  until optional quiz groups, simulator-backed outcomes, repeatable rewards, or
  non-quiz completion actions require it.

## Wave 1 - Hydro Lesson Visual Model

**Purpose:** Make the first lesson less word-heavy and better matched to the
holo-reader fiction.

- [x] Decide whether to port a static visual from the `../welcome` hydro
      simulator or create a new Atomic Adventures-specific model of the
      library lesson scenario.
- [x] Add a registered visual asset for the hydro path: intake, penstock,
      turbine, generator, tailrace, gross head, losses, and net head.
- [x] Extend lesson content with a visual section that includes a caption or
      text description so the concept does not depend on sight alone.
- [x] If the visual needs a new `diagram` section type, add the schema,
      renderer, builder controls, and validation together.
- [x] Keep production deployment static: the asset must be committed under
      `game/` and included in Vite/public output without relying on the local
      authoring server.

**Exit criterion:** A beginner hydro lesson includes a clear visual model of the
hydro path and remains accessible through text and caption content.

**Implemented:** The beginner visual model is implemented in
`hydro-power-stream-to-socket` with committed image assets, authored captions,
and a `diagram` block for the water-to-generator path. `hydro-power-intro` has
also been migrated to pages and mixed content, but the beginner lesson is now
the primary player-facing visual slice.

## Wave 2 - Multiple Quiz Questions

**Purpose:** Make runtime behavior match Content Builder authoring.

- [x] Update `LessonRenderer` to render all authored quiz questions in
      order.
- [x] Track transient selected-answer and feedback state per question while the
      lesson is open.
- [x] Require all questions to be answered correctly before emitting
      `pass-quiz`.
- [x] Keep wrong attempts transient and retryable.
- [x] Keep replay idempotent: completed lessons should still show completion
      affordances without reapplying effects or spending time.
- [x] Add component tests for two-question lessons, mixed wrong/right attempts,
      and completion after all questions pass.
- [~] Add builder/model validation for duplicate quiz IDs and duplicate answer
      option IDs per question.

**Exit criterion:** Authors can add a second ordinary multiple-choice question
without runtime code changes.

**Implemented:** `LessonRenderer` now completes only after every authored quiz
question across pages is answered correctly, and component tests cover multiple
questions and retry behavior. Duplicate answer option IDs are validated per
question. Remaining validation work: reject duplicate question IDs across a
lesson, since runtime answer state is keyed by question ID.

## Wave 3 - Validation Warnings

**Purpose:** Help authors catch weak or incomplete lesson content before play.

- [ ] Return meaningful warnings from `validateLearningDocument` instead of an
      empty array.
- [ ] Warn when a lesson has no completion effects and no visible progress
      reward.
- [ ] Warn when completion effects exist but no quiz or explicit completion
      path exists.
- [ ] Warn when a long lesson has no section navigation or too few section
      breaks.
- [ ] Warn when a visual or media section lacks a caption, transcript, or text
      alternative after those section types are introduced.
- [ ] Surface warnings clearly in the Content Builder Lessons area.
- [ ] Add tests for warning generation and UI display.

**Exit criterion:** Lesson validation distinguishes blocking errors from author
quality warnings and displays both in Content Builder.

## Wave 4 - Completion Rules When Needed

**Purpose:** Avoid prematurely over-modeling completion while leaving a clean
path for richer lessons.

The current completion behavior is intentionally simple: passing all authored
quiz questions triggers the certificate-style acknowledgement and calls
`completeLesson`. That is enough for the current hydro lessons.

Add an explicit completion-rule shape only when one of these becomes true:

- a lesson has multiple quiz groups and only some are required;
- a lesson has optional review questions;
- a lesson uses a registered interaction or simulator-backed outcome;
- a lesson needs repeatable rewards or a non-quiz completion action.

Candidate future shape:

```yaml
completion:
  mode: quiz
  requireAllQuizQuestions: true
  awardTitle: Hydro Power Theory
  awardText: Zanzibar understands how head, flow, and efficiency combine.
  effects:
    - { op: knowledge.acquire, id: hydro-head-and-flow }
```

Do not add `viewedAt`, `discoveredAt`, or per-assessment pass records until
gameplay, analytics, resume behavior, or partial completion actually needs
them.

**Exit criterion:** The completion model grows only when it removes real
ambiguity from authored lessons.

## Verification

For each implementation wave:

```bash
npm run test
npm run build:game
```

For changes touching lesson visuals or player-facing holo-reader layout, also
manually play the powered library holo-reader path and confirm exiting returns
to the library stand.
