# First-Class Scene Builder Workspace Implementation Plan

**Status:** Ready for implementation
**Last updated:** 2026-07-09
**Primary design:** [Story Mode Technical Design](story-mode-technical-design.md)
**Primary contracts:** [Story Beats and Scenes](../contracts/story-beats.md), [Play Modes and Story Mode](../contracts/play-modes-and-story-mode.md)

## Goal

Add a first-class **Scenes** workspace to Story Builder between **Story arcs**
and **Milestones**. A scene should open in the same editor whether the author
arrived from a location, a story beat, or the global scene selector. When the
author finishes, an explicit return action restores the originating arc/beat or
location context.

The location workspaces and Story Arc workspace remain useful projections:

- **Area** and **Utility Station** answer “what scenes can happen here?”
- **Story arcs** answers “what scenes present this beat in the story flow?”
- **Scenes** answers “what is this scene, regardless of how I found it?”

The plan also finishes the incomplete terminology boundary between persisted
scene records and story-progression beats.

## Evaluation of the Current Object Structure

### What Matches the Technical Design

- The arc document contains actual `StoryArc` objects with ordered
  `StoryBeat` objects.
- A story-progression beat can be associated with several prose presentations.
- The runtime composes persisted prose records into `StoryBeat.scenes[]` and
  selects one by trigger, location, mode, flags, time, and other criteria.
- The `storyBeat` reference on a prose record connects the location-oriented
  and arc-oriented views of the graph.
- Area and Utility Station already provide a useful location projection, while
  Story Arcs provides a useful progression projection.

### What Does Not Match

The migration stopped at a normalization layer. Current names still describe
the pre-migration model:

| Current implementation | Actual role | Target name |
| --- | --- | --- |
| SQLite `story_beats` row | Prose, revisit prose, trigger, conditions, mode, and time criteria | `Scene` |
| `/api/story/areas/:areaId/beats` | Scene CRUD transport | `/api/story/areas/:areaId/scenes` |
| `StoryBeatEditor.vue` | Scene form | `SceneEditor.vue` |
| `StoryBeatList.vue` | Location-filtered scene list | `LocationSceneList.vue` |
| `useStoryBeatDocument` | Scene draft, save, revision, and selection state | `useSceneDocument` |
| “New beat” in Area/Utility Station | Creates a prose/criteria record | “New scene” |
| Arc document beat | Canonical unit of story progression | `StoryBeat` (already correct) |

The current canonical database contains 64 records in `story_beats`; 38 have a
`storyBeat` association. Runtime normalization treats these records as scenes.
This is direct evidence that the local-builder objects are scenes, not story
beats.

### Settled Choice Ownership

Choices belong to `Scene`. They describe what can be chosen in the specific
location, time, and circumstances presented by the scene. The current database
already stores 29 choices with scene/prose records, including different choices
on scenes linked to the same StoryBeat. That is intentional contextual
variation, not migration debt.

Beat-wide authored actions remain available for guidance or actions that should
persist while the character makes one or more scene-level moves within the
same beat. Engine/world actions remain the authority for physical possibility.
When an unassigned scene is used only as off-beat ambient prose in Story mode,
its choices remain suppressed; when it is selected normally in Open-world
mode, its contextual choices may be available subject to engine validation.

## Settled Target Model

```text
StoryArc
  └─ StoryBeat
       ├─ authored actions / completion / effects
       └─ Scene references (ordered)

Scene
  ├─ ID, heading, prose, revisit prose
  ├─ trigger/location
  ├─ mode, flag, time, origin, and transition criteria
  ├─ contextual choices
  └─ optional StoryBeat association
```

Storage does not need to nest scene rows physically inside the arc JSON. A
top-level canonical scene collection is preferable because scenes need global
selection, independent revision history, location filtering, and ambient
open-world use. The runtime may continue composing the graph into nested
`StoryBeat.scenes[]` objects.

Each scene has at most one StoryBeat association. An unassigned scene is an
ambient/open-world candidate. Scene order within a beat must be explicit and
must not depend on unrelated area-wide row order. The first associated scene
is the beat's primary/default scene unless a demonstrated selection rule needs
separate primary metadata.

## Target Builder Information Architecture

Story Builder tabs, in order:

1. **Area**
2. **Utility Station**
3. **Story arcs**
4. **Scenes**
5. **Milestones**

### Scenes Workspace

The workspace has a selector/list and the common scene editor.

The selector supports:

- search by scene ID, heading, or prose excerpt;
- filter by Area hex, Utility Station room, exterior node, or event;
- filter by Story Arc and StoryBeat;
- filter by Story mode, Open-world mode, both, or unassigned;
- warning badges for missing locations, stale beat associations, duplicate
  selection criteria, or scenes not reachable from any projection;
- **New scene** with no implicit location or beat when launched globally.

The editor puts the scene first and exposes:

- ID;
- eyebrow and heading;
- scene and revisit prose;
- StoryBeat association through a catalog-backed selector, not a free-text ID;
- trigger/location through catalog-backed controls;
- mode, origin, transition, flag, milestone, and time criteria;
- contextual choices;
- revision history, duplicate, delete, revert, and save.

### Location Projections

Area and Utility Station continue to show the map plus scenes whose trigger is
the selected location. Rename all author-facing “beat” language in these
workspaces to “scene.”

- **New scene here** creates a blank scene with the selected trigger prefilled
  and opens Scenes.
- Clicking a listed scene opens the common Scenes workspace.
- The common editor shows the same location and beat association fields, so no
  separate embedded editor remains in the location workspace.
- Returning restores the selected map, floor, room/exterior node, camera mode,
  and location scene list.

### Story Arc Projection

Story Arcs continues to show arcs, beats, and associated scenes.

- Clicking a scene opens the common Scenes workspace.
- **Add scene** creates a blank scene with the selected StoryBeat association
  prefilled and opens Scenes.
- **Attach scene** keeps its existing-scene picker.
- Returning restores the expanded arcs, selected arc/beat, and scroll context.

## Navigation and Return Contract

Opening a scene carries an explicit editor origin rather than relying only on
browser history or mutable component state.

Recommended route-query shape on `/builder/story`:

```text
?workspace=scenes&scene=the-gate
  &from=story-arcs&arc=part-i-opener&storyBeat=find-a-way-past-fence
```

or:

```text
?workspace=scenes&scene=conference
  &from=rooms&location=conference&level=upper
```

Rules:

- The editor header shows **Back to Story arc**, **Back to Area**, or
  **Back to Utility Station**, based on the recorded origin.
- Returning restores selection but never silently discards a dirty draft; use
  the existing Save and continue / Discard / Keep editing dialog.
- Selecting a scene directly from the Scenes catalog sets `from=scenes`; no
  artificial return destination is needed.
- Reload and deep links preserve both the open scene and return target.
- Opening another scene from the global selector replaces `scene` but retains
  `from=scenes`.
- Invalid or stale origin parameters fall back to Scenes without losing the
  selected scene.

## Implementation Phases

### Phase 0 — Correct the Contract and Inventory the Migration

- [x] Update the technical design to distinguish the composed runtime graph
      from the top-level canonical scene collection.
- [x] Correct the completed migration plan: prose-record UI/storage/API naming
      remains migration debt while scene-owned choice behavior is intentional.
- [ ] Add an inventory report/test covering scene count, beat associations,
      unassigned scenes, scene-owned choices, and ambiguous associations
      without freezing current authored IDs.
- [ ] Add contract tests proving choices are read from the selected Scene and
      not from StoryBeat compatibility fields.

**Exit criterion:** Contracts and tests agree that StoryBeat organizes flow,
Scene represents a contextual move, and choices belong to Scene.

### Phase 1 — Establish Scene-Named Frontend Boundaries

- [ ] Rename `StoryBeatEditor.vue` to `SceneEditor.vue` and update tests.
- [ ] Rename `StoryBeatList.vue` to `LocationSceneList.vue` and change “New
      beat,” “No beats,” CSS classes, props, emits, and messages to scene terms.
- [ ] Rename `useStoryBeatDocument` to `useSceneDocument`, including draft,
      selection, error, status, revision, and method names.
- [ ] Rename location helpers such as `beatsForLocation`, `locationBeats`,
      `selectBeat`, `newBeat`, `emptyBeat`, and `suggestedId` to scene terms.
- [ ] Rename server validation messages and internal model helpers that operate
      on prose records, while leaving actual StoryBeat model helpers unchanged.
- [ ] Keep the app playable and preserve all scene data byte-for-byte through
      the semantic refactor.

**Exit criterion:** Frontend code and local-builder UI call prose records
Scenes; `StoryBeat` refers only to the arc progression object.

### Phase 2 — Add the Common Scenes Workspace

- [ ] Add the Scenes tab between Story arcs and Milestones.
- [ ] Extract the current scene form from the three-column map workspace into
      the Scenes workspace without changing save semantics.
- [ ] Add the global scene selector with search and the location, beat, arc,
      mode, and assignment filters.
- [ ] Replace the free-text StoryBeat field with an arc/beat catalog selector.
- [ ] Add catalog-backed trigger controls usable without a map selection.
- [ ] Support globally-created scenes with no inherited location or beat; make
      the author choose a valid trigger before saving.
- [ ] Preserve revision history, duplicate, delete, validation, optimistic
      concurrency, SSE refresh, and unsaved-change protection.
- [ ] Add component tests for selection, filters, empty state, invalid
      references, save conflicts, and long scene headings/prose.

**Exit criterion:** Any scene can be found and completely edited from Scenes
without visiting Area, Utility Station, or Story Arcs.

### Phase 3 — Make Location and Arc Views Projections of Scenes

- [ ] Change Area and Utility Station scene rows to open Scenes with a location
      origin context.
- [ ] Change Story Arc scene rows to open Scenes with an arc/beat origin
      context.
- [ ] Implement Back to origin with route-query persistence and the shared
      dirty-draft dialog.
- [ ] Replace location **New scene** with **New scene here**, prefill only the
      selected trigger, and open Scenes.
- [ ] Keep Story Arc **Add scene** prefilling only the selected StoryBeat
      association, then open Scenes.
- [ ] Keep **Attach scene** for associating an existing scene without editing
      its other fields.
- [ ] Remove the embedded scene editor from Area and Utility Station after all
      entry paths use Scenes.
- [ ] Restore map selection, floor, camera, expanded arcs, selected beat, and
      relevant scroll/focus context on return.
- [ ] Add browser tests for Area → Scene → Area, Utility Station → Scene →
      Utility Station, Story Arc → Scene → Story Arc, direct Scenes selection,
      reload/deep-link restore, and dirty-draft navigation.

**Exit criterion:** All three projections open one common editor and return to
their exact authoring context without a jarring workspace reset.

### Phase 4 — Make Scene Choice Ownership Explicit

- [ ] Keep typed choice CRUD, ordering, validation, revision history, and YAML
      with Scene persistence and the common Scene editor.
- [ ] Remove `choices` from the canonical StoryBeat authoring shape, default
      beat creation, validation, and Story Arc editing.
- [ ] Remove runtime normalization that prefers or falls back to
      `StoryBeat.choices`; compose visible authored choices from the selected
      Scene only.
- [ ] Keep beat-authored actions separate and merge them with selected-scene
      choices plus engine-provided possible actions.
- [ ] Add behavior tests proving a scene change may change prose and choices
      without advancing the active StoryBeat.
- [ ] Add tests proving revisit presentation retains the selected Scene's
      choices.
- [ ] Suppress choices when an unassigned scene is used only as ambient
      fallback prose in Story mode; allow them for normal Open-world scene
      selection subject to engine validation.
- [ ] Remove empty or obsolete StoryBeat choice fields from canonical SQLite
      arc content and runtime exports in the coordinated migration.

**Exit criterion:** Choices have one owner—Scene—and switching scenes may
change contextual choices without changing the active StoryBeat.

### Phase 5 — Finish Canonical Scene Storage and API Naming

- [ ] Migrate SQLite `story_beats` to `story_scenes` and prose columns to
      current scene terminology (`prose`, `revisit_prose`, `story_beat_id`).
- [ ] Add explicit per-beat scene ordering rather than relying on global area
      sort order.
- [ ] Rename scene revision storage and operations consistently.
- [ ] Replace `/api/story/areas/:areaId/beats` with
      `/api/story/areas/:areaId/scenes` and update all local consumers, CLI
      import/export, SSE payloads, tests, and error responses together.
- [ ] Rename repository/model methods to scene terms and delete the old route
      and method names in the same migration; do not keep a permanent alias.
- [ ] Validate `storyBeatId` against the canonical arc document.
- [ ] Make beat rename/delete and scene attach/detach reference-aware and
      transactional across both stores.
- [ ] Update production runtime export so the composed shape still presents
      `StoryBeat.scenes[]` while canonical authoring remains independently
      queryable.
- [ ] Update contracts, diagrams, quality checklist, and implementation map.

**Exit criterion:** Storage, API, repository, builder, runtime composition, and
documentation all use StoryArc → StoryBeat → Scene vocabulary without a
parallel legacy path.

### Phase 6 — Verification and Cleanup

- [ ] Run the full test suite after each meaningful story/runtime change.
- [ ] Verify production export and build contain the same authored story
      behavior and no builder chunks.
- [ ] Verify live scene edits refresh an open game without changing player
      location, active beat, flags, inventory, vitals, clock, or stage view.
- [ ] Exercise a full authoring pass from each origin and through the global
      selector using current canonical content.
- [ ] Check keyboard navigation, focus restoration, narrow layouts, long text,
      empty filters, and screen-reader labels.
- [ ] Run terminology searches and remove prose-record uses of `beat`, while
      retaining genuine StoryBeat uses.
- [ ] Mark the prior model migration complete only when these checks pass.

**Exit criterion:** A new author can accurately explain the model and edit any
scene from either projection without encountering two different editors or
obsolete beat terminology.

## Key Invariants

- A `StoryBeat` is a progression object owned by one `StoryArc`.
- A `Scene` is a prose/criteria object with at most one StoryBeat association.
- Scene location is a trigger/selection criterion, not scene ownership.
- Area, Utility Station, Story Arcs, and Scenes are projections of the same
  canonical scene records.
- A scene save produces exactly one new scene revision regardless of origin.
- Return navigation never discards an unsaved scene silently.
- Scene reorder, attach, detach, beat rename, and beat delete preserve
  referential integrity transactionally.
- Choices have exactly one owner: Scene.
- Runtime scene selection may vary both prose and contextual choices without
  advancing the active StoryBeat.
- Canonical SQLite content remains authoritative; YAML is import/export only.

## Non-Goals

- Duplicating the scene form inside each projection.
- Treating location as the owner of a scene.
- Keeping both beat-named and scene-named CRUD APIs indefinitely.
- Nesting scene persistence inside the arc JSON solely to match the runtime
  projection.
- Changing player-facing prose or story flow merely to rename authoring
  objects.

## Acceptance Scenarios

1. From gate woods in Area, selecting “A Guardhouse and a Gate” opens that
   scene in Scenes; Back to Area restores gate woods and the same map view.
2. From a Utility Station room, New scene here opens a blank Scene with that
   room trigger prefilled and no copied prose.
3. From `find-a-way-past-fence` in Story Arcs, selecting a linked scene opens
   the same Scene editor; Back to Story arc restores the selected beat.
4. Opening Scenes directly can find the same scene by ID, heading, location,
   arc, or beat.
5. Editing a scene's StoryBeat association updates both projections without
   changing prose, criteria, or scene-owned choices.
6. Switching between two scenes for one StoryBeat may change the visible
   contextual choice set without advancing the beat.
7. Renaming a StoryBeat updates scene associations atomically; deleting a beat
   with associated scenes is blocked until the author reassigns or detaches
   them.
8. A save conflict or validation failure keeps the Scene draft and return
   origin intact.
