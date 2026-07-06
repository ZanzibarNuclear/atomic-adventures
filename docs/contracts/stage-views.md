# Stage Views

**Scope:** `game/` playable scene, story choices, focused inspection panels, and
close-up surfaces such as room detail, videos, rides, consoles, and simulations.

The stage view is the large viewing area above the narrative card and play
panel. It normally shows the outdoor or indoor map, but story choices and
gameplay actions may temporarily replace it with a focused inspection surface.

## Goals

- Keep the active beat, prose, and choices in place while the player inspects
  inventory, health, objects, videos, monitors, or other close-up content.
- Treat view changes as interface actions, not as persistent story-world
  effects.
- Reuse focused components in both the stage and the full character view where
  practical.
- Keep map movement, story state, character state, and authoring state separate.

## Stage View State

The stage view has this runtime shape:

```js
{
  kind: "map" | "inventory" | "character-stats" | "closeup" |
    "lesson" | "video" | "document" | "console" | "ride" |
    "simulation",
  payload: {}
}
```

`map` means the normal outdoor or indoor map for the current player location.
Other kinds replace only the stage area. The narrative card and play panel
remain mounted below the stage.

The initial stage view is always `map`. Returning to the map clears the stage
payload.

## Story Choice View Actions

Story choices may request a stage view:

```yaml
choices:
  - text: Check your inventory
    view:
      kind: inventory

  - text: Check your health
    view:
      kind: character-stats
      focus: health
```

A view choice:

- may also set flags and spend authored time;
- must not also move the player with `go_hex`, `go_room`, or `enter`;
- does not clear the active beat by default;
- marks the beat seen, like other presented or selected story choices;
- changes only the stage area.

Movement choices keep their existing behavior: flags and time are applied first,
then the player moves and the current beat clears.

In story mode, stage-view opening is also subject to the active storyline
action policy. A view that is valid in open-world mode may be hidden or blocked
during a canonical step unless that step allows it. Returning from a focused
stage view to the map is an interface action and should remain available unless
a future contract explicitly defines a modal forced-view sequence.

## Focused Inventory

Inventory browsing is a focused component, not owned by the full character
sheet. It should support:

- holder groups for carried and nearby items;
- item selection;
- item details;
- authored item actions;
- item transfers where valid.

The full `CharacterView` may embed the same focused inventory component inside
its Inventory tab. The stage inventory view uses that same component as the
primary inspection surface.

## Character Stats

Character stats may appear in two contexts:

- the full character overview;
- the `character-stats` stage view.

The `character-stats` stage view accepts an optional `focus` payload. For now
`focus: "health"` highlights health if that stat exists; unknown focus values
show the ordinary stat list.

## Close-Up Stage Kinds

Close-up views are the family of focused surfaces that temporarily replace the
map without changing logical location. Some close-ups use a generic `closeup`
kind; others use a specialized kind when the runtime needs distinct validation
or completion rules:

- `closeup` for room details, eBuggy inspection, equipment panels, and other
  static or interactive object views;
- `lesson` or `video` for holo-reader lessons and media surfaces;
- `console` for control-room monitors;
- `document` for authored documents;
- `ride` for buggy rides and other authored travel presentations;
- `simulation` for embedded simulations.

Only add payload validation for a kind when the game has a concrete use case
for that kind.
