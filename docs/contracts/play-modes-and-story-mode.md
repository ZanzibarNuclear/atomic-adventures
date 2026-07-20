# Play Modes And Story Mode Control

**Status:** Target contract
**Scope:** playable game mode selection, Story mode progression, visible story
actions, save data, Story Builder arc authoring, and references from world and
content authoring

---

## Purpose

Atomic Adventures supports two different player promises:

- **Story mode**: the player is Zanzibar in the canonical story. Scenes,
  choices, visible actions, effects, and consequences present Zanzibar's
  immediate experience without revealing discoveries before he has reason to
  know them.
- **Open-world mode**: the player explores freely, defines their own goals, and
  experiments with rooms, maps, facilities, artifacts, and actions without
  being cast as Zanzibar's authored story.

These modes are intentionally separate. Story mode is controlled by a
first-class `StoryArc` model and one runtime controller, `useStoryArc`.
Open-world mode reuses scenes, world systems, facility state, inventory,
characters, effects, and stage views through a separate controller with fewer
canonical constraints.

World and facility systems remain the source of truth for physical
possibility, movement, safety, and survival pressure. Story mode can surface,
sort, and enrich story-sensitive actions, but it cannot make an impossible
movement or invalid interaction possible.

## Vocabulary

| Term | Meaning |
| --- | --- |
| `StoryArc` | A major authored story problem and resolution, such as the Part I opener. |
| `StoryBeat` | The active organizing unit for canonical progression inside a story arc. |
| `Scene` | A contextual move within a story beat, selected for a location and circumstances. |
| `Choice` | An authored player-facing action attached to a scene. |
| `authoredActions` | Stable action references a beat wants to add, enrich, or emphasize. |
| `CompletionCondition` | A typed condition that proves the active story beat is complete. |
| `BeatEffect` | Enter or complete effects for flags, time, validated state changes, movement, or stage views. |

The target model uses `StoryArc`, `StoryBeat`, and `Scene` in code, content,
builder UI, tests, and contracts. Older storage and API field names may be
normalized during migration, but they are not permanent design concepts.

## Design Principles

- **Explicit mode choice.** A new playthrough chooses `story` or
  `open-world` before ordinary play begins.
- **Story mode is Zanzibar's point of view.** Story mode presents the authored
  sequence through Zanzibar's perceptions, memories, worries, and guesses. It
  should not name the utility station, hydro facility, eBuggy, or other
  undiscovered things before Zanzibar has reason to know them.
- **Guidance comes from scenes, choices, and actions.** The objective UI has
  been removed. Story mode should guide the player with prose, authored
  choices, visible story actions, survival pressure, and consequences instead
  of a separate quest prompt.
- **Story mode is guided, not railed.** It should keep at least one plausible
  story-continuing path visible when the world allows it, while ordinary
  physically valid movement remains available. Detours may cost time, energy,
  hydration, satiety, or safety. When the player steps off the canonical path,
  the prose layer may show ambient information for the current location while
  the active story beat waits for an explicit completion condition, choice, or
  effect to reconnect progression.
- **Guidance is not permission.** A beat can add, enrich, sort, or emphasize
  actions, but it does not hide a selected scene's choices or otherwise decide
  whether a physically valid world, item, door, passage, or stage action is
  allowed. The world and wellbeing systems remain the authority for that.
- **Choices live on scenes.** A scene presents what happens and what can be
  chosen at the current location and circumstances. Beat-wide authored actions
  remain stable while scene prose and contextual choices may vary.
- **Typed conditions beat scripts.** Completion conditions and beat effects
  should stay small and validated. Do not add a general scripting language
  until a concrete authored sequence proves the need.
- **Open-world is broad, not impossible.** Open-world mode exposes broad room,
  map, and action access while preserving movement rules, facility
  prerequisites, inventory requirements, wellbeing consequences, and
  invalid-state safety rails.
- **Mode state is save state.** Save/load preserves selected mode, active story
  arc and beat, completed beats, entered beats, seen scenes, milestones,
  character state, inventory, flags, facility state, and physical location.
- **No rejoin puzzle.** Switching an open-world save back into canonical Story
  mode is out of scope because open-world play may create valid but
  non-canonical facility and inventory states.

## Runtime State

Player save data includes the selected mode and, when relevant, Story mode
progress:

```js
{
  playMode: "story" | "open-world",
  story: {
    activeArcId: "part-i-opener",
    activeBeatId: "lost-in-the-woods",
    completedBeatIds: [],
    enteredBeatIds: [],
    seenSceneIds: []
  },
  milestones: {}
}
```

`playMode` is required. New playthroughs default to `story` unless the player
chooses `open-world`.

`story` is active when `playMode` is `story`. It records the current arc and
beat plus durable progression state. Milestones are ordinary game state and
may also satisfy completion conditions or scene criteria.

Open-world saves keep canonical story progression inactive. They continue to
persist ordinary player state: location, discoveries, flags, scene seen state,
character holdings, lessons, clock, milestones, and facility state.

## Mode Selection

Starting a new game presents an explicit mode choice before normal play:

| Mode | Player-facing promise | Default |
| --- | --- | --- |
| Story | Experience Zanzibar's story from the inside. | Yes |
| Open-world | Explore and experiment freely as a player-authored run. | No |

For the current implementation, a save cannot switch from `open-world` back
into `story`. Supporting that later requires a deliberate rejoin contract that
can map arbitrary world, inventory, and facility states onto a valid story
beat.

A future one-way "continue as open-world" escape from Story mode may be added
when useful, but it is not required for the current implementation.

## Story Arc Content

A `StoryArc` is an authored document in SQLite, exported to production runtime
JSON with the rest of content. YAML remains an explicit import/export snapshot
format only.

The local authoring transport exposes editable story arc content at
`/api/story-arcs/document`. Production runtime export uses
`/content/story-arcs.json`, and runtime code consumes `StoryArc`,
`StoryBeat`, and `Scene` data.

Story arc documents should be coarse-grained like the existing world and
character documents. Arc IDs use story-facing names, not software phase names:

```yaml
id: part-i-opener
title: Part I Opener
protagonist: zanzibar-nuhero
startBeat: lost-in-the-woods

beats:
  - id: lost-in-the-woods
    title: Lost in the woods
    scenes:
      - id: opening-pines
        trigger: { place: outdoors, hex: eastern-pines }
        prose: Zanzibar pushes through wet pines with an empty stomach and one clear thought: keep moving.
        revisitProse: The slope and pines are already becoming landmarks.
        choices:
          - id: follow-fence-uphill
            label: Follow the fence uphill
            action: { kind: move, hex: east-pines }
    authoredActions:
      - id: move-hex:east-pines
        kind: move
        label: Follow the fence uphill
        role: story
    completesWhen:
      location: { place: outdoors, hex: gate-woods }
    next: find-shelter
```

Field meanings:

| Field | Meaning |
| --- | --- |
| `id` | Stable story arc ID. |
| `title` | Author-facing arc title. |
| `protagonist` | Optional point-of-view character metadata. |
| `startBeat` | First story beat for a new playthrough of this arc. |
| `beats` | Ordered or referenced story beats. |
| `completion` | Optional arc transition: its next arc and the card shown after the final beat. |

Story beat meanings:

| Field | Meaning |
| --- | --- |
| `id` | Stable beat ID. |
| `title` | Author-facing beat title. |
| `scenes` | Contextual moves with prose, criteria, and choices for different locations and conditions. |
| `authoredActions` | Story-specific action references to add, enrich, or emphasize. |
| `completesWhen` | Typed completion condition. |
| `onEnter` | Optional beat effects when the beat starts. |
| `onComplete` | Optional beat effects after completion. |
| `next` | Next beat ID, or null for arc completion. |

Arc completion fields:

| Field | Meaning |
| --- | --- |
| `nextArc` | Optional handoff to another arc's `startBeat`. |
| `card` | Optional acknowledgement card with `eyebrow`, `heading`, `description`, optional `note`, and `actionLabel`. |

## Completion Conditions

Completion conditions should stay typed and small. They are not a general
boolean scripting language.

Supported condition families should include:

| Condition | Example | Meaning |
| --- | --- | --- |
| `flag` | `artifacts.hydro-startup-card.read` | A global story/game flag is set. |
| `facility` | `{ hydro.intakeReady: true }` | A facility state field has the expected value. |
| `location` | `{ place: indoors, room: control-room }` | Player reached a specific location. |
| `holding` | `{ item: hydro-startup-card, holder: character:zanzibar-nuhero }` | A required artifact is held by an accessible holder. |
| `lesson` | `{ id: hydro-power-stream-to-socket, status: completed }` | A lesson reached a known progress state. |
| `milestone` | `hydro.level-1-complete` | A durable milestone has been completed. |

If multiple alternatives are needed, use an explicit small shape:

```js
completesWhen: {
  anyOf: [
    { flag: "day1.crisis-averted" },
    { location: { place: "indoors", room: "library" } }
  ]
}
```

If a new condition is needed, add it with runtime evaluation, builder
controls, validation, tests, and this contract together.

## Story Actions

`useStoryArc` combines three sources into one visible action set:

1. engine-provided possible actions from the current physical state;
2. choices from the active scene and authored actions from the active story beat;
3. current character, inventory, facility, wellbeing, milestone, and discovery
   state.

The resulting actions should look like ordinary player actions. Story mode
does not need to visually label which action is canonical.

The selected scene's choices are always presented. Beat guidance may mark a
story-continuing action or make it easier to find, but it is not a permission
list for choices or engine actions. A scene choice can still be unavailable
when the underlying world cannot perform it—for example, when its movement
destination is unreachable—but no separate story-arc policy may hide it.

Authored action references should describe player intent in stable IDs, not
component implementation details:

| Role | Meaning |
| --- | --- |
| `story` | Plausible canonical story-continuing action. |
| `optional` | Known curiosity action that does not break discovery order. |
| `survival` | Food, water, rest, shelter, safety, or other wellbeing action. |
| `utility` | Status, inventory, map, or other support action. |

If an authored action references an object the underlying system considers
invalid, unavailable, or unsafe, the action remains unavailable. Story mode
cannot bypass physical movement, door, holder, item, facility, or wellbeing
rules.

When the player has wandered away from an authored story action, the runtime
should still show ordinary available movement and survival/status actions.
Scenes and nearby actions should help the player infer a plausible way forward
without naming undiscovered destinations.

## Beat Effects

Story beats may need time passage, stage views, flags, validated state changes,
or rare forced movement to keep a specific authored moment coherent. These
effects are authored in `onEnter` or `onComplete`:

```yaml
onComplete:
  timeMinutes: 10
  activity: light
  move:
    place: indoors
    room: control-room
  view:
    kind: console
    id: hydro
  setFlags:
    - story.hydro-startup.returned-to-console
```

Beat effects are still validated. Movement destinations must exist. Forced
movement should be rare and reserved for scenes where Zanzibar actually
commits to movement in prose or where a map transition has already been
chosen. Stage views must use registered kinds. Time advancement must use a
supported activity profile. Character and facility changes must use the shared
validated effect service when they mutate character or inventory state.

## Scenes In Each Mode

Scenes are the prose layer described in [story-beats.md](story-beats.md).
Story mode selects a scene from the active story beat. Open-world mode may
reuse scenes as ambient descriptions through its own controller.

Story-mode scenes should preserve Zanzibar's authored voice and canonical
story. They may describe memory, fear, guesswork, fatigue, hunger, thirst, and
discovery from his point of view.

Open-world scenes should be ambient, discovery-oriented, or explanatory. They
should not imply that the player is Zanzibar or that canonical story timing is
happening.

## Objective UI

The standalone objective UI has been removed from the target Story mode model.
Player guidance should come from:

- the active scene's prose and revisit prose;
- choices on the active scene;
- visible story actions merged with engine actions;
- survival and wellbeing warnings;
- physical world affordances;
- consequences of time, movement, and facility state.

Zanzibar can still express an immediate concern in prose, such as needing
shelter or wondering what a building was for. That concern should not be
duplicated as a persistent quest prompt.

Open-world mode should not show a canonical objective. It may show freeform
status such as current location, facility status, active warnings, or optional
experiments, but the UI must make clear that the player is not following the
authored Story mode arc.

## Builder Responsibilities

Story Builder separates story structure from scene and runtime-guidance
authoring:

1. The Story Arc workspace shows arcs and their ordered beats as an expandable
   outline.
2. Selecting an arc or beat opens one read-only detail view. Editing is an
   explicit action.
3. The Story Arc workspace edits arc and beat titles, scene membership, beat
   order, cross-arc movement, arc boundaries, and each arc's completion node.
4. Selecting a linked scene opens the existing map-first Area or Utility
   Station scene editor for prose, triggers, conditions, and choices.
5. **Attach scene** associates an existing scene with the selected story beat
   without changing the scene's other content. **Add scene** creates a blank
   scene draft pre-associated with the selected story beat; it must not clone a
   linked scene implicitly.

The Story Arc workspace does not display or edit the beat's story-guidance
references, `completesWhen`, `onEnter`, or `onComplete`. Those fields remain
part of the canonical StoryBeat data and runtime contract. Guidance references
may affect emphasis, but never action availability. Structural edits must
round-trip them unchanged. Moving a beat carries them with that beat. Splitting
a beat leaves them unchanged on the original beat and does not silently copy
them to the new beat.

Cross-arc moves update affected `startBeat` and `next` links while the
destination arc retains its completion handoff. An arc's `nextArc` belongs only
to its completion node. A non-linear handoff that cannot be rewired safely
stops the operation. Splitting a beat updates the story-arc document and
the moved scenes' `storyBeat` references in one database transaction with
optimistic version checks; a conflict leaves both stores unchanged.

World Builder and Content Builder remain separate. They provide referenced
locations, rooms, exterior nodes, transitions, items, lessons, documents,
characters, facility state, and actions. Story Builder composes these
references into arcs and beats.

Reference-aware renames and deletes should protect story arc content:

- renaming a referenced hex, room, exterior node, transition, item, lesson,
  document, holder, or action updates story arc references in the same
  transaction when reference-aware renames are supported;
- deletion is rejected when it would leave a story arc reference unresolved;
- selected world or content objects should show which story beats reference
  them.

## Part I Guided Arc

The initial Part I arc is named `part-i-opener`. It should encode Zanzibar's
opening survival arc and leave room for later experiments with different arc
boundaries:

1. Choose Story mode.
2. Establish that Zanzibar is lost, hungry, thirsty, and moving by instinct.
3. Encourage westward movement across the forest without naming the
   destination.
4. Let the fence become the discovered obstacle.
5. Allow a noncanonical downhill shortcut through a fence hole.
6. Keep the canonical uphill/westward path to the gate visible.
7. Let Zanzibar figure out the gate and follow the road.
8. Discover the utility station.
9. Explore around the building and break in through the side garage door.
10. Discover the eBuggy, stairs, conference room, kitchen, food, and water
    purifier.
11. Avert the first survival crisis.
12. Shift prose and visible actions toward understanding what the building was
    for.
13. Discover the laminated startup card and hydro context.
14. Go to the intake, clear debris, open intake, align the diversion valve,
    open the turbine valve, return to the control room, connect power, check
    the simplified console, and complete hydro startup.

Story mode should keep at least one canonical story-continuing prompt visible,
but it should not label that prompt as canonical or remove ordinary movement
or curiosity paths. Open-world mode uses general area descriptions and lets the
player define the story they are making while preserving the same physical,
facility, and wellbeing rules.

## Production And Live Authoring

Story arc content is canonical in `game/content/atomic-adventures.sqlite`.
Production builds export runtime story content alongside world, building,
character, and learning content. Development serves story content through the
local API and publishes SSE updates after successful saves.

Open game windows may refresh story content without losing player state. If
the active arc and beat still exist, `useStoryArc` re-evaluates the active
scene, visible actions, and completion state. If the active arc or beat is
removed or becomes invalid during live authoring, development builds should
show a clear authoring error and block story-sensitive progression rather than
silently exposing open-world actions.

## Tests

This behavior requires tests for:

- new-game mode selection and Story mode default;
- save/load of `playMode`, active arc ID, active beat ID, completed beats,
  entered beats, seen scenes, milestones, inventory, flags, character state,
  and facility state;
- normalization from older content and save shapes into `StoryArc`,
  `StoryBeat`, `Scene`, and `story`;
- scene selection by trigger, location match, time, milestones, mode, and seen
  state;
- story-continuing action visibility in Story mode;
- scene choices and ordinary engine actions remaining available in Story mode
  when physically valid;
- story guidance affecting emphasis without hiding or blocking an action;
- map clicks and play-panel movement sharing the same physical movement rules;
- forced movement, forced time passage, forced stage views, and beat effects;
- beat stability when ordinary movement does not satisfy completion;
- survival and wellbeing consequences for excessive wandering or time passage;
- hydro startup completion in Story mode with gates active;
- open-world startup with broad action access and valid out-of-order
  completion;
- live authoring refresh of active arc data.

## Implementation Map

| Concern | Expected location |
| --- | --- |
| Play mode and story save state | `game/src/composables/useGameState.js` |
| Story content loading and normalization | `game/src/composables/useStoryContent.js` or equivalent |
| Story mode controller | `game/src/composables/useStoryArc.js` |
| Scene selection helper | `game/src/composables/` or `game/src/lib/` story helpers |
| Visible action building | `game/src/composables/usePlayPanel.js`, map handlers, indoor/outdoor actions |
| Mode UI | `game/src/views/GameView.vue` and HUD components |
| Story validation/projection | `game/server/story-model.js` or story model sibling |
| Story repository/API/revisions | `game/server/` content repositories and API routes |
| Story Builder arc UI | `game/src/views/BuilderView.vue` or extracted builder components |
| Story arc tests | `game/src/composables/`, `game/src/lib/maps/testing/`, and `game/server/` |
