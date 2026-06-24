# World/Local Map Transitions

This contract defines how the player moves between the outdoor hex map and a
local grid map such as the Utility Station exterior/interior map.

## Goals

- Enter the local map at a specific authored exterior node, not always at the
  building default.
- Return to the world map at a specific authored outdoor stand, not always at
  the hex default.
- Keep path/road geometry separate from transition semantics. A driveway path
  may pass near the garage, but the transition itself owns the local stand and
  outdoor return stand.
- Select different local entrances based on the previous outdoor hex.

## Terms

| Term | Meaning |
| --- | --- |
| World map | The outdoor hex map. |
| Local map | The grid map for a building/local area. |
| Transition | A bidirectional connection between one world hex and one local-map exit marker. |
| Local stand | The exterior node where the avatar appears on the local map. |
| Arrival stand | A local stand used as the first position after switching maps. It may be off the walkable path graph. |
| Join node | A walkable exterior node that an off-path arrival stand connects to when the player first steps onto the path network. |
| World stand | The stand point where the avatar appears when returning to the world map. |
| MAP marker | The visible hex/map icon on the local map. It is not necessarily the avatar stand. |

## Authored Data

Local map documents use `transitions[]` as the canonical connection list.
Each transition may be door-based or exterior-node based.

```js
{
  id: "garage-exit",
  label: "Leave through the garage",
  hex: "utility-yard",
  exteriorNode: "garage-front-entrance",
  at: { x: 5.48, y: 1.96 },
  standAt: { from: "landmark", dx: 0.05, dy: -0.56 },
  entryFrom: ["west-slope"]
}
```

Fields:

- `id`: stable transition ID.
- `label`: player-facing label for the local MAP action.
- `hex`: world hex reached when exiting through this transition.
- `exteriorNode`: local-map node where the avatar stands after entering from
  the world. If omitted, fall back to `building.exterior.entry`.
- `at`: local-map position of the MAP marker. This is display/action geometry,
  not the avatar stand.
- `standAt`: world-map stand where the avatar appears after exiting to the
  world. If omitted, fall back to the destination hex's authored stand/default
  stand.
- `entryFrom`: optional list of previous world hex IDs that prefer this
  transition when entering the local map.

The existing `building.exterior.entry` remains the fallback local stand for
legacy content and ambiguous entry.

An exterior node may include `joinNode` when it is an arrival stand rather than
part of an authored path:

```js
{
  id: "garage-front-entrance",
  label: "Garage front entrance",
  at: { x: 5.11, y: 2.39 },
  joinNode: "small-bay-roll-front"
}
```

`joinNode` creates a logical movement connection to the path network without
drawing the arrival stand into a visible route polyline. This keeps map-entry
placement separate from driveway, riverbank, and perimeter path geometry.

## Entering Local From World

When the player chooses to enter a building/local map from a world hex:

1. Determine the current world hex. For Utility Station this is normally
   `utility-yard`.
2. Determine the approach context:
   - previous world hex, if available.
3. Select the best transition whose `hex` matches the current world hex:
   - first, an explicit transition selected by a story/action;
   - then a transition whose `entryFrom` includes the previous hex;
   - then the building's default entry transition;
   - finally `building.exterior.entry`.
4. Set `indoor.exteriorNode` to the selected transition's `exteriorNode`.
5. Set `place = "indoors"` without changing the outdoor current hex.
6. Let normal story-beat selection show the beat for that exterior node. Do not
   fire a generic map-switch or enter-building event.

For Utility Station:

| World approach | Preferred local transition | Local stand |
| --- | --- | --- |
| Driveway/building approach | `garage-exit` | `garage-front-entrance` |
| `the-flats` approach | `river-walk` | `upstream-bank` or authored river-walk stand |
| `south-pines` approach | `man-door-path` | `large-bay-man-front` |
| Future southern approach | `southeast-corner` | `south-east-corner` |

## Exiting Local To World

When the player activates a local MAP marker:

1. Resolve the selected transition by `id` or door.
2. Verify the transition is reachable from the current local room/exterior node.
3. Set `outdoor.state.currentId` to `transition.hex`.
4. Set `outdoor.state.stand` to `transition.standAt` resolved in world
   coordinates.
5. Clear indoor room/exterior-node state and set `place = "outdoors"`.

If `transition.standAt` is omitted, use the existing fallback:
`outdoor.defaultStandForHex(transition.hex)`.

## Utility Yard Initial Stands

The Utility Station should author distinct world stands in `utility-yard` for
the likely return points:

| Transition | Suggested world stand |
| --- | --- |
| `garage-exit` | Near the garage/driveway approach. |
| `river-walk` | Near the east riverbank walk. |
| `man-door-path` | Near the path from `south-pines`. |
| `southeast-corner` | Near the future southern/southeastern approach. |

These stands belong to the transition or the `utility-yard` hex. They should
not be inferred from unrelated route waypoints.

## Non-Goals

- Do not normalize local transitions into outdoor routes.
- Do not make local MAP marker position double as the avatar stand unless that
  is explicitly desired.
- Do not require story beats to know local-map geometry. Story may request a
  transition ID, but local/world placement remains authored map content.

## Validation

The building/world validators should eventually check:

- every transition `hex` exists in the outdoor world;
- every transition `exteriorNode` exists in the local exterior graph;
- every transition `standAt`, when present, resolves inside `transition.hex`;
- every `entryFrom` hex exists when it names a world hex;
- every exterior-node `joinNode`, when present, exists and connects the arrival
  stand to the walkable local path network;
- at least one transition exists for each building landmark that can be entered
  from the world.
