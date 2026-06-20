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
2. Its `require` conditions are satisfied.
3. If `once` is enabled, it has not already been seen.

The first eligible unseen beat wins. If no new beat is eligible, the engine
looks for revisit prose from a previously seen beat at the current location.
This means order matters when multiple beats can match the same place and state.

Multiple beats on one hex or room are expected. Requirements can make them
represent different days, discoveries, facility states, or story phases:

```yaml
day-1-pines:
  order: 10
  trigger: { place: outdoors, hex: far-pines }
  require: { all: [day.1] }

day-2-pines:
  order: 20
  trigger: { place: outdoors, hex: far-pines }
  require: { all: [day.2] }
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
gating should use `require`, which is clearer in the builder and supports
multiple conditions.

## Requirements

Beat and choice requirements use the shared character requirement language.
They can check flags, carried items and quantities, stats, knowledge, skill
ranks or evidence, quest state, and discovered documents. All populated
domains must pass.

The legacy root-level flag groups remain supported:

| Field | Rule |
| --- | --- |
| `all` | Every listed flag must be set |
| `any` | At least one listed flag must be set |
| `not` | None of the listed flags may be set |

For example:

```yaml
require:
  all: [day.2]
  any: [hydro.online, campus.backup-power]
  not: [storm.active]
```

Requirements control eligibility; they do not automatically set or clear
flags.

Character-aware examples:

```yaml
require:
  items: [lobby-exterior-key]
  knowledge: [hydro-basics]
  skills:
    - { id: hydro-operations, op: gte, rank: 1 }
```

A beat whose requirements fail is not selected. A choice whose requirements
fail remains visible but disabled.

## First View, Seen State, and Revisit Text

The first time an eligible beat is presented, the narrative card shows its
`text`. A one-time beat becomes **seen** in one of two ways:

1. **Requires choice enabled (`acknowledge: true`)** — the beat becomes seen
   when the player selects one of its choices.
2. **Requires choice disabled (`acknowledge: false`)** — the beat becomes seen
   immediately when its story text is presented.

For a no-acknowledgement beat, marking it seen does not replace the card during
the current visit. The original story text remains visible until the player
leaves or another narrative transition occurs.

When the player later returns:

- If `revisit` exists, the narrative card shows it.
- Otherwise, the original `text` is reused as the revisit prose.
- Revisit cards do not offer the beat's choices.

`storySeen` is part of the player's save data. Reloading a save therefore
preserves whether a one-time beat should show first-view or revisit prose.

### Repeatable beats

When `once` is disabled, the beat is not stored in `storySeen`. It remains a new
eligible beat each time the trigger and requirements match. The current engine
does not use `revisit` for repeatable beats.

## Requires Choice

The builder label **Requires choice** maps to `acknowledge`.

When enabled:

- The beat remains pending until the player chooses one of its authored
  choices.
- The choice can apply an ordered, atomic effect list and optionally move the
  player.
- Selecting a valid choice marks a one-time beat seen.

When disabled:

- The prose is informational and does not require a story action.
- A one-time beat is marked seen on presentation.
- Normal map movement and other gameplay actions remain available.

A beat that requires a choice should have at least one usable choice. The
current validator permits an empty choice list, but such a beat cannot complete
through the story UI and should be considered an authoring error.

## Choices

Choices appear in the game's **Choose an Action** panel. Choice order is
author-controlled.

The Story Builder exposes character catalog selectors for beat/choice
requirements and ordered effects. Flag aliases remain editable alongside the
generic controls during migration.

A choice contains:

| Field | Effect |
| --- | --- |
| `text` | Player-facing action label |
| `require` | Shared character/flag requirements for enabling the choice |
| `effects` | Ordered atomic effects on flags and character state |
| `sets` | Sets global flags |
| `set_flags` | Also sets global flags; retained for schema compatibility |
| `go_hex` | Moves to a reachable outdoor hex |
| `go_room` | Moves to an indoor room |
| `enter` | Enters the current building |

A choice may have at most one movement destination. Effects are validated and
committed before movement. If any effect fails, none are committed, the player
does not move, and the beat remains pending. `sets` and `set_flags` are
migration aliases for `flag.set` effects.

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
- A new eligible unseen beat takes priority over revisit prose.
- Once all eligible one-time beats have been seen, the first matching seen
  beat with revisit prose supplies the ambient narrative.

Example progression at one hex:

1. Arrival beat requiring `day.1`.
2. Storm beat requiring `storm.active`.
3. Post-power beat requiring `hydro.online`.
4. Revisit prose from the earliest matching seen beat when no new beat applies.

If several revisit beats remain eligible, the first one in beat order wins.

## Display Fields

| Field | Display |
| --- | --- |
| Eyebrow | Small uppercase context label above the heading |
| Heading | Narrative-card title |
| Story text | Main prose on first presentation |
| Revisit text | Prose on later visits after a one-time beat is seen |

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
- Choice-specific requirements
- Clearing flags
- Items and documents in story beats
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
