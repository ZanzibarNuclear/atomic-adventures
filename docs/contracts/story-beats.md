# Story Beats

**Status:** Source of truth for the current Part I story-beat runtime and authoring behavior  
**Scope:** `game/` story builder, content API, game state, and `useStory`

---

## Purpose

A **beat** is the current game engine's unit of location-triggered narrative. It
attaches prose and optional choices to a hex, room, exterior node, or named
event. Beats are authored in the story builder at `/builder/story`, stored in
`game/content/atomic-adventures.sqlite`, and delivered to the game through the
local content API.

This document describes the behavior implemented today. The broader passage
format in `game-design/content/story/story-data-format.md` includes planned features
that the current beat engine does not yet support.

## Beat Selection

Whenever the player changes location, flags change, the game starts, or live
story content is updated, the engine evaluates beats for the current story
area.

A beat is eligible when:

1. Its trigger matches the current location or event.
2. Every authored `match` criterion matches the current context.

If multiple beats match the same location, the runtime prefers the eligible beat
with the most authored matching criteria. A beat with `match.originHex` is more
specific than a default beat with no `match`, so it wins when the player entered
from that origin. A default beat remains eligible as fallback when no
origin-specific beat matches.

If two eligible beats have the same trigger and the same match specificity, the
first beat by story sort order and ID wins. This tie-breaker is deterministic,
but it is an authoring warning rather than a narrative design tool. The story
builder should warn when multiple beats at the selected location use the same
match criteria.

If no beat has matching criteria and no default beat exists for the location,
the runtime shows no new beat.

Multiple beats on one hex or room are expected, but they should represent
distinct story states. Use trigger flags and seen state to represent different
discoveries, facility states, or story phases:

```yaml
day-1-pines:
  trigger: { place: outdoors, hex: far-pines, flag: day.1 }

day-2-pines:
  trigger: { place: outdoors, hex: far-pines, flag: day.2 }
```

The engine has no built-in calendar yet. Days and phases are represented by
flags established by gameplay.

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
Legacy `require` fields may still exist in old SQLite columns or imported
snapshots, but the runtime, validator, repository, YAML preview, and builder
ignore them.

## Optional Match Criteria

`match` contains small, targeted context criteria used after the primary trigger
matches. It is not the old general-purpose requirements system. It should grow
one concrete authoring need at a time.

The first supported criterion is `originHex`:

```yaml
utility-yard-from-flats:
  trigger: { place: outdoors, hex: utility-yard }
  match: { originHex: the-flats }
  text: The riverbank path drops you into the yard near the intake approach.
```

`originHex` means the neighboring outdoor hex the avatar entered from. The
runtime reads it from `outdoor.state.previousId`, the same movement hint used to
choose destination stands. It is valid only on outdoor hex beats.

Selection examples for `utility-yard`:

- A beat with `match: { originHex: the-flats }` wins over the default
  `utility-yard` beat when the player arrives from `the-flats`.
- The default `utility-yard` beat wins when the player arrives from an origin
  with no matching origin-specific beat.
- If all `utility-yard` beats define nonmatching `originHex` values, no
  `utility-yard` beat is shown.

## Future Beat Conditions

The removed Requirements model was an attempt at general-purpose beat
conditions. It could express many things, but it made ordinary authoring feel
abstract and overbuilt. Future conditions should keep the useful idea, while
avoiding a broad requirements language.

When we have concrete story use cases, add small, targeted trigger fields that
match how an author thinks about the scene. Likely examples:

- Story arc or phase, such as Part I, Part II, Part III, hydro restored, or
  post-storm.
- Time of day, such as morning, afternoon, evening, or night.
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
| `set_flags` | Also sets global flags; retained for schema compatibility |
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

A choice with `view` changes only the stage area above the narrative card. It
does not also move the player, and it leaves the current beat and choices
active. See [stage-views.md](stage-views.md).

Outdoor `go_hex` choices obey the same reachability checks as ordinary map
movement. Unreachable story choices are hidden rather than allowing narrative
data to bypass barriers.

Indoor `go_room` and `go_exterior_node` choices use the same movement handlers
as room and exterior-path map clicks.

If a story choice and ordinary movement both lead to the same destination, the
story choice replaces the generic movement action so the authored label is
shown only once.

## Multiple Beats

For multiple beats at one location:

- Use mutually exclusive flags where possible.
- Avoid overlapping triggers that can match at the same time.
- The matching beat supplies either story text or revisit text depending on
  whether it has been seen.

Example progression at one hex:

1. Arrival beat triggered by `day.1`.
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
| Map and building geometry | `game/content/atomic-adventures.sqlite` |
| YAML story snapshots | Import/export only |

SQLite uses rollback-journal mode so each successful authoring save updates the
tracked database file directly. Committing that file carries story edits to a
remote installation.

## Current Limitations

The current beat engine does not yet implement the full planned passage schema.
Notable omissions include:

- A built-in day/calendar model
- Clearing flags
- Beat-level and choice-specific requirements
- Choice-specific character effects
- Passage-to-passage `go_to`
- Variants
- Simulation and mini-game gates
- Images and ambient audio
- Dedicated fallback/ambient beat semantics

Add these deliberately to the runtime, database schema, builder, validation,
tests, and this document together.

## Implementation Map

| Concern | Location |
| --- | --- |
| Runtime selection and lifecycle | `game/src/composables/useStory.js` |
| Player-facing choice integration | `game/src/composables/usePlayPanel.js` |
| Persistent seen state | `game/src/composables/useGameState.js` |
| Builder | `game/src/views/BuilderView.vue` |
| Validation and runtime projection | `game/server/story-model.js` |
| SQLite repository and revisions | `game/server/story-repository.js` |
| Content API and live events | `game/server/api.js` |

Tests for beat lifecycle belong in `game/src/composables/useStory.test.js`.
