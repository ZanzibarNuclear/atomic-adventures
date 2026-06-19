# Indoor Stand Movement

**Status:** Implemented first-increment contract  
**Scope:** Utility-station room movement, authored room stands, derived door thresholds, save/load, and World Builder authoring

## Purpose

Indoor rooms are logical story locations, but some rooms are large enough to
contain several meaningful places. The avatar therefore has a second, more
precise location beneath `currentRoom`:

```text
currentRoom: large-bay
currentStand: stairs-bottom
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
stands falls back to its existing computed center or stair position.

`pose` and `interaction` are retained semantic metadata. In this increment,
`pose` does not change avatar art and `interaction` does not automatically
create an action.

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

## Movement

Within the current room:

1. Every authored stand other than `currentStand` is a local destination.
2. Every derived door threshold other than `currentStand` is a local
   destination.
3. The player may click a visible stand marker or choose it in the action list.
4. Local movement changes `currentStand` without changing `currentRoom`.

Across rooms:

1. Existing room connectivity, door state, locks, stairs, and discovery rules
   remain authoritative.
2. A door traversal arrives at the destination room's derived threshold for
   that door.
3. A non-door connection arrives at the destination room's default stand.
4. Entering from an exterior node arrives at the interior threshold of that
   exterior door.
5. Leaving a room clears the room stand while the avatar is outdoors.

The first increment permits direct movement between every stand in one room.
It does not model furniture collision or require the player to walk to a door
threshold before using that door.

## Persistence and Live Updates

`currentStand` is saved beneath the indoor snapshot. Older saves without it
load at the room's default stand. On live building refresh, the current stand
is preserved when it still exists; otherwise it falls back to the room default.

## World Builder

The Utility Station workspace lists authored room stands separately from
rooms. Authors can create, select, drag, label, duplicate, rename, reorder, and
delete them. The inspector edits coordinates, pose, and interaction metadata.
Derived door thresholds are visible on the canvas for orientation but are not
stored or directly editable.

Validation rejects malformed IDs, duplicate stand IDs in a room, out-of-room
coordinates, and invalid `defaultStand` references.

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
`door:<door-id>` IDs so saves and content references remain stable.
