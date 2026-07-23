# Location Media and Image Close-Ups

**Status:** Implemented (location images + conditional views)
**Scope:** Playable map stage, location image close-ups, World Builder media authoring, runtime world/building documents

## Purpose

Location media lets authors attach one or more view images to any place the
player can stand in the world. The same capability works for outdoor hexes,
outdoor stand points, indoor rooms, and indoor room stands.

These images are presentational close-ups. They do not change Zanzibar's
logical location, current story beat, available prose, inventory, health,
flags, time, or movement rules. They replace only the map portion of the stage
until the player returns to the map or leaves the represented location.

## Authored Shape

World documents may define a `views` array on:

- outdoor hexes;
- outdoor hex stands;
- indoor rooms;
- indoor room stands.

Each view entry uses this shape:

```yaml
views:
  - id: doorway
    kind: image
    src: views/conference-room-cool-doorway.png
    label: Conference room doorway
    alt: A warm conference room seen from the doorway.
    when:                        # optional — omit to always show
      stationPower: offline      # online | offline
      roomLights: on             # on | off — effective lights (power + closed switch)
      all: []                    # flags that must all be set
      any: []                    # at least one of these flags
      not: []                    # flags that must not be set
      passage: compound-gate     # outdoor passage id
      open: true                 # required open/closed when passage is set
```

Field rules:

- `id` is kebab-case and unique within the owning location.
- `kind` is `image` for this increment.
- `src` follows the same public-asset convention as artifact images. Store the
  path relative to `game/public`, such as `views/conference-room-cool-doorway.png`;
  the runtime renders it as a public URL.
- `label` is a short author-facing and optional UI-facing name.
- `alt` is required before production release for accessibility and for future
  non-visual summaries.
- `when` is optional. When present, **every** filled clause must match or the
  view is hidden. Empty / omitted `when` means the view is always available at
  that location.

### Conditional views (indoor and outdoor)

The same `when` model applies everywhere. Typical uses:

| Goal | Example `when` |
| --- | --- |
| Dark room (lights effectively off) | `roomLights: off` |
| Lit room (power on and wall switch closed) | `roomLights: on` |
| Station power only | `stationPower: online` / `offline` |
| Gate closed vs open photo | `passage: compound-gate` + `open: false` / `true` |

Station power is true when the hydro facility is online or the player has
`hub.hydro_online`. **Room lights** are a second condition. Lighting is authored
on the room (`room.lighting`) in World Builder (style, labels, optional switch
note / near-door, and later load ratings). Player switch state is stored in
indoor facility state (`lightSwitches[roomId]`). Convention: switch **open** =
off (default); switch **closed** = on when power is available. Players may flip
the switch from anywhere in the room (no stand required). Effective
`roomLights: on` requires both station power and a closed switch. Full station
bus, load, and balance rules live in
[station-electrical-grid.md](station-electrical-grid.md).

Legacy outdoor-only shape `{ passage, open }` is still accepted and normalized
into the unified form.

Artifact images live under `game/public/items` and use `items/...` paths.
Location close-up images live under `game/public/views` and use `views/...`
paths. The World Builder should reuse the same public-image picker pattern as
artifact images, pointed at the `views` folder.

The same `views` key is used at every supported location level. Do not create
separate names such as `photos`, `roomImages`, `standImages`, or `closeups`.

## Location Resolution

The available image set is resolved from the player's current location, then
filtered by each view's `when` against current flags, station power, and
passage open state:

1. If the player is on an indoor room stand and that stand has **matching** views, use those.
2. Otherwise, if the current indoor room has matching views, use those.
3. If the player is on an outdoor hex stand and that stand has matching views, use those.
4. Otherwise, if the current outdoor hex has matching views, use those.
5. Otherwise, no location image close-up is available.

Stand-level views intentionally override room or hex views when at least one
stand view matches its conditions. This lets an author show a specific fixture,
table, window, or doorway without moving the player to a new logical room. If
the stand has no matching views (none authored, or all `when` clauses fail),
resolution falls through to the room or hex views.

## Runtime Behavior

When the resolved location has at least one image view:

- the map stage shows a photo or camera icon in the upper-left map control
  area;
- selecting that icon switches the stage from the map to the first available
  resolved image unless the remembered image index for that same location is
  still valid;
- while an image is shown, the control icon changes to a map icon and returns
  to the map stage;
- if more than one image is available, light left and right carousel controls
  move between images without changing the current story beat or player
  location;
- the narrative prose, transient messages, and available action buttons remain
  independent of whether the map or an image is visible.

The selected display mode is remembered per current location while the player
stays there. Opening inventory, checking health, reading a document, or opening
another non-movement stage view must return to the previously selected map or
image display when that temporary view closes.

Movement away from the represented location resets the stage to the map. This
includes outdoor travel, entering or leaving a building, room changes, and
stand changes when the active image came from the previous stand. The runtime
must not keep showing an image for a room, hex, or stand that is no longer the
player's current resolved location.

## Persistence

Location image display state is interface state. It should not be committed as
story progress, inventory state, flags, or authored content.

The runtime may save enough UI state to restore the current map/image mode on
reload, but reload safety is more important than exact restoration. If the
saved location or image reference is stale after a content update, load at the
same logical player location with the map visible.

## World Builder

The World Builder owns authoring for location media because the media is part
of the spatial world document, not story state.

Builder requirements:

- rooms, hexes, outdoor stands, and indoor room stands expose an editable
  ordered `views` list on the selected area/entity;
- **clicking a view drills in**: the inspector shows only that view's editor,
  with a back control to the parent room/hex/stand details (not a stacked form
  under the parent fields);
- authors can add, reorder, edit, and remove image view entries without a code
  change;
- each view exposes optional **Show when** controls: station power, flag all /
  any / not lists, and outdoor passage open/closed;
- the list shows a short human summary of each view's conditions;
- World Builder map and inspector share remaining width evenly by default, with
  a draggable divider (object browser stays fixed width);
- `src` accepts public asset paths under `views/` and should preview the image
  when reachable;
- validation rejects duplicate view IDs within the owning location, unsupported
  kinds, empty `src` values, malformed source paths, and invalid `when`
  clauses;
- validation warns for missing `alt` or unreachable local public assets.

YAML import/export must preserve `views` arrays (including `when`) on all
supported location levels. SQLite remains canonical; YAML is only a snapshot
format.

## Tests

Tests for this feature should protect player-visible behavior rather than
implementation shape:

- a room with a view exposes the map-stage photo control;
- clicking the photo control displays the room image and changes the control to
  a map return action;
- multiple images expose working previous/next controls and preserve the same
  story prose/actions;
- inventory, health, document, and other non-movement stage views restore the
  prior map/image mode when closed;
- movement to another room, stand, or outdoor location returns to the map and
  does not show stale media;
- views with `when.stationPower` appear only when station power matches;
- views with flag / passage conditions filter the same way indoors and outdoors;
- builder validation rejects malformed view entries and YAML export/import
  round-trips valid room, hex, and stand views including `when`.

Do not add tests that merely assert CSS selectors, component names, or exact UI
copy. A good test should fail if the player cannot actually switch between the
map and the authored image or if stale location media remains visible after
movement.
