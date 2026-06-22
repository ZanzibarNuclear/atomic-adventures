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
story content is updated, the engine evaluates beats in ascending authoring
order.

A beat is eligible when:

1. Its trigger matches the current location or event.

The first eligible beat wins. This means order matters when multiple beats can
match the same place and state.

Multiple beats on one hex or room are expected. Use ordering, trigger flags,
and seen state to represent different discoveries, facility states, or story
phases:

```yaml
day-1-pines:
  order: 10
  trigger: { place: outdoors, hex: far-pines, flag: day.1 }

day-2-pines:
  order: 20
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

The current Part I event is `enter-building`. Event beats are evaluated when
the player transitions from outdoors into the indoor scene.

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

## Requires Choice

The builder label **Requires choice** maps to `acknowledge`.

When enabled:

- The beat remains pending until the player chooses one of its authored
  choices.
- The choice can set story flags, advance game time, and optionally move the
  player.
- Selecting a valid choice can keep the same beat active, advance state through
  flags, or move the player.

When disabled:

- The prose is informational and does not require a story action.
- The beat is marked seen on presentation.
- Normal map movement and other gameplay actions remain available.

A beat that requires a choice should have at least one usable choice. The
current validator permits an empty choice list, but such a beat cannot complete
through the story UI and should be considered an authoring error.

## Choices

Choices appear in the game's **Choose an Action** panel. Choice order is
author-controlled.

Choices stay intentionally small so ordinary navigation and story actions do
not sprawl across every action.

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
| `enter` | Enters the current building |

A choice may have at most one movement destination. Flag changes and optional
time costs are committed before movement. If applying a time cost fails, the
player does not move and the beat remains pending.

Outdoor `go_hex` choices obey the same reachability checks as ordinary map
movement. Unreachable story choices are hidden rather than allowing narrative
data to bypass barriers.

If a story choice and ordinary movement both lead to the same destination, the
story choice replaces the generic movement action so the authored label is
shown only once.

## Ordering and Multiple Beats

Beat order is global within the current story area. The runtime receives beats
in that order and selects the first match.

For multiple beats at one location:

- Put more specific or earlier-phase beats before broad fallback beats.
- Use mutually exclusive flags where possible.
- The first eligible beat supplies either story text or revisit text depending
  on whether it has been seen.

Example progression at one hex:

1. Arrival beat triggered by `day.1`.
2. Storm beat triggered by `storm.active`.
3. Post-power beat triggered by `hydro.online`.
4. Revisit prose from the earliest matching seen beat.

If several matching beats remain eligible, the first one in beat order wins.

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
| Map and building geometry | `game/content/world/*.yaml` |
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
