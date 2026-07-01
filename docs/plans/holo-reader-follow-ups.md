# Holo-Reader Follow-Ups

**Status:** Planned follow-up work after the implemented MVP  
**Last updated:** 2026-07-01  
**Primary contract:** [Holo-Reader Lessons](../contracts/holo-reader.md)

## Goal

Keep the holo-reader moving from a functional MVP toward a richer learning
surface without overbuilding speculative systems. The current slice already
loads `hydro-power-intro`, gates it through the powered library holo-reader,
checks a retryable multiple-choice answer, shows a certificate-style
acknowledgement, commits `completedAt`, advances authored time once, and applies
completion effects idempotently.

The next work should improve the lesson's visual teaching quality, make the
quiz renderer match the builder's ability to author more than one question, add
useful validation warnings, and prepare a completion-rule shape only when
multi-question or simulator-backed lessons require it.

## Current Baseline

- `learning-main` is canonical lesson content in SQLite.
- `/builder/content` includes a Lessons area with structured controls for the
  implemented lesson schema.
- The runtime supports `text`, `formula`, `symbols`, and `examples` section
  types.
- The runtime supports top-level retryable `multiple-choice` quiz questions,
  but currently renders only the first question.
- Player lesson progress stores only `completedAt`.
- Completion is real: the player receives the certificate after passing the
  quiz, and `completeLesson` applies effects plus time once.

## Wave 1 - Hydro Lesson Visual Model

**Purpose:** Make the first lesson less word-heavy and better matched to the
holo-reader fiction.

- [ ] Decide whether to port a static visual from the `../welcome` hydro
      simulator or create a new Atomic Adventures-specific model of the
      library lesson scenario.
- [ ] Add a registered visual asset for the hydro path: intake, penstock,
      turbine, generator, tailrace, gross head, losses, and net head.
- [ ] Extend lesson content with a visual section that includes a caption or
      text description so the concept does not depend on sight alone.
- [ ] If the visual needs a new `diagram` section type, add the schema,
      renderer, builder controls, and validation together.
- [ ] Keep production deployment static: the asset must be committed under
      `game/` and included in Vite/public output without relying on the local
      authoring server.

**Exit criterion:** `hydro-power-intro` includes a clear visual model of the
hydro path and remains accessible through text and caption content.

## Wave 2 - Multiple Quiz Questions

**Purpose:** Make runtime behavior match Content Builder authoring.

- [ ] Update `LessonRenderer` to render all authored `lesson.quiz` questions in
      order.
- [ ] Track transient selected-answer and feedback state per question while the
      lesson is open.
- [ ] Require all questions to be answered correctly before emitting
      `pass-quiz`.
- [ ] Keep wrong attempts transient and retryable.
- [ ] Keep replay idempotent: completed lessons should still show completion
      affordances without reapplying effects or spending time.
- [ ] Add component tests for two-question lessons, mixed wrong/right attempts,
      and completion after all questions pass.
- [ ] Add builder/model validation for duplicate quiz IDs and duplicate answer
      option IDs per question.

**Exit criterion:** Authors can add a second ordinary multiple-choice question
without runtime code changes.

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

The current completion behavior is intentionally simple: passing the authored
quiz triggers the certificate-style acknowledgement and calls `completeLesson`.
That is enough for `hydro-power-intro`.

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
