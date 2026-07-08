# Indoor Stand Movement

**Status:** Implemented first-increment contract  
**Scope:** Utility-station room movement, authored room stands, derived door thresholds, save/load, and World Builder authoring

## Purpose

Indoor rooms are logical story locations, but some rooms are large enough to
contain several meaningful places. The avatar therefore has a second, more
precise location beneath `currentRoom`:

```text
currentRoom: large-bay
currentStand: stair:garage-stair:bottom
```

Room-level story triggers, discovery, inventory, and actions continue to use
`currentRoom`. A stand refines where the avatar appears and which local
destination the player may choose; it does not create a new story room.

## Authored Stands

Rooms may define semantic stand points in building layout units:

```yaml
rooms:
  - id: kitchen
    level: second
    x: 2
    y: 0
    w: 2
    h: 2
    defaultStand: center
    stands:
      - id: center
        at: { x: 3, y: 1 }
        label: Center of the kitchen
      - id: stove
        at: { x: 3.55, y: 0.45 }
        label: Stove
        interaction: stove
      - id: dining-table
        at: { x: 2.7, y: 1.45 }
        label: Dining table
        pose: sit
        interaction: dining-table
```

Stand IDs are kebab-case and unique within their room. Coordinates must lie
inside the room rectangle. `defaultStand` references an authored stand. If it
is absent, the first authored stand is the default; a room with no authored
stands uses its computed center or stair position.

`pose` and `interaction` are semantic metadata. In this increment,
`pose` does not change avatar art and `interaction` does not automatically
create an action.

Authored stands may define ordered `views` for stand-specific image close-ups.
When present, stand views override room-level views while the player is at that
stand. This lets the same room show a table, doorway, console, window, or other
fixture image without creating a new logical room or changing room-level story
triggers. See [location-media.md](location-media.md).

## Derived Door Thresholds

Every door connected to a room produces an implicit stand just inside that
room. The runtime derives its position from the door and room geometry:

- man doors use their authored `at` point and inset toward the room interior;
- roll-up doors use the center of their rendered wall span and inset inward;
- each side of a shared door gets its own room-local threshold;
- derived IDs use `door:<door-id>`.

Derived thresholds are not stored in content and do not need duplicate
authoring. They are shown differently from authored stands in the World
Builder. A later extension may support authored threshold overrides if a real
layout demonstrates the need.

Artifacts and actions may reference a derived door threshold by using the
room-local stand ID `door:<door-id>`. The `room` field chooses which side of
the door owns that placement. For example, a pickup with `room: large-bay` and
`stand: door:large-bay-man` appears on the large-bay side of the side garage
door, not on the exterior path or any other connected side.

## Vertical Connectors

Stairs, elevators, ladders, and similar fixtures are vertical connectors. They
may have visible geometry, and an elevator car may even feel room-like, but
their primary gameplay contract is connecting explicit standpoints on different
floors.

Vertical connectors must not be treated as ordinary rooms for player-facing
movement. The player stands at a connector endpoint that belongs to a real
room/floor context, and connector use moves the avatar from one endpoint to
another while changing `level`. A connector may have internal rendering or
transient movement state, but room-level story, inventory, local actions, and
same-room stand movement should continue to use the endpoint's containing room
unless the design explicitly requires a true room-like interior.

Stair fixtures produce implicit endpoint stands:

- lower endpoints use `stair:<stair-room-id>:bottom`;
- upper endpoints use `stair:<stair-room-id>:top`;
- endpoint stands are distinct from nearby door thresholds, even when a door is
  adjacent to the landing;
- climbing a stair moves the avatar from the lower endpoint to the upper
  endpoint and changes `level`;
- descending moves the avatar from the upper endpoint to the lower endpoint and
  changes `level`;
- connector travel must never place the avatar at the visual center of the
  stair/elevator fixture.

Door actions near a connector endpoint are controlled by proximity metadata,
not by reusing the door threshold as the connector stand. For example, the top
of the large-bay stairs is a stair endpoint beside the conference-room door,
not the conference-room door threshold itself.

Future elevators should follow the same model: each served floor has an
endpoint stand. Choosing the elevator moves between endpoint stands and changes
`level`; only an intentionally explorable elevator car should introduce a
separate room-like location.

## Movement

Within the current room:

1. Every authored stand other than `currentStand` is a local destination.
2. Every derived door threshold or connector endpoint other than
   `currentStand` is a local destination.
3. The player may click a visible stand marker or choose it in the action list.
4. Local movement changes `currentStand` without changing `currentRoom`.

Moving to a connector endpoint that belongs to the current room also preserves
`currentRoom`. For example, moving to the bottom of the large-bay stairs keeps
the player in `large-bay`; it should not require a later "go into the large
bay" action before the player can choose another large-bay stand.

The gameplay camera is room-centered while the player is indoors. Moving
between stands does not pan the floor plan; the room remains fixed and the
avatar moves within it. The camera recenters only when `currentRoom` changes.
Exterior path movement remains avatar-centered and may follow intermediate
walking waypoints.

Across rooms:

1. Existing room connectivity, door state, locks, stairs, and discovery rules
   remain authoritative.
2. A door traversal arrives at the destination room's derived threshold for
   that door.
3. A vertical connector traversal arrives at the opposite endpoint stand and
   updates `level`.
4. A non-door connection arrives at the destination room's default stand.
5. Entering from an exterior node arrives at the interior threshold of that
   exterior door.
6. Leaving a room clears the room stand while the avatar is outdoors.

The first increment permits direct movement between every stand in one room.
It does not model furniture collision. Door controls are offered only at the
specific door threshold.

## Persistence and Live Updates

`currentStand` is saved beneath the indoor snapshot. On live building refresh,
the current stand is preserved when it still exists; otherwise the room default
becomes the current stand.

## World Builder

The Utility Station workspace lists authored room stands separately from
rooms. Authors can create, select, drag, label, duplicate, rename, reorder, and
delete them. The inspector edits coordinates, pose, and interaction metadata.
Derived door and stair thresholds are visible on the canvas for orientation but
are not stored or directly editable.

Validation rejects malformed IDs, duplicate stand IDs in a room, out-of-room
coordinates, invalid `defaultStand` references, duplicate view IDs within a
stand, and malformed stand view entries.

## Later Expansion

Only add the following when a concrete room requires it:

- optional authored edges or paths between stands;
- furniture and obstacle collision;
- curved movement paths;
- authored overrides for derived door thresholds;
- fixture-linked interaction points generated from fixture geometry;
- pose-specific avatar rendering such as sitting or operating equipment;
- stand-level story triggers;
- reachability conditions or requirements on individual stands.

That expansion should preserve this contract's authored stand IDs and derived
`door:<door-id>` / `stair:<stair-room-id>:<end>` IDs so saves and content
references remain stable.
