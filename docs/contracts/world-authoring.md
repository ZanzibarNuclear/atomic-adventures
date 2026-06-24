# World Authoring

**Status:** Implemented outdoor-world authoring contract  
**Scope:** `game/` world builder, outdoor content API, runtime map loading, and revisions

## Purpose

The World Builder edits the spatial and movement model used by the playable
game. It is deliberately separate from Story Builder:

| Route | Responsibility |
| --- | --- |
| `/builder/story` | Beats, prose, requirements, choices, and story destinations |
| `/builder/world` | Outdoor geometry plus utility-station rooms, doors, paths, nodes, transitions, and fixtures |
| `/builder/content` | Character development and artifact catalog definitions consumed by story and world authoring |

These workspaces use the same server and SQLite database, but keep independent
drafts. Switching workspaces never merges world form state with story/content
form state or player state.

## Canonical Storage

SQLite is canonical for authored world content. The outdoor map is stored as
one ordered JSON document named `outdoor-main`, and the utility station is
stored as one ordered JSON document named `utility-station` in
`world_documents`. Geometry objects are intentionally not split into relational
tables. Whole-document storage preserves each map's natural structure and
avoids introducing joins and ordering rules before authoring requirements
demand them.

Every successful save:

1. Validates the complete candidate document.
2. Checks the optimistic document version.
3. Applies approved ID-reference changes.
4. Updates affected story beats and records their revisions.
5. Stores the new world document and immutable world revision.
6. Increments global story/world revisions as appropriate.
7. Publishes SSE update events after the transaction commits.

Outdoor world YAML is an explicit interchange and review format. Export a
snapshot to a chosen path, edit or review it, then import it when SQLite should
change.

```bash
npm run world:export -w game -- outdoor-main /tmp/map.yaml
npm run world:import -w game -- /tmp/map.yaml --replace
```

## Editor Model

The World Builder uses a canvas-first layout:

- The object browser groups hexes, routes, features/barriers, passages,
  landmarks, and stand points.
- The map canvas supports pointer-centered zoom, Shift-drag or middle-drag
  panning, fitting the full map, and focusing the current selection.
- The inspector edits the selected object's structured properties.
- Side panels can be hidden when precise geometry work needs more space.

Routes and line features expose draggable control points. Points may use raw
world coordinates or a hex-relative anchor:

```yaml
- { x: -81, y: 60 }
- { hex: road-fork, dx: -0.07, dy: 0.16 }
```

Hex-relative points move with their hex. Raw points remain at their authored
world position. Landmarks use offsets from the hex center. Stand points may be
hex-relative, landmark-relative, or raw world coordinates.

Edits remain local to the browser until **Save world**. Revert restores the last
loaded version. Leaving with unsaved changes offers Save, Discard, or Keep
Editing.

## IDs and References

IDs use kebab-case and are stable references. Hex IDs may be renamed only
through the explicit Rename action. A confirmed rename updates:

- `start` and `journey`
- route and feature point anchors
- passage hex and placement references
- story beat hex triggers
- story choice `go_hex` destinations

Story changes caused by a world rename receive ordinary story revisions. A
save is rejected if deletion or malformed editing would leave unresolved world
or story references.

## Validation and Diagnostics

Blocking validation includes malformed or duplicate IDs, duplicate axial
coordinates, missing references, malformed points and stands, lines with fewer
than two points, and unsupported passage values.

Non-blocking warnings identify suspicious geometry such as a raw stand point
well outside its assigned hex. The World Builder can run the checked-in
movement audit against its current draft and display the same overlay used by
the development diagnostic. Saving with invalid audit cases requires explicit
confirmation because some map redesigns intentionally change those cases.

World/local map transitions, including Utility Station entry and return stand
selection, are defined in [world-local-transitions.md](world-local-transitions.md).

## Runtime Updates

The game and builders load outdoor world content from `GET /api/world/outdoors`.
They listen for `world.updated` events and refetch only newer revisions.

An open game keeps player flags, story history, inventory, discoveries, save
state, and logical current hex when that ID still exists. Map replacement is
deferred until active movement ends, the avatar resolves to the current hex's
authored stand, and references to removed passages are discarded. If refresh
fails, the last successfully loaded map remains playable.

## Utility Station Workspace

Select **Utility Station** within `/builder/world` (or open
`/builder/world?map=utility-station`) to edit the indoor grid map.

The workspace supports:

- floor switching and fit-all/gameplay camera previews;
- room movement and resizing;
- authored room stand creation and placement, with derived door thresholds shown
  for reference;
- man-door placement and roll-up edge/span editing;
- exterior path control points, stand nodes, and smoothing;
- world-transition marker placement;
- object creation, duplication, ordering, reference-aware rename, and deletion;
- read-only fixture inspection;
- full-document validation, traversal audit, revisions, and restore.
- catalog-backed door keys, item placements, and character requirements/effects
  for world interactions.

Room and exterior-node renames cascade into story triggers and `go_room`
destinations in the same transaction. Deletions that leave story or building
references unresolved are rejected.

The building document owns item placements, not item definitions. Door keys
and `pickups[].item` values reference IDs in the versioned `character-main`
catalog. A pickup may supply a placement-specific label; otherwise the runtime
uses the catalog item's label and description. Taking a pickup commits an
ordinary character item effect and records the placement as taken, so repeated
interaction cannot duplicate a unique item.

Utility-station YAML is an explicit snapshot format rather than the live runtime
source. Development loads the building from
`GET /api/world/buildings/utility-station`; production loads
`/content/utility-station.json`.

```bash
npm run building:export -w game -- utility-station /tmp/utility-station.yaml
npm run building:import -w game -- /tmp/utility-station.yaml --replace
```

Open games receive `building.updated` events. Refresh preserves logical player
location, discoveries, door state, character holdings, actions, flags, and facility
state when their IDs still exist. Building replacement is deferred during an
active indoor movement animation.

See [indoor-stands.md](indoor-stands.md) for the room-local movement and
derived-threshold contract.
