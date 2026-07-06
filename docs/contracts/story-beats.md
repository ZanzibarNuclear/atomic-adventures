# Story Beats

**Status:** Source of truth for story-beat prose, triggers, choices, and mode scoping
**Scope:** `game/` story builder, content API, game state, and `useStory`

---

## Purpose

A **beat** is the game engine's unit of triggered narrative prose. It attaches
Zanzibar's authored voice, open-world area description, and optional small
choices to a hex, room, exterior node, named event, or active storyline step. Beats are
authored in the story builder at `/builder/story`, stored in
`game/content/atomic-adventures.sqlite`, and delivered to the game through the
local content API.

Beats are not the global quest engine. They do not own play-mode selection,
current objectives, broad action gating, forced movement, forced time passage,
or canonical story sequencing. Those responsibilities belong to the storyline
controller described in [play-modes-and-storyline.md](play-modes-and-storyline.md).

This document describes implemented beat behavior plus the planned alpha
mode-scoping fields required by the dual-mode split. The broader passage format
in `game-design/content/story/story-data-format.md` includes planned features
that the current beat engine does not yet support.

## Relationship to Play Modes

The game has two explicit modes:

- `storyline`: the player experiences Zanzibar's canonical story from his
  point of view. Beats may describe memory, fear, guesswork, fatigue, hunger,
  thirst, and discovery in Zanzibar's authored voice.
- `open-world`: the player explores freely, with ordinary world, facility,
  character, inventory, and movement rules providing safety rails. Beats should
  read as general area descriptions or player-authored discovery prompts, not
  as Zanzibar's required canonical path.

Beats may be scoped to one or both modes:

```yaml
modes: [story]
storylineStep: understand-building
```

Rules:

- Omitting `modes` keeps the beat eligible in both modes when its trigger and
  other criteria match.
- `modes: [story]` makes the beat eligible only in story-mode saves.
- `modes: [open-world]` makes the beat eligible only in open-world saves.
- `storylineStep` restricts the beat to the named active storyline step and
  implies storyline eligibility.
- Storyline-scoped beats should preserve the canonical story thread and
  Zanzibar's authored voice. They may imply his uncertainty and should avoid
  naming undiscovered places, artifacts, or systems before he learns them.
- Open-world-scoped beats should avoid implying that the player is Zanzibar,
  that canonical timing is happening, or that required story beats have occurred.
  They can describe what is physically present, what the player notices, and
  what systems are available for experimentation.

The active storyline step may select or prefer a beat by ID. A step-associated
beat still uses normal validation and display fields; the step owns objective,
story-continuing action references, completion, and forced effects.

## Voice And Knowledge

Storyline and open-world beats are allowed to describe the same place
differently because they answer different questions:

- Storyline beat: "What does Zanzibar think, fear, remember, or infer at this
  moment in the canonical story?"
- Open-world beat: "What can a player observe or do here without assuming a
  canonical protagonist or sequence?"

Storyline beats must preserve discovery order. At the beginning of Part I,
Zanzibar does not know there is a utility station, an eBuggy, a hydro plant, a
startup card, or a kitchen. Opening beats should use immediate, grounded
language: slope, forest, hunger, thirst, light, wind, path, fence, gate, road,
shelter. Later beats may name the utility station, control room, intake, and
hydro equipment only after the story has made those discoveries available.

Open-world beats may be more neutral and reusable. They should not borrow
Zanzibar's internal monologue unless explicitly authored as a Zanzibar
storyline beat.

## Beat Selection

Whenever the player changes location, flags change, the game starts, or live
story content is updated, the engine evaluates beats for the current story
area using the current story action context. The action context describes why
story is being evaluated, such as:

| Action context | Meaning |
| --- | --- |
| `enterOutdoorHex` | The player moved from one outdoor hex into another |
| `exitLocalMap` | The player returned from a local/grid map to an outdoor hex |
| `enterIndoorLocation` | The player entered or moved within an indoor/local map location |
| `event` | Code explicitly requested a named story event |
| `ambientRefresh` | Story refreshed because flags, save state, startup, or live content changed |

A beat is eligible when:

1. Its trigger matches the current location or event.
2. Its optional `modes` and `storylineStep` match the current play mode and
   active storyline step.
3. Every authored `match` criterion relevant to the current action context
   matches that context.
4. Every authored time and milestone criterion matches the current clock and
   player progression state.

If multiple beats match the same location, the runtime prefers the eligible beat
with the most matching criteria relevant to the current action context. A beat
with `match.originHex` is more specific than a default beat with no `match`
during inter-hex travel, so it wins when the player entered from that origin. A
beat with `match.mapTransition` is more specific than a default beat with no
`match` when switching between the regional and local maps. A default beat
remains eligible when no action-specific beat matches.
Time criteria also add specificity among beats at the same trigger. A Day 2
morning room beat should win over a generic room beat when the clock and
milestone state make both eligible.

Authored `match` criteria from other action contexts are ignored for the current
selection pass. This means one beat may include both `originHex` and
`mapTransition`: the same beat can be selected when entering an outdoor hex from
a neighboring hex and when switching through a matching map transition. A beat
with authored `match` criteria is not treated as a default beat for action
contexts where none of its criteria are relevant.

If two eligible beats have the same trigger, match specificity, and time or
milestone specificity, the first beat by story sort order and ID wins. This
tie-breaker is deterministic, but it is an authoring warning rather than a
narrative design tool. The story builder should warn when multiple beats at the
selected location use the same match and time criteria.

If no beat has matching criteria and no default beat exists for the location,
the runtime shows no new beat.

Multiple beats on one hex or room are expected, but they should represent
distinct story states. Use time criteria, milestone criteria, trigger flags,
and seen state to represent different discoveries, facility states, or story
phases:

```yaml
day-1-pines:
  trigger: { place: outdoors, hex: far-pines }
  time: { days: [1] }

day-2-pines:
  trigger: { place: outdoors, hex: far-pines }
  time: { days: [2] }
```

Temporal predicates are derived from the authored clock; authored milestones
are sparse recorded facts. See [time.md](time.md) for clock criteria and
[milestones.md](milestones.md) for milestone semantics.

## Triggers

Every beat has exactly one primary trigger:

| Trigger | Meaning |
| --- | --- |
| Outdoor hex | Eligible while the player stands in that hex |
| Indoor room | Eligible while the player is in that room |
| Exterior node | Eligible at a building's exterior waypoint |
| Event | Eligible when code explicitly refreshes story for that named event |

Location triggers include `place: outdoors` or `place: indoors`. Event triggers
do not use a place.

Switching from the outdoor hex map to a local grid map is not a story event.
It is a change of map perspective. After the switch, the runtime evaluates the
normal indoor location trigger for the selected exterior node. Use a distinct
exterior-node beat for each local-map arrival stand that needs its own prose.
Event beats remain available only for explicit named events requested by code.

Indoor stand movement refines the avatar position within a room but does not
change room-level trigger behavior. See
[indoor-stands.md](indoor-stands.md). Stand-level story triggers are a possible
later extension and are not part of the current beat schema.

An optional trigger flag may further restrict a location trigger. Most state
gating should be handled with separate beats and clear story flags. The current
story beat engine intentionally has no beat-level or choice-level requirements.
Imported content must use the current schema before it can be stored or served
to the runtime.

## Optional Match Criteria

`match` contains small, targeted action-context criteria used after the primary
trigger matches. It is not the old general-purpose requirements system. It
should grow one concrete authoring need at a time.

The supported criteria are:

| Criterion | Applies during | Meaning |
| --- | --- | --- |
| `originHex` | `enterOutdoorHex` | Neighboring outdoor hex the avatar entered from during inter-hex movement |
| `mapTransition` | `enterIndoorLocation`, `exitLocalMap` | Map transition ID used to switch between regional and local maps |
| `transitionDirection` | `enterIndoorLocation`, `exitLocalMap` | Optional direction filter: `toLocal` or `toRegional` |

`originHex` example:

```yaml
utility-yard-from-flats:
  trigger: { place: outdoors, hex: utility-yard }
  match: { originHex: the-flats }
  text: The riverbank path drops you into the yard near the intake approach.
```

`originHex` means the neighboring outdoor hex the avatar entered from. The
runtime reads it from `outdoor.state.previousId`, the same movement hint used to
choose destination stands. It is valid only on outdoor hex beats. `originHex`
may be one neighboring hex ID or a list of neighboring hex IDs when the same
beat should match multiple approaches.

`mapTransition` examples:

```yaml
large-bay-from-man-door-path:
  trigger: { place: indoors, exteriorNode: large-bay-man-front }
  match: { mapTransition: man-door-path, transitionDirection: toLocal }
  text: The path from the pines ends at the large bay door.

utility-yard-from-garage:
  trigger: { place: outdoors, hex: utility-yard }
  match: { mapTransition: garage-exit, transitionDirection: toRegional }
  text: Zanzi stands back in the gravel apron before the garage doors.
```

`mapTransition` is set when the player switches between the regional world map
and a local map. `transitionDirection: toLocal` applies after entering the local
map and evaluating the destination indoor trigger. `transitionDirection:
toRegional` applies after returning to the regional map and evaluating the
destination outdoor hex trigger.

The Utility Station workspace in `/builder/world?map=utility-station` shows
associated `toLocal` and `toRegional` beats on each selected map transition.
Its add/open beat actions route into Story Builder with `mapTransition` and
`transitionDirection` already filled in. Story Builder also supports selecting
a MAP icon on the local map; that selects the transition's local arrival node
so the corresponding exterior-node beat can be edited in context.

`originHex` and `mapTransition` are different action-context criteria. They may
be authored on the same beat, but they are never evaluated in the same
beat-selection pass. During `enterOutdoorHex`, only `originHex` participates in
selection. During map switching, `mapTransition` participates when the optional
`transitionDirection` matches the current direction.

Selection examples for `utility-yard`:

- A beat with `match: { originHex: the-flats }` wins over the default
  `utility-yard` beat when the player moves from `the-flats` into
  `utility-yard`. Beats with only `match.mapTransition` are not eligible for this
  inter-hex selection pass.
- A beat with `match: { originHex: [north-bend, east-pines] }` wins over the
  default `utility-yard` beat when the player moves from either listed adjacent
  hex into `utility-yard`.
- A beat with `match: { mapTransition: garage-exit, transitionDirection: toRegional }`
  wins over the default `utility-yard` beat when the player returns to the
  world through the garage map transition. Beats with only `match.originHex`
  are not eligible for this map-transition selection pass.
- A beat with `match: { originHex: the-flats, mapTransition: garage-exit }` can
  be selected by either action. The runtime considers only `originHex` during
  inter-hex movement and only `mapTransition` during map switching.
- The default `utility-yard` beat wins when the current action has no matching
  specific beat.
- If all `utility-yard` beats define nonmatching criteria for the current
  action and no default beat exists, no `utility-yard` beat is shown.

## Storyline Step Criteria

`storylineStep` is a mode-specific criterion, not a replacement for location or
event triggers. It should be used when a beat belongs to a canonical story step
instead of being ordinary ambient location prose.

Example:

```yaml
hydro-card-on-console:
  modes: [story]
  storylineStep: understand-building
  trigger: { place: indoors, room: control-room }
  heading: Startup card
  text: The laminated card waits beside the console, exactly where someone
    hoped a future operator would find it.
```

The beat can be selected only while the active playthrough is in story mode
and the current scenario step is `understand-building`. The storyline step still
owns the objective text, the allowed action set, and any completion condition
such as reading or taking the card.

Use `storylineStep` for canonical sequencing. Use ordinary location, time,
milestone, and mode criteria for ambient discovery text.

## Future Beat Conditions

The removed Requirements model was an attempt at general-purpose beat
conditions. It could express many things, but it made ordinary authoring feel
abstract and overbuilt. Future conditions should keep the useful idea, while
avoiding a broad requirements language.

When we have concrete story use cases, add small, targeted trigger fields that
match how an author thinks about the scene. Likely examples:

- Story arc or phase, such as Part I, Part II, Part III, hydro restored, or
  post-storm.
- Time of day, story day, elapsed time, and milestone windows, as defined in
  [time.md](time.md) and [milestones.md](milestones.md).
- Season or weather, if the story needs those distinctions.
- One simple story-state flag for bespoke cases that do not deserve their own
  first-class field.

Do not reintroduce a generic list of items, knowledge, documents, stats,
skills, and mixed boolean groups unless a specific gameplay problem proves that
we need it. Prefer clear author-facing fields over abstract predicates. Add a
condition only when there is an actual beat selection problem in authored
content, and update the runtime, database schema, builder UI, validation, tests,
and this document together.

## First View, Seen State, and Revisit Text

The first time an eligible beat is presented, the narrative card shows its
`text`. The beat is then marked **seen** in the player's save data.

When the player later returns:

- If `revisit` exists, the narrative card shows it instead of `text`.
- Otherwise, the original `text` is shown again.
- Choices remain available on both first-view and revisit presentations.

`storySeen` is part of the player's save data. Reloading a save therefore
preserves whether a beat should show first-view or revisit prose.

Beat IDs are the keys used in `storySeen`. Renaming a beat ID is treated as an
authoring content change, not a player-save rewrite. Existing saves may
therefore show the renamed beat as unseen.

## Choices

Choices appear in the game's **Choose an Action** panel. Choice order is
author-controlled.

Choices are optional. If a beat has no choices, it is ambient/location prose. If
a beat has choices, the available choices are shown whenever the beat is active,
including revisit presentations. Choices stay intentionally small so ordinary
navigation and story actions do not sprawl across every action.

Future choice visibility rules should be simple and targeted, like future beat
conditions. Wait for a concrete use case before adding them.

A choice contains:

| Field | Effect |
| --- | --- |
| `text` | Player-facing action label |
| `sets` | Sets global flags |
| `set_flags` | Sets global flags for content that shares the passage/action vocabulary |
| `timeMinutes` | Optional game-time cost for taking the choice |
| `activity` | Activity profile used when applying the time cost |
| `go_hex` | Moves to a reachable outdoor hex |
| `go_room` | Moves to an indoor room |
| `go_exterior_node` | Moves to an exterior path node on the indoor building map |
| `enter` | Enters the current building |
| `view` | Opens a focused stage view such as inventory or character stats |

A choice may have at most one movement destination. Flag changes and optional
time costs are committed before movement. If applying a time cost fails, the
player does not move and the beat remains active.

In story mode, choice visibility is additionally filtered by the active
storyline action policy when the choice performs a story-sensitive action,
opens a stage view, mutates inventory/facility state, or reveals future
knowledge. Ordinary movement choices should remain visible when the movement is
physically valid, including story-continuing paths and bounded curiosity
detours. Storyline policy cannot make an otherwise invalid destination
or action valid.

A choice with `view` changes only the stage area above the narrative card. It
does not also move the player, and it leaves the current beat and choices
active. See [stage-views.md](stage-views.md).

Outdoor `go_hex` choices obey the same reachability checks as ordinary map
movement. Unreachable story choices are hidden rather than allowing narrative
data to bypass barriers.

Indoor `go_room` and `go_exterior_node` choices use the same movement handlers
as room and exterior-path map clicks.

If a storyline choice and ordinary movement both lead to the same destination,
both may be shown when they express different player intent. Story mode should
not visually reveal which action is canonical; authored labels and generated
movement labels are presented as neutral peers.

## Multiple Beats

For multiple beats at one location:

- Use mutually exclusive time or milestone criteria where possible.
- Avoid overlapping triggers that can match at the same time.
- The matching beat supplies either story text or revisit text depending on
  whether it has been seen.

Example progression at one hex:

1. Arrival beat triggered by `time: { days: [1] }`.
2. Storm beat triggered by `storm.active`.
3. Post-power beat triggered by `hydro.online`.
4. Revisit prose from the earliest matching seen beat.

If several matching beats remain eligible, treat that as an authoring problem
and make the triggers distinct.

## Display Fields

| Field | Display |
| --- | --- |
| Eyebrow | Small uppercase context label above the heading |
| Heading | Narrative-card title |
| Story text | Main prose on first presentation |
| Revisit text | Prose on later visits after a beat is seen |

The eyebrow is useful for day, time, phase, or chapter context, such as
`Day 1 · Evening`. All display fields except story text are optional.

## Live Authoring

The builder and game run on the same server:

- Saving validates and commits the beat to SQLite.
- Every save creates an immutable revision.
- The server broadcasts a `story.updated` event.
- Open game windows fetch the newer story revision.
- Player location, flags, inventory, movement state, and save data remain
  intact.

If the currently displayed beat is edited, its prose and choices update in
place when it remains eligible. If it no longer matches, the engine removes it
and evaluates the next eligible beat.

Restoring history creates a new revision rather than deleting later history.

The story builder may rename an existing beat ID. Renaming validates the new ID,
rejects IDs already used by active beats or existing revision history in the
same area, and cascades the saved authoring data from the old ID to the new ID:
the beat row, choices, revision history, runtime story export key, and live
authoring update all use the new ID after the save. Player save state is not
rewritten.

## Builder Editing Safety

The builder uses explicit Save. When an unsaved draft would be abandoned by a
context change, it offers:

- **Save and continue** — validate, save, then change context.
- **Discard changes** — abandon the draft and change context.
- **Keep editing** — cancel the context change.

Validation failure keeps the author in the current editor with the draft and
field errors intact. Browser close and reload use the browser's native
unsaved-changes warning.

## Persistence

Story definitions and player story state are separate:

| Data | Storage |
| --- | --- |
| Beat definitions and revision history | `game/content/atomic-adventures.sqlite` |
| Seen beat IDs and gameplay flags | Player save in `localStorage` |
| Play mode and active storyline step | Player save in `localStorage` |
| Map and building geometry | `game/content/atomic-adventures.sqlite` |
| YAML story snapshots | Import/export only |

SQLite uses rollback-journal mode so each successful authoring save updates the
tracked database file directly. Committing that file carries story edits to a
remote installation.

## Current Limitations

The current beat engine does not yet implement the full planned passage schema.
Notable omissions include:

- Clearing flags
- Beat-level and choice-specific requirements
- Choice-specific character effects
- Passage-to-passage `go_to`
- Variants
- Simulation and mini-game gates
- Images and ambient audio
- Dedicated ambient beat semantics

Add these deliberately to the runtime, database schema, builder, validation,
tests, and this document together.

Broad storyline requirements, objectives, action gates, forced movement, and
forced time passage are not beat limitations to close inside this document.
They belong to [play-modes-and-storyline.md](play-modes-and-storyline.md).

## Implementation Map

| Concern | Location |
| --- | --- |
| Runtime selection and lifecycle | `game/src/composables/useStory.js` |
| Player-facing choice integration | `game/src/composables/usePlayPanel.js` |
| Persistent seen state | `game/src/composables/useGameState.js` |
| Play mode and storyline action policy | `game/src/composables/useStoryline.js` or equivalent |
| Builder | `game/src/views/BuilderView.vue` |
| Validation and runtime projection | `game/server/story-model.js` |
| SQLite repository and revisions | `game/server/story-repository.js` |
| Content API and live events | `game/server/api.js` |

Tests for beat lifecycle belong in `game/src/composables/useStory.test.js`.
