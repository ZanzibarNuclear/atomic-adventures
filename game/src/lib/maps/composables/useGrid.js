// Re-export barrel — import from here for backward compatibility.
export {
  buildBuilding,
  roomsOnLevel,
  roomOnLevel,
  roomRect,
  roomCenter,
  protrudeAngle,
  spiralStandPoint,
  spiralExitPoint,
  isStairLanding,
  featureRoomForFixture,
  stairExitRooms,
  spiralExitRooms,
  roomStandPosition,
  authoredRoomStands,
  defaultRoomStandId,
  derivedDoorStands,
  doorThresholdForRoom,
  roomStandModels,
  roomStandById,
  ROOM_ICON_HALF_HEIGHT,
  FEET_GAP_ABOVE_ROOM_ICON,
  linkedRoomIdsForDoor,
  sharedEdge,
  dirBetween,
  rollDoorRect,
  EXIT_MAP_OFFSET,
  exitMapAt,
  exitsOnLevel,
  exteriorPathsOnLevel,
  exteriorNodesOnLevel,
  doorsOnLevel,
  fixturesOnLevel,
  primaryLevel,
  roomLevel,
  levelOrder,
  spiralLandingsFor,
  spiralStairRoomId,
} from './grid/useGridModel.js'

export {
  mapVisibilityCtx,
  isOutsideBuilding,
  fixtureRevealKey,
  doorRevealKey,
  applyRevealDoorsForRoom,
  applyRevealForDoor,
  isRoomMapped,
  isRoomFogged,
  isDoorMapped,
  isFixtureMapped,
  isFixtureFogged,
  isDestinationNamed,
} from './grid/useGridVisibility.js'

export {
  moveKey,
  movesFrom,
} from './grid/useGridNavigation.js'

export {
  levelBuildingPerimeter,
  levelBuildingOutline,
  levelContentExtentsLayout,
  levelMapLayoutBounds,
  levelRiverRect,
  levelCliffWall,
  levelDisplayBounds,
  levelBeams,
  roomWindowSegments,
} from './grid/useGridLayout.js'

export {
  normalizeCompassEdge,
  layoutSideFromEdge,
  northOrientationBase,
  COMPASS_EDGES,
} from './grid/useGridCompass.js'

export {
  canUseExteriorExit,
  exteriorStepDirection,
  exteriorMovesFrom,
  exteriorReachableNodes,
  exteriorPathBetween,
  exteriorSegmentPoints,
  exteriorStepOutMoves,
} from './grid/useGridExterior.js'
