import { computed } from 'vue'
import { hexCornerPoints } from './useHexGeometry.js'
import { catmullRomSpline } from './useRoutes.js'
import { bbox, layoutPlacedFixtures } from './useGridFixtureLayout.js'
import {
  roomsOnLevel,
  roomRect,
  roomStandPosition,
  isStairLanding,
  levelBeams,
  doorsOnLevel,
  exitsOnLevel,
  exteriorNodesOnLevel,
  exteriorPathsOnLevel,
  fixturesOnLevel,
  sharedEdge,
  levelBuildingPerimeter,
  roomWindowSegments,
  isRoomMapped,
  isDoorMapped,
  isFixtureMapped,
  exitMapAt,
} from './useGrid.js'

// ---- Room geometry helpers (original, pre-rotation coordinates) ----

function rect(room, cell) {
  return roomRect(room, cell)
}

/**
 * Screen-space placements for GridMap layers (rooms, doors, exterior, avatar, etc.).
 */
export function useGridMapPlacements({
  building,
  level,
  currentRoom,
  exteriorNode,
  standLevel,
  doorStates,
  builderView,
  builderEdit,
  editMode,
  selectedItemId,
  mapClickMode,
  reachableExteriorNodes,
  reachableExitDoors,
  visibility,
  cell,
  tp,
  swapAxes,
}) {
  const current = computed(() =>
    currentRoom.value ? building.value.roomById[currentRoom.value] : null,
  )
  const levelRooms = computed(() => roomsOnLevel(building.value, level.value))
  const mappedRooms = computed(() =>
    levelRooms.value.filter((r) => isRoomMapped(r, visibility.value)),
  )
  const beams = computed(() => levelBeams(building.value, level.value, visibility.value))
  const doors = computed(() =>
    doorsOnLevel(
      building.value,
      level.value,
      doorStates.value,
      currentRoom.value || null,
    ),
  )
  const fixtures = computed(() =>
    fixturesOnLevel(building.value, level.value).filter((f) =>
      isFixtureMapped(f, visibility.value),
    ),
  )

  const reachableExitSet = computed(() => new Set(reachableExitDoors.value))
  const reachableExteriorSet = computed(() => new Set(reachableExteriorNodes.value))
  const exitHexRadius = computed(() => cell.value * 0.13)

  function placeRect(cxOrig, cyOrig, w, h) {
    const c = tp(cxOrig, cyOrig)
    const W = swapAxes.value ? h : w
    const H = swapAxes.value ? w : h
    return { x: c.x - W / 2, y: c.y - H / 2, w: W, h: H }
  }

  const placedBuildingShell = computed(() => {
    if (builderView.value) return []
    return levelBuildingPerimeter(building.value, level.value).map((ring) =>
      ring.map((p) => tp(p.x * cell.value, p.y * cell.value)),
    )
  })

  const placedRooms = computed(() =>
    mappedRooms.value.map((room) => {
      const r = rect(room, cell.value)
      const corners = [
        tp(r.x, r.y),
        tp(r.x + r.w, r.y),
        tp(r.x + r.w, r.y + r.h),
        tp(r.x, r.y + r.h),
      ]
      const windows = (room.windows || []).flatMap((edge) =>
        roomWindowSegments(room, edge, building.value, level.value).map((s) => {
          const a = tp(s.x1 * cell.value, s.y1 * cell.value)
          const b = tp(s.x2 * cell.value, s.y2 * cell.value)
          return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
        }),
      )
      const railings = []
      if (room.open) {
        for (const other of levelRooms.value) {
          if (other.id === room.id || other.open) continue
          const e = sharedEdge(room, other, cell.value)
          if (!e) continue
          const a = e.vertical ? tp(e.x, e.y1) : tp(e.x1, e.y)
          const b = e.vertical ? tp(e.x, e.y2) : tp(e.x2, e.y)
          railings.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
        }
      }
      return {
        room,
        rect: bbox(corners),
        center: tp(r.x + r.w / 2, r.y + r.h / 2),
        windows,
        railings,
      }
    }),
  )

  const placedDoors = computed(() =>
    doors.value
      .filter((d) => isDoorMapped(building.value.doorById?.[d.id], visibility.value))
      .map((d) => {
        if (d.kind === 'roll') {
          const corners = [
            tp(d.x, d.y),
            tp(d.x + d.w, d.y),
            tp(d.x + d.w, d.y + d.h),
            tp(d.x, d.y + d.h),
          ]
          const box = bbox(corners)
          return {
            id: d.id,
            kind: 'roll',
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
            open: !!d.state?.open,
            locked: !!d.state?.locked,
            lockBroken: !!d.state?.lockBroken,
          }
        }
        const placed = placeRect(
          d.x,
          d.y,
          d.vertical ? 7 : cell.value * 0.3,
          d.vertical ? cell.value * 0.3 : 7,
        )
        return {
          id: d.id,
          kind: 'man',
          ...placed,
          open: !!d.state?.open,
          locked: !!d.state?.locked,
          lockBroken: !!d.state?.lockBroken,
        }
      }),
  )

  const placedBeams = computed(() =>
    beams.value.map((b) => {
      const a = tp(b.x1, b.y1)
      const c = tp(b.x2, b.y2)
      return {
        x1: a.x,
        y1: a.y,
        x2: c.x,
        y2: c.y,
        columns: b.columns.map((col) => tp(col.x, col.y)),
      }
    }),
  )

  const placedExteriorPaths = computed(() =>
    exteriorPathsOnLevel(building.value, level.value).map((path) => {
      const layout = (path.points ?? []).map((p) => ({
        x: p.x * cell.value,
        y: p.y * cell.value,
      }))
      const drawn =
        path.smooth !== false && layout.length >= 2 ? catmullRomSpline(layout) : layout
      const points = drawn
        .map((p) => tp(p.x, p.y))
        .map((p) => `${p.x},${p.y}`)
        .join(' ')
      const pathEditing =
        builderEdit.value && editMode.value === 'line' && selectedItemId.value
      const isSelected = pathEditing && path.id === selectedItemId.value
      const dimmed = pathEditing && !isSelected
      return { id: path.id, points, isSelected, dimmed }
    }),
  )

  const editPathControlLine = computed(() => {
    if (!builderEdit.value || editMode.value !== 'line' || !selectedItemId.value) {
      return []
    }
    const path = building.value.exterior?.paths?.find((p) => p.id === selectedItemId.value)
    if (!path?.points?.length) return []
    return path.points.map((p) => tp(p.x * cell.value, p.y * cell.value))
  })

  const pathBuilderLegend = computed(
    () => builderEdit.value && editMode.value === 'line',
  )

  const addPointHint = computed(
    () =>
      builderEdit.value && editMode.value === 'line' && mapClickMode.value === 'point',
  )

  const addNodeHint = computed(
    () =>
      builderEdit.value && editMode.value === 'line' && mapClickMode.value === 'node',
  )

  const placedExteriorNodes = computed(() => {
    const editingPathId =
      builderEdit.value && editMode.value === 'line' ? selectedItemId.value : null
    const editingNodeIds = new Set(
      editingPathId
        ? (building.value.exterior?.paths ?? []).find((p) => p.id === editingPathId)
            ?.nodes ?? []
        : [],
    )

    return exteriorNodesOnLevel(building.value, level.value)
      .filter((node) => !editingNodeIds.has(node.id))
      .map((node) => {
        const c = tp(node.at.x * cell.value, node.at.y * cell.value)
        const r = cell.value * 0.11
        return {
          id: node.id,
          label: node.label,
          cx: c.x,
          cy: c.y,
          r,
          current: exteriorNode.value === node.id,
          reachable: reachableExteriorSet.value.has(node.id),
          hasDoor: !!node.door,
        }
      })
  })

  const placedExits = computed(() =>
    exitsOnLevel(building.value, level.value)
      .filter((exit) => {
        const door = building.value.doorById?.[exit.door]
        if (!door) return false
        if (builderView.value || exteriorNode.value) return true
        if (!isDoorMapped(door, visibility.value)) return false
        return currentRoom.value === exit.room
      })
      .map((exit) => {
        const mapAt = exitMapAt(exit)
        if (!mapAt) return null
        const c = tp(mapAt.x * cell.value, mapAt.y * cell.value)
        const r = exitHexRadius.value
        return {
          doorId: exit.door,
          roomId: exit.room,
          cx: c.x,
          cy: c.y,
          points: hexCornerPoints(c.x, c.y, r),
          reachable: reachableExitSet.value.has(exit.door),
        }
      })
      .filter(Boolean),
  )

  const placedFixtures = computed(() =>
    layoutPlacedFixtures(fixtures.value, building.value, cell.value, tp),
  )

  const avatarScale = computed(() => (cell.value / 64) * 0.42)
  const avatarFootOffset = computed(() => 26 * avatarScale.value)
  const stairLandingFixture = computed(() => {
    if (!current.value?.feature) return null
    return placedFixtures.value.find((f) => f.featureRoomId === current.value.id) ?? null
  })
  const avatarPos = computed(() => {
    if (exteriorNode.value) {
      const node = building.value.exterior?.nodeById?.[exteriorNode.value]
      if (!node || building.value.exterior?.level !== level.value) return null
      const stand = tp(node.at.x * cell.value, node.at.y * cell.value)
      return {
        x: stand.x,
        y: stand.y - avatarFootOffset.value,
      }
    }
    if (!current.value) return null
    const landing = standLevel.value ?? level.value
    if (isStairLanding(current.value)) {
      if (landing !== level.value) return null
      const sf = stairLandingFixture.value
      if (!sf) return null
      if (sf.type === 'spiral') {
        return {
          x: sf.standX,
          y: sf.standY - avatarFootOffset.value,
        }
      }
      return {
        x: sf.cx,
        y: sf.cy - avatarFootOffset.value,
      }
    }
    if (current.value.level !== level.value) return null
    const stand = roomStandPosition(building.value, current.value)
    if (!stand) return null
    return tp(stand.x, stand.y)
  })

  // ── Micro-hydro generator overlay ──────────────────────────────────────────
  // Layout constants (units: +x = north, +y = east, 1 unit = cell px).
  // Anchored to the three riverbank nodes defined in utility-station.yaml:
  //   upstream-bank   x=3.54,  y=-1.10
  //   midstream-bank  x=-1.12, y=-1.11
  //   downstream-bank x=-5.77, y=-1.11
  const placedHydroElements = computed(() => {
    if (!building.value?.hydroSystem) return null
    // Only render on levels where the river is visible
    const riverCfg = building.value.river
    if (riverCfg) {
      const onLevels = riverCfg.onLevels ?? [building.value.exterior?.level ?? 'first']
      if (!onLevels.includes(level.value)) return null
    }
    const c = cell.value

    // River geometry (derived from utility-station.yaml river config):
    //   riverY  = content.minY(-1.11) - gap(1.0) - width(1.5) = -3.61
    //   river east edge = riverY + width = -2.11
    //   east bank gap: y from -2.11 (river edge) to -1.11 (riverside path)
    const PY   = -1.62   // penstock y-track — centre of east-bank gap
    const IX   = 4.10    // intake x – just upstream of upstream-bank (3.54)
    const IY   = -2.55   // intake y – inside the river rect (visible zone -2.86 to -2.11)
    const IHW  = 0.155   // intake half-width/height (0.31 unit square ≈ 20 px side)
    const PX1  = 4.10    // penstock upstream end (x)
    const PX2  = -5.92   // penstock downstream end → powerhouse north face
    const VX   = -1.12   // divert valve x (at midstream-bank)
    const VR   = 0.115   // valve body radius (units)
    const WR   = 0.26    // valve handwheel radius (units)
    const PHX1 = -5.92   // powerhouse north face x
    const PHX2 = -7.08   // powerhouse south face x
    const PHY1 = -2.55   // powerhouse west face y  (river side)
    const PHY2 = -1.10   // powerhouse east face y  (at riverside path)
    const TCX  = -6.50   // turbine centre x
    const TR   = 0.26    // turbine radius (units)
    const EVR  = 0.085   // entry-valve circle radius
    const GGR  = 0.080   // pressure-gauge circle radius

    const pt = (x, y) => tp(x * c, y * c)

    // ── Intake screen ──
    const intakeCorners = [
      pt(IX - IHW, IY - IHW),
      pt(IX + IHW, IY - IHW),
      pt(IX + IHW, IY + IHW),
      pt(IX - IHW, IY + IHW),
    ]
    // 2×2 crosshatch grid
    const D = IHW * 0.44
    const intakeHatch = [
      [pt(IX - IHW, IY - D), pt(IX + IHW, IY - D)],
      [pt(IX - IHW, IY + D), pt(IX + IHW, IY + D)],
      [pt(IX - D, IY - IHW), pt(IX - D, IY + IHW)],
      [pt(IX + D, IY - IHW), pt(IX + D, IY + IHW)],
    ]

    // ── Intake-to-penstock connector ──
    const intakeConnector = [pt(IX, IY), pt(IX, PY)]

    // ── Penstock pipe ──
    const penstock = [pt(PX1, PY), pt(PX2, PY)]

    // ── Divert valve (midstream) ──
    const vc = pt(VX, PY)
    const valve = {
      cx: vc.x,
      cy: vc.y,
      r: VR * c,
      // handwheel – two spokes (N-S and E-W in layout)
      spoke1: [pt(VX - WR, PY), pt(VX + WR, PY)],
      spoke2: [pt(VX, PY - WR), pt(VX, PY + WR)],
      // bypass pipe (dashed) – diverts west to the cascade when valve is open
      bypass: [pt(VX, PY), pt(VX, IY - 0.10)],
    }

    // ── Powerhouse enclosure ──
    const phCorners = [
      pt(PHX1, PHY1), pt(PHX2, PHY1),
      pt(PHX2, PHY2), pt(PHX1, PHY2),
    ]
    const phBox = bbox(phCorners)

    // Entry valve (circle, where penstock pierces powerhouse north wall)
    const evc = pt(PHX1, PY)

    // Pressure gauge (small circle, east/inside of entry valve along penstock)
    const gc = pt(PHX1, PY + 0.20)

    // Turbine (circle centred on the penstock axis)
    const tc = pt(TCX, PY)

    // Generator (compact rect, east side of turbine inside enclosure)
    const genCorners = [
      pt(TCX - TR * 0.85, PY + TR * 0.55),
      pt(TCX + TR * 0.85, PY + TR * 0.55),
      pt(TCX + TR * 0.85, PHY2),
      pt(TCX - TR * 0.85, PHY2),
    ]
    const genBox = bbox(genCorners)

    // Drain pipe from turbine pit through west powerhouse wall to cascade
    const drain = [pt(TCX, PHY1), pt(TCX, IY - 0.15)]

    return {
      intakeCorners,
      intakeHatch,
      intakeConnector,
      penstock,
      valve,
      powerhouse: {
        box: phBox,
        corners: phCorners,
        entryValve: { cx: evc.x, cy: evc.y, r: EVR * c },
        gauge: { cx: gc.x, cy: gc.y, r: GGR * c },
        turbine: { cx: tc.x, cy: tc.y, r: TR * c },
        generator: genBox,
        drain,
      },
    }
  })

  return {
    current,
    levelRooms,
    mappedRooms,
    placedBuildingShell,
    placedRooms,
    placedDoors,
    placedBeams,
    placedExteriorPaths,
    placedExteriorNodes,
    placedExits,
    placedFixtures,
    editPathControlLine,
    pathBuilderLegend,
    addPointHint,
    addNodeHint,
    avatarPos,
    avatarScale,
    placedHydroElements,
  }
}
