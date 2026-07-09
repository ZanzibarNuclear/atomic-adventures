# Story Arc Builder Simplification Plan

**Status:** Implemented
**Last updated:** 2026-07-09
**Primary contracts:** [Play Modes and Story Mode](../contracts/play-modes-and-story-mode.md), [Story Beats and Scenes](../contracts/story-beats.md), [World Authoring](../contracts/world-authoring.md)

## Goal

Turn the Story Arc Builder into a focused organizer for story arcs, beats, and
their boundaries. An author should be able to understand the arc structure,
move a beat between arcs, and split scenes into a new beat without confronting
the complete runtime schema.

The existing Area and Utility Station workspaces remain the primary places to
write and edit individual scenes. The Story Arc Builder links to that editor
instead of reproducing its controls.

The first proof workflow is:

1. Select the arc on either side of a boundary.
2. Inspect their ordered beats and linked scenes.
3. Split the first beat of the later arc after a selected scene.
4. Move the new first portion to the end of the earlier arc.
5. Review the resulting handoff and save it as one validated change.

## Product Decisions

- The left pane is the story outline. It shows arcs and their ordered beats and
  owns selection and reorganization.
- The detail pane shows exactly one selected object: an arc or a beat.
- Selection opens read-only view mode. Editing is an explicit action.
- Arc editing and beat editing are separate forms with separate actions.
- Scene prose, triggers, conditions, and choices continue to be edited in the
  existing map-first scene builder.
- Arc boundaries are defined by ordered membership plus the outgoing handoff
  from the last beat. Authors should not have to manually repair `startBeat`,
  `next`, and `nextArc` for ordinary reorder, move, and split operations.
- Runtime movement policy, authored-action lists, completion conditions, and
  beat effects are not shown or edited in the Story Arc Builder. Their fields,
  canonical values, validation, persistence, exports, and runtime behavior stay
  unchanged.
- Raw document JSON is removed from the UI. Validation errors are translated
  into object- and field-level messages.
- There is no “active beat preview” in the authoring panel. Runtime behavior is
  verified in the playable game; the builder may later provide an explicit
  “Test from this beat” action as a separate feature.

## What the Current Technical Fields Mean

These fields currently exist in the runtime document, but their editor cards
are not part of the Story Arc Builder's job. This plan removes only those UI
cards. It does not authorize deleting, renaming, deriving, relocating, or
otherwise changing the persisted data or its runtime meaning.

| Current section | Runtime purpose | Simplified treatment |
| --- | --- | --- |
| Movement references | A per-beat list of movement destinations that Story mode currently surfaces in addition to physical movement rules. The canonical Part I data does populate these lists on every beat. | Remove only the editor card. Preserve every `allowed.movement` value and all related runtime behavior. |
| Authored actions and views | Additional per-beat action IDs and stage views used by the current runtime. These are distinct from choices in the present model, although both can contribute player actions. The canonical Part I data populates story-forward actions on most beats. | Remove only the editor card. Preserve every `allowed` value and all related runtime behavior. Choices continue to be edited in the existing scene builder. |
| Completion condition | A condition on an individual beat—not an arc—that currently tells the runtime when to advance. Canonical beats use location, flag, or facility conditions. | Remove only the editor card. Preserve every `completesWhen` value, its validation, and automatic beat progression. |
| Beat effects | Per-beat changes the runtime can perform on entry or completion. Current canonical content uses an enter effect on `check-console`; most beats have none. | Remove only the editor card. Preserve every `onEnter` and `onComplete` value and its runtime behavior. |
| Active beat preview | A derived list of movement and authored action IDs, not a preview of the scene or player experience. | Remove it. It duplicates the noisy action data and its name promises a fidelity it does not provide. |
| Document JSON | Direct editing of the entire coarse-grained story-arc document. | Remove it from the builder. Keep JSON/YAML access in explicit import/export or developer tooling outside the normal authoring workflow. |

## Target Information Architecture

### Left: Story Outline

Display all arcs as a compact ordered outline. Each arc row shows title, beat
count, and a boundary/handoff indicator. Expanding an arc shows its ordered
beats. Each beat row shows title, linked-scene count, and a warning badge only
when something needs attention.

Selecting an arc selects the arc itself; selecting a nested beat selects only
that beat. Do not automatically select the first beat when an arc is selected.

Outline actions:

- Add arc.
- Add beat at a chosen position.
- Drag a beat within an arc or across arcs, with keyboard-accessible Move
  before/after/to-arc alternatives.
- Open a beat action menu for Move, Split scenes into new beat, Duplicate, and
  Delete.
- Collapse arcs without losing the current selection.
- Warn before abandoning an object with unsaved edits.

Dragging is a convenience, not the only way to reorganize. Every cross-arc
move must show the destination and resulting boundary before it is committed.

### Right: Arc View

Read-only mode shows:

- title and stable ID;
- starting beat;
- ordered beat count;
- previous and next arc handoffs;
- a short list of structural warnings, if any.

Primary actions are Edit arc, Add beat, and Reorganize beats. Edit mode initially
contains only Title. Stable ID is visible but changed through an explicit Rename
action with reference checking. Start beat and handoffs are normally derived
from outline order; expose an advanced override only if the runtime supports
non-linear entry.

### Right: Beat View

Read-only mode shows:

- title and stable ID;
- its arc and position;
- previous and next beat/arc in plain language;
- linked scenes in order, with heading, trigger/location, and a short prose
  excerpt;
- warnings for missing scenes, unresolved references, or ambiguous flow.

Primary actions are Edit title, Open scene in Story Builder, Add scene, Split
scenes into new beat, Move beat, and Delete beat. Clicking a scene opens the
existing Area or Utility Station scene editor at that scene. The arc panel does
not include an embedded prose editor or scene preview.

Beat edit mode contains the beat title and structural scene/flow operations
only. It has no advanced runtime-policy editor.

## Boundary Editing Operations

### Move a Whole Beat

Provide one atomic command with source beat, destination arc, and insertion
position. On confirmation the command:

1. removes the beat from its source arc;
2. inserts it into the destination arc;
3. recalculates each affected arc's `startBeat` when necessary;
4. rewires sequential `next` and `nextArc` handoffs for both boundaries;
5. preserves the moved beat's scene links and all hidden runtime fields without
   modifying or displaying them;
6. validates the complete document and reports the change as a readable diff;
7. saves the story-arc document once.

If manually-authored branching makes automatic rewiring unsafe, stop and show
the conflicting links instead of guessing.

### Split a Beat by Scene

The split dialog lists the beat's linked scenes in their current order. The
author chooses the first scene of the second beat (or selects individual scenes
when they are not contiguous), supplies the new beat title and ID, and chooses
whether the new beat is inserted before or after the original.

The operation must update both canonical stores as one authoring transaction:

- create the new StoryBeat in the story-arc document;
- reassign selected scene records' `storyBeat` references;
- choose each beat's primary `scene` from its remaining linked scenes;
- preserve scene order;
- keep existing hidden runtime fields on the original beat and never copy them
  silently to the new beat;
- insert and wire the two beats in sequence;
- validate story, story-arc, and reference integrity before saving either.

Because these fields remain part of the data model, a split that could change
their meaning must produce a non-editable warning and require separate content
work. The arc builder must not discard, rewrite, or expose those fields merely
to make splitting possible.

The first implementation may constrain splitting to a contiguous scene
boundary. That matches the arc-boundary workflow and avoids pretending that
arbitrary selection has a meaningful narrative order.

### Move Part of a Beat to the Previous Arc

Compose the two commands rather than create a special data model:

1. Split the source beat at the desired scene boundary.
2. Review which progression/action data belongs to each resulting beat.
3. Move the first resulting beat to the end of the previous arc.
4. Show a final boundary review: previous arc last beat → moved beat → next
   arc start beat.
5. Save the combined change atomically when server support is available.

This is the acceptance workflow for the initial redesign.

## Implementation Phases

### Phase 1 — Read-Only Selection and Progressive Disclosure

- [x] Replace the always-editable `StoryArcPanel` form with explicit selection
      state for either an arc or a beat.
- [x] Stop auto-selecting the first beat when an arc is selected.
- [x] Build separate arc-detail and beat-detail read-only views within the
      focused panel.
- [x] Add explicit Edit/Cancel/Save states scoped to the selected object.
- [x] Reduce the outline cards to compact expandable rows.
- [x] Remove Active beat preview and Document JSON.
- [x] Remove embedded scene prose preview; link scene rows to the existing
      map-first editor.
- [x] Remove movement references, authored actions and views, completion
      conditions, and beat effects from the rendered UI, including summaries.
- [x] Map validation paths to the affected arc, beat, scene, or field and show
      warning badges in the outline.
- [x] Add component tests for arc-only selection, beat selection, view/edit
      transitions, unsaved-change protection, conditional summaries, scene
      navigation, and absence of JSON controls.

**Exit criterion:** Opening the Story Arc Builder shows a readable outline and
one read-only detail view, with no low-level empty forms.

### Phase 2 — Safe Beat Reorganization

- [x] Add pure domain operations for reorder within an arc and move across arcs.
- [x] Define sequential-flow rewiring rules and detect non-linear conflicts.
- [x] Add drag-and-drop plus keyboard/menu alternatives in the outline.
- [x] Add a move confirmation showing source, destination, insertion position,
      and resulting handoffs.
- [x] Treat the move as one story-arc document update and preserve optimistic
      version checking and revision history.
- [x] Replace the current Move up/Move down mutations with the shared domain
      operation.
- [x] Add tests for first, middle, and last beat moves; empty source/destination
      arcs; start-beat changes; cross-arc handoffs; and rejected branching
      conflicts.

**Exit criterion:** An author can move a whole beat to the end of the previous
arc without manually editing IDs or links.

### Phase 3 — Split Scenes into a New Beat

- [x] Add a split-beat dialog driven by linked scene order.
- [x] Add a preview/review step for titles, IDs, primary scenes, scene
      membership, and outgoing structural flow.
- [x] Preserve hidden runtime fields on the original beat, leave them empty on
      the new beat, and warn when the split requires a separate runtime-content
      adjustment.
- [x] Add a server command or transaction boundary that updates scene
      `storyBeat` links and the story-arc document atomically.
- [x] Preserve version checks for both the story area and story-arc document;
      return a conflict without partial writes.
- [x] Refresh the outline and select the newly created beat after success.
- [x] Add server and component tests using the real scene/reference shape.
- [x] Verify failure rollback by forcing invalid scene and arc references.

**Exit criterion:** An author can split the first beat of one arc and move its
first scenes to the preceding arc in a single understandable workflow with no
partial persistence.

### Phase 4 — Hidden-Data Preservation Verification

- [x] Add a round-trip component test proving that editing an arc title or beat
      title preserves `allowed`, `completesWhen`, `onEnter`, and `onComplete`
      byte-for-byte in the submitted structured document.
- [x] Add move/reorder tests proving those fields travel unchanged with their
      owning beat.
- [x] Add split tests proving the original beat's fields remain unchanged and
      the operation never silently copies, clears, or redistributes them.
- [x] Verify validation, canonical SQLite persistence, revision history,
      import/export, production JSON, reference-aware renames, and runtime
      behavior are untouched by removal of the UI cards.
- [x] Keep the cards absent even when a selected beat has populated values.

**Exit criterion:** The cards are gone, while all existing data and runtime
behavior remain unchanged and are protected by regression tests.

### Phase 5 — Workflow Verification and Documentation

- [x] Exercise the actual requested Part I boundary adjustment on a disposable
      revision before changing canonical content.
- [x] Verify live refresh in an open game window preserves player state.
- [x] Run the full test suite and production build checks.
- [x] Update the Story Builder section of the Story Mode contract to describe
      the outline/detail workflow and division of responsibility with scene
      editing.
- [x] Add a short first-use guide centered on select → inspect → edit/move/split
      → review → save.
- [x] Check keyboard navigation, focus restoration after dialogs, screen-reader
      labels, narrow-window behavior, and long titles.

**Exit criterion:** A first-time author can complete the boundary-change task
without opening JSON, learning runtime action categories, or editing scene prose
in two places.

## Suggested Component and Domain Boundaries

- `StoryArcPanel.vue`: workspace shell, outline/detail layout, save status.
- `StoryArcOutline.vue`: selection, expansion, drag/menu reorganization.
- `StoryArcDetail.vue`: read-only arc summary and arc edit entry points.
- `StoryBeatDetail.vue`: read-only beat/scene summaries and task entry points.
- `MoveStoryBeatDialog.vue`: explicit cross-arc move review.
- `SplitStoryBeatDialog.vue`: scene boundary selection and field assignment.
- `storyArcOperations.js`: pure reorder, move, split planning, and flow-rewiring
  logic shared by UI and tests.
- server story-arc/story repository transaction: atomic split persistence across
  the story scene records and story-arc document.

Do not make the detail components manipulate serialized document text. Replace
`documentText` as the component's editing API with a structured draft and
explicit domain commands. Serialization remains at the API boundary.

## Non-Goals

- Rebuilding the Area or Utility Station scene editor inside the arc panel.
- Showing movement references, authored-action lists, completion conditions,
  or beat effects, even as read-only summaries or advanced sections.
- Showing a simulated player action list as a preview.
- Exposing every story-arc schema field on initial selection.
- Preserving the current `allowed` UI as a legacy advanced mode.
- Adding a general graph editor before ordinary ordered arc boundaries work.
- Changing canonical Part I arc content as part of the UI implementation. The
  content boundary change is a separate authoring action performed after the
  workflow is verified.

## Acceptance Scenarios

1. Selecting “Part I Station” shows arc information only; none of its beat
   fields are editable until Edit is chosen.
2. Selecting `find-a-way-past-fence` shows that beat and its linked scenes, but
   no movement, action-policy, completion-condition, or beat-effect fields.
3. Clicking a linked scene opens it in the existing map-first Story Builder.
4. Moving a whole beat to “Part I Opener” updates both arc boundaries and
   leaves all linked scenes attached.
5. Splitting a beat never duplicates hidden runtime fields; it warns when the
   retained fields require separate lower-level content work.
6. A failed split or validation conflict writes neither the scene changes nor
   the story-arc changes.
7. The normal builder contains no raw JSON editor, comma-separated action-ID
   fields, empty effect blocks, or active-beat preview.
