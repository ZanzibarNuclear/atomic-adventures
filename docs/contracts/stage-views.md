# Stage Views

**Scope:** `game/` playable scene, story choices, focused inspection panels, and
close-up surfaces such as location images, room detail, videos, rides, consoles,
and simulations.

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

In story mode, stage-view opening is also subject to the active story beat and
visible story action set. A view that is valid in open-world mode may be hidden
or blocked during a canonical beat unless that beat allows it. Returning from a
focused stage view to the map is an interface action and should remain
available unless a future contract explicitly defines a modal forced-view
sequence.

## Focused Inventory

Inventory browsing is a focused component, not owned by the character sheet.
Inventory is possessions; the character sheet is attributes and progression.
See [character-inventory.md](character-inventory.md).

Inventory UI should support:

- holder groups for carried and nearby items;
- item selection;
- item details;
- authored item actions;
- item transfers where valid.

The stage inventory view (`kind: inventory`) and the inventory dialog/trunk use
the same focused inventory component. Story or action payloads that open
inventory use that stage view — not a tab on `CharacterView`.

Physical documents (manuals, cards) are inventory items. Opening one uses the
`document` stage view. Learning from a document grants **knowledge** on the
character sheet; there is no separate documents panel on the character UI.

## Character Sheet and Stats

`CharacterView` is a tabless dashboard:

- **Health** — wellbeing vitals and conditions (narrow card);
- **Knowledge** and **Skills** — stacked in one right-hand column.

It does not embed inventory, a documents codex, or quest tabs. Quests may gain a
dedicated surface later; they are not part of this sheet by default.

Character stats may also appear in the `character-stats` stage view. That view
accepts an optional `focus` payload. For now `focus: "health"` highlights
health if that stat exists; unknown focus values show the ordinary stat list.

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

## Location Image Close-Ups

Location image close-ups are the first generic `closeup` surface. They are
authored on world locations, not on story beats. See
[location-media.md](location-media.md) for the authored shape and resolution
rules.

When the current location resolves to one or more authored image views, the map
stage exposes a photo or camera icon. Activating it replaces the map with the
selected image in the same stage area. While an image is visible, the same
control position exposes a map icon that restores the map.

The image close-up must not change the active beat, prose, transient messages,
available action buttons, inventory, health, flags, time, movement state, or
save data. Carousel controls for multiple images are also view-only.

Stage-view restoration must distinguish movement from temporary inspection:

- non-movement views such as inventory, health, documents, lessons, or
  information cards return to the previously selected map or image display when
  closed;
- movement away from the represented hex, room, or stand returns to `map`
  because the previous image is no longer relevant.
