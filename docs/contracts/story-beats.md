# Story Beats And Scenes

**Status:** Target contract for Story mode prose, scene selection, choices, and
mode scoping
**Scope:** `game/` Story Builder, content API, game state, `useStoryArc`, and
future open-world scene selection

---

## Purpose

A **StoryBeat** is the active unit of canonical Story mode progression. It owns
the player-facing choices, authored actions, completion condition, and effects
for the current story moment.

A **Scene** is the prose presentation for a story beat under particular
circumstances. It attaches Zanzibar's authored voice, open-world area
description, and revisit prose to a location, event, or state-specific moment.
Multiple scenes may belong to one story beat.

Scenes are authored in Story Builder at `/builder/story`, stored in
`game/content/atomic-adventures.sqlite`, and delivered to the game through the
local content API. YAML is only an explicit import/export snapshot format.

This document describes scene behavior and its relationship to Story mode.
The broader Story mode controller is described in
[play-modes-and-story-mode.md](play-modes-and-story-mode.md).

## Relationship To Play Modes

The game has two explicit modes:

- `story`: the player experiences Zanzibar's canonical story from his point of
  view. Scenes may describe memory, fear, guesswork, fatigue, hunger, thirst,
  and discovery in Zanzibar's authored voice.
- `open-world`: the player explores freely, with ordinary world, facility,
  character, inventory, and movement rules providing safety rails. Scenes
  should read as general area descriptions or player-authored discovery
  prompts, not as Zanzibar's required canonical path.

In Story mode, `useStoryArc` first selects a scene from the active
`StoryBeat`. If the active beat has no matching scene for the player's current
location, the prose layer may fall back to a matching ambient scene from the
active arc. Choices and authored actions remain attached to the active story
beat, not to the selected prose scene, so exploratory location information can
appear without changing the action model or advancing canonical progression.

In open-world mode, a separate controller may reuse scenes as ambient
descriptions with fewer canonical constraints. Open-world scene selection
should not imply Zanzibar's authored timing or progression.

Scenes may be scoped to one or both modes:

```yaml
modes: [story]
```

Rules:

- Omitting `modes` keeps the scene eligible in both modes when its trigger and
  other criteria match.
- `modes: [story]` makes the scene eligible only in Story mode.
- `modes: [open-world]` makes the scene eligible only in open-world mode.
- Story-mode scenes should preserve the canonical story thread and Zanzibar's
  authored voice. They may imply his uncertainty and should avoid naming
  undiscovered places, artifacts, or systems before he learns them.
- Open-world scenes should avoid implying that the player is Zanzibar, that
  canonical timing is happening, or that required story beats have occurred.
  They can describe what is physically present, what the player notices, and
  what systems are available for experimentation.

## Voice And Knowledge

Story-mode and open-world scenes are allowed to describe the same place
differently because they answer different questions:

- Story-mode scene: "What does Zanzibar think, fear, remember, or infer at
  this moment in the canonical story?"
- Open-world scene: "What can a player observe or do here without assuming a
  canonical protagonist or sequence?"

Story-mode scenes must preserve discovery order. At the beginning of Part I,
Zanzibar does not know there is a utility station, an eBuggy, a hydro plant, a
startup card, or a kitchen. Opening scenes should use immediate, grounded
language: slope, forest, hunger, thirst, light, wind, path, fence, gate, road,
shelter. Later scenes may name the utility station, control room, intake, and
hydro equipment only after the story has made those discoveries available.

Open-world scenes may be more neutral and reusable. They should not borrow
Zanzibar's internal monologue unless explicitly authored as a Zanzibar
story-mode scene.

## Scene Selection

Whenever the player changes location, flags change, the game starts, or live
story content is updated, the active controller may evaluate scenes for the
current story area using the current story action context. The action context
describes why story is being evaluated, such as:

| Action context | Meaning |
| --- | --- |
| `enterOutdoorHex` | The player moved from one outdoor hex into another |
| `exitLocalMap` | The player returned from a local/grid map to an outdoor hex |
| `enterIndoorLocation` | The player entered or moved within an indoor/local map location |
| `event` | Code explicitly requested a named story event |
| `ambientRefresh` | Story refreshed because flags, save state, startup, or live content changed |

In Story mode, a scene is eligible when:

1. It belongs to the active `StoryBeat`.
2. Its trigger matches the current location or event.
3. Its optional `modes` match the current play mode.
4. Every authored `match` criterion relevant to the current action context
   matches that context.
5. Every authored time, milestone, flag, and seen-state criterion matches the
   current player state.

If multiple scenes match the same location, the runtime prefers the eligible
scene with the most matching criteria relevant to the current action context. A
scene with `match.originHex` is more specific than a default scene with no
`match` during inter-hex travel, so it wins when the player entered from that
origin. A scene with `match.mapTransition` is more specific than a default
scene with no `match` when switching between the regional and local maps. A
default scene remains eligible when no action-specific scene matches.

Time and milestone criteria also add specificity among scenes with the same
trigger. A Day 2 morning room scene should win over a generic room scene when
the clock and milestone state make both eligible.

Authored `match` criteria from other action contexts are ignored for the
current selection pass. This means one scene may include both `originHex` and
`mapTransition`: the same scene can be selected when entering an outdoor hex
from a neighboring hex and when switching through a matching map transition. A
scene with authored `match` criteria is not treated as a default scene for
action contexts where none of its criteria are relevant.

If two eligible scenes have the same trigger, match specificity, and time or
milestone specificity, the first scene by story sort order and ID wins. This
tie-breaker is deterministic, but it is an authoring warning rather than a
narrative design tool. Story Builder should warn when multiple scenes at the
selected location use the same match and time criteria.

If no scene has matching criteria and no default scene exists for the active
beat and location, the runtime may use a matching ambient scene from elsewhere
in the active arc or from an unassigned location beat in the story content as
prose-only location information. Unassigned location beats are useful for
general hex, room, or exterior-node descriptions that should remain available
when the player explores away from the canonical path. Ambient fallback scenes
do not contribute choices, authored actions, enter effects, complete effects,
or story-beat advancement. The active story beat and its actions remain
stable.

If neither the active beat nor the ambient fallback has matching criteria, the
runtime shows no new prose for that pass. The active story beat and its
actions remain stable.

## Triggers

Every scene has exactly one primary trigger:

| Trigger | Meaning |
| --- | --- |
| Outdoor hex | Eligible while the player stands in that hex |
| Indoor room | Eligible while the player is in that room |
| Exterior node | Eligible at a building's exterior waypoint |
| Event | Eligible when code explicitly refreshes story for that named event |

Location triggers include `place: outdoors` or `place: indoors`. Event
triggers do not use a place.

Switching from the outdoor hex map to a local grid map is not a story event.
It is a change of map perspective. After the switch, the runtime evaluates the
normal indoor location trigger for the selected exterior node. Use a distinct
exterior-node scene for each local-map arrival stand that needs its own prose.
Event scenes remain available only for explicit named events requested by code.

Indoor stand movement refines the avatar position within a room but does not
change room-level trigger behavior. See
[indoor-stands.md](indoor-stands.md). Stand-level story triggers are a possible
later extension and are not part of the current scene schema.

## Optional Match Criteria

`match` contains small, targeted action-context criteria used after the primary
trigger matches. It is not a general-purpose requirements system. It should
grow one concrete authoring need at a time.

The supported criteria are:

| Criterion | Applies during | Meaning |
| --- | --- | --- |
| `originHex` | `enterOutdoorHex` | Neighboring outdoor hex the avatar entered from during inter-hex movement |
| `mapTransition` | `enterIndoorLocation`, `exitLocalMap` | Map transition ID used to switch between regional and local maps |
| `transitionDirection` | `enterIndoorLocation`, `exitLocalMap` | Optional direction filter: `toLocal` or `toRegional` |

`originHex` example:

```yaml
id: utility-yard-from-flats
trigger: { place: outdoors, hex: utility-yard }
match: { originHex: the-flats }
prose: The riverbank path drops Zanzibar into the yard near the intake approach.
```

`originHex` means the neighboring outdoor hex the avatar entered from. The
runtime reads it from `outdoor.state.previousId`, the same movement hint used
to choose destination stands. It is valid only on outdoor hex scenes.
`originHex` may be one neighboring hex ID or a list of neighboring hex IDs
when the same scene should match multiple approaches.

`mapTransition` examples:

```yaml
id: large-bay-from-man-door-path
trigger: { place: indoors, exteriorNode: large-bay-man-front }
match: { mapTransition: man-door-path, transitionDirection: toLocal }
prose: The path from the pines ends at the large bay door.

id: utility-yard-from-garage
trigger: { place: outdoors, hex: utility-yard }
match: { mapTransition: garage-exit, transitionDirection: toRegional }
prose: Zanzi stands back in the gravel apron before the garage doors.
```

`mapTransition` is set when the player switches between the regional world map
and a local map. `transitionDirection: toLocal` applies after entering the
local map and evaluating the destination indoor trigger. `transitionDirection:
toRegional` applies after returning to the regional map and evaluating the
destination outdoor hex trigger.

The Utility Station workspace in `/builder/world?map=utility-station` shows
associated `toLocal` and `toRegional` scenes on each selected map transition.
Its add/open scene actions route into Story Builder with `mapTransition` and
`transitionDirection` already filled in. Story Builder also supports selecting
a MAP icon on the local map; that selects the transition's local arrival node
so the corresponding exterior-node scene can be edited in context.

## Future Scene Conditions

Future conditions should keep the useful idea of targeted scene selection
without becoming a broad requirements language.

When we have concrete story use cases, add small trigger or condition fields
that match how an author thinks about the scene. Likely examples:

- Story arc or phase, such as Part I, Part II, Part III, hydro restored, or
  post-storm.
- Time of day, story day, elapsed time, and milestone windows, as defined in
  [time.md](time.md) and [milestones.md](milestones.md).
- Season or weather, if the story needs those distinctions.
- One simple story-state flag for bespoke cases that do not deserve their own
  first-class field.

Do not introduce a generic list of items, knowledge, documents, stats, skills,
and mixed boolean groups unless a specific gameplay problem proves that we
need it. Prefer clear author-facing fields over abstract predicates. Add a
condition only when there is an actual scene selection problem in authored
content, and update the runtime, database schema, builder UI, validation,
tests, and this document together.

## First View, Seen State, And Revisit Prose

The first time an eligible scene is presented, the narrative card shows its
`prose`. The scene is then marked **seen** in the player's save data.

When the player later returns:

- If `revisitProse` exists, the narrative card shows it instead of `prose`.
- Otherwise, the original `prose` is shown again.
- The active story beat's choices remain available on both first-view and
  revisit presentations.

`seenSceneIds` is part of the player's save data. Reloading a save therefore
preserves whether a scene should show first-view or revisit prose.

Scene IDs are the keys used in seen state. Renaming a scene ID is treated as an
authoring content change, not a player-save rewrite. Existing saves may
therefore show the renamed scene as unseen.

## Choices

Choices appear in the game's **Choose an Action** panel. Choice order is
author-controlled.

Choices live on the `StoryBeat`, not on the selected `Scene`. Scenes provide
prose variants for the beat. If circumstances need substantially different
choices, the story likely needs a different beat or an explicit authored
action generated by the controller for that beat.

Choices are optional. If a beat has no choices, its visible actions may come
entirely from engine-provided possible actions and authored action references.

A choice contains:

| Field | Effect |
| --- | --- |
| `id` | Stable choice ID |
| `label` | Player-facing action label |
| `action` | Movement, stage view, item, fixture, or other action reference |
| `effects` | Validated effects to apply when selected |
| `timeMinutes` | Optional game-time cost for taking the choice |
| `activity` | Activity profile used when applying the time cost |
| `nextBeat` | Optional explicit beat advance when cleaner than a condition |

Movement choices obey the same reachability checks as ordinary map movement.
An unreachable story choice is hidden or disabled rather than allowing
narrative data to bypass barriers.

Flag changes, validated effects, and optional time costs are committed before
movement. If applying a time cost or effect fails, the player does not move and
the active beat remains active.

A choice with a stage view changes only the stage area above the narrative
card. It does not also move the player, and it leaves the current beat and
choices active. See [stage-views.md](stage-views.md).

If an authored choice and ordinary movement both lead to the same destination,
both may be shown when they express different player intent. Story mode should
not visually reveal which action is canonical; authored labels and generated
movement labels are presented as neutral peers.

## Multiple Scenes

For multiple scenes on one story beat:

- Use mutually exclusive time or milestone criteria where possible.
- Avoid overlapping triggers that can match at the same time.
- The matching scene supplies either prose or revisit prose depending on
  whether it has been seen.

Example progression at one hex:

1. Arrival scene triggered by `time: { days: [1] }`.
2. Storm scene triggered by `storm.active`.
3. Post-power scene triggered by `hydro.online`.
4. Revisit prose from the earliest matching seen scene.

If several matching scenes remain eligible, treat that as an authoring problem
and make the triggers distinct.

## Display Fields

| Field | Display |
| --- | --- |
| Eyebrow | Small uppercase context label above the heading |
| Heading | Narrative-card title |
| Prose | Main text on first presentation |
| Revisit prose | Text on later visits after a scene is seen |

The eyebrow is useful for day, time, phase, or chapter context, such as
`Day 1 - Evening`. All display fields except prose are optional.

## Live Authoring

The builder and game run on the same server:

- Saving validates and commits story content to SQLite.
- Every save creates an immutable revision.
- The server broadcasts a `story.updated` event.
- Open game windows fetch the newer story revision.
- Player location, flags, inventory, movement state, and save data remain
  intact.

If the currently displayed scene is edited, its prose updates in place when it
remains eligible. If it no longer matches, the controller removes it and
evaluates the next eligible scene for the active beat.

Restoring history creates a new revision rather than deleting later history.

Story Builder may rename an existing scene ID. Renaming validates the new ID,
rejects IDs already used by active scenes or existing revision history in the
same story document, and cascades the saved authoring data from the old ID to
the new ID. Player save state is not rewritten.

## Builder Editing Safety

The builder uses explicit Save. When an unsaved draft would be abandoned by a
context change, it offers:

- **Save and continue** - validate, save, then change context.
- **Discard changes** - abandon the draft and change context.
- **Keep editing** - cancel the context change.

Validation failure keeps the author in the current editor with the draft and
field errors intact. Browser close and reload use the browser's native
unsaved-changes warning.

## Persistence

Story definitions and player story state are separate:

| Data | Storage |
| --- | --- |
| Story arcs, beats, scenes, and revision history | `game/content/atomic-adventures.sqlite` |
| Seen scene IDs, entered beats, completed beats, milestones, and gameplay flags | Player save in `localStorage` |
| Play mode and active story arc/beat | Player save in `localStorage` |
| Map and building geometry | `game/content/atomic-adventures.sqlite` |
| YAML story snapshots | Import/export only |

SQLite uses rollback-journal mode so each successful authoring save updates
the tracked database file directly. Committing that file carries story edits to
a remote installation.

## Current Limitations

The current runtime does not yet implement the full target model. Notable
target omissions include:

- canonical SQLite field names for `StoryArc`, `StoryBeat`, and `Scene`;
- `useStoryArc` as the single Story mode controller;
- Story Builder scene authoring nested under story beats;
- authored action editing;
- completion condition editing;
- beat effect editing;
- simulation and mini-game gates;
- images and ambient audio;
- dedicated open-world scene semantics.

Add these deliberately to the runtime, database schema, builder, validation,
tests, and this document together.

## Implementation Map

| Concern | Location |
| --- | --- |
| Story mode controller | `game/src/composables/useStoryArc.js` |
| Scene selection helper | `game/src/composables/` or `game/src/lib/` story helpers |
| Player-facing action integration | `game/src/composables/usePlayPanel.js` |
| Persistent story state | `game/src/composables/useGameState.js` |
| Builder | `game/src/views/BuilderView.vue` |
| Validation and runtime projection | `game/server/story-model.js` |
| SQLite repository and revisions | `game/server/story-repository.js` |
| Content API and live events | `game/server/api.js` |

Tests for scene selection and beat lifecycle belong in
`game/src/composables/` and focused story helper tests.
