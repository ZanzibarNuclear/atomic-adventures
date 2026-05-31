<script setup>
import { computed, reactive, ref, watch } from 'vue'
import HexMap from './components/HexMap.vue'
import GridMap from './components/GridMap.vue'
import mapData from '../content/world/map.yaml'
import buildingData from '../content/world/utility-station.yaml'
import {
  availableMoves,
  offRoadNeighbors,
  buildRouteModels,
  fenceSegments,
} from './composables/useRoutes.js'
import { buildBuilding, movesFrom, moveKey } from './composables/useGrid.js'
import {
  listEditableLines,
  findEditableLine,
  resolvedWaypoints,
  setWaypointWorld,
  addWaypoint,
  removeWaypoint,
  exportMapYaml,
  listEditablePlacements,
  findEditablePlacement,
  resolvedPlacementHandles,
  setLandmarkWorld,
  setStandWorld,
  ensureDefaultStandAt,
} from './composables/useMapBuilder.js'
import { landmarkAnchor, resolveAvatarPosition, hasLandmarkMarker } from './composables/useAvatarStand.js'

const size = mapData.size ?? 44
const START = mapData.start ?? mapData.journey[0]

// Editable copies — updated by the map builder.
const editableHexes = ref(structuredClone(mapData.hexes ?? []))
const editableFeatures = ref(structuredClone(mapData.features ?? []))
const editableRoutes = ref(structuredClone(mapData.routes ?? []))

function syncFromMapData(data) {
  editableHexes.value = structuredClone(data.hexes ?? [])
  editableFeatures.value = structuredClone(data.features ?? [])
  editableRoutes.value = structuredClone(data.routes ?? [])
}

if (import.meta.hot) {
  import.meta.hot.accept('../content/world/map.yaml', (mod) => {
    if (mod?.default) syncFromMapData(mod.default)
  })
}

const hexById = computed(() =>
  Object.fromEntries(editableHexes.value.map((h) => [h.id, h])),
)

const displayMapData = computed(() => ({
  ...mapData,
  hexes: editableHexes.value,
  features: editableFeatures.value,
}))
const routeModels = computed(() =>
  buildRouteModels(editableRoutes.value, hexById.value, editableHexes.value, size),
)
const mapFeatures = computed(() =>
  editableFeatures.value.filter((f) => f.kind !== 'gate'),
)
const featureModels = computed(() =>
  buildRouteModels(mapFeatures.value, hexById.value, editableHexes.value, size),
)
const fences = computed(() => fenceSegments(featureModels.value))

// --- Player state (the slice that would be saved/loaded) ---
const state = reactive({
  currentId: START,
  discovered: new Set([START]),
})

const mode = ref('explored') // 'slice' | 'explored' | 'full'
const expanded = ref(false)
const builderView = ref(false)
const traveling = ref(false)

// --- Map builder ---
const editableItems = computed(() => [
  ...listEditablePlacements(editableHexes.value),
  ...listEditableLines(editableRoutes.value, editableFeatures.value),
])
const editSelection = ref('') // "hexes:utility-yard" | "routes:hero-route" | …
const selectedHandleId = ref(null)
const addPointMode = ref(false)
const exportStatus = ref('')

const editParsed = computed(() => {
  if (!editSelection.value) return null
  const [source, id] = editSelection.value.split(':')
  if (source === 'hexes') {
    const hex = findEditablePlacement(editableHexes.value, id)
    if (!hex) return null
    return { source, id, hex }
  }
  const line = findEditableLine(
    editableRoutes.value,
    editableFeatures.value,
    source,
    id,
  )
  if (!line) return null
  return { source, id, line }
})

const editMode = computed(() => {
  if (!editParsed.value) return null
  return editParsed.value.source === 'hexes' ? 'placement' : 'line'
})

const editHandles = computed(() => {
  const parsed = editParsed.value
  if (!parsed) return []
  if (parsed.source === 'hexes') {
    return resolvedPlacementHandles(parsed.hex, size).map((h) => ({
      ...h,
      handleKey: h.role,
    }))
  }
  return resolvedWaypoints(parsed.line, hexById.value, size).map((h) => ({
    ...h,
    handleKey: `point-${h.index}`,
  }))
})

const builderEdit = computed(
  () => builderView.value && editParsed.value != null,
)

const standAnchoredToLandmark = computed(
  () => editParsed.value?.hex?.standAt?.from === 'landmark',
)

watch(builderView, (on) => {
  if (on && !editSelection.value && editableItems.value.length) {
    const first = editableItems.value[0]
    editSelection.value = `${first.source}:${first.id}`
  }
  if (!on) {
    addPointMode.value = false
    selectedHandleId.value = null
  }
})

watch(editSelection, (sel) => {
  selectedHandleId.value = null
  addPointMode.value = false
  if (!sel.startsWith('hexes:')) return
  const id = sel.split(':')[1]
  const hex = findEditablePlacement(editableHexes.value, id)
  if (hex) {
    ensureDefaultStandAt(hex)
    state.currentId = id
  }
})

function onSelectHandle(handleKey) {
  selectedHandleId.value = handleKey
}

function onWaypointMove(payload) {
  const parsed = editParsed.value
  if (!parsed) return
  const { x, y, role, index } = payload

  if (parsed.source === 'hexes') {
    if (role === 'landmark') setLandmarkWorld(parsed.hex, x, y, size)
    else if (role === 'stand') setStandWorld(parsed.hex, x, y, size)
    return
  }

  setWaypointWorld(parsed.line, index, x, y, hexById.value, size)
}

function onBuilderMapClick({ x, y }) {
  const parsed = editParsed.value
  if (!parsed || parsed.source === 'hexes') return
  const idx = addWaypoint(parsed.line, x, y)
  selectedHandleId.value = `point-${idx}`
}

function deleteSelectedPoint() {
  const parsed = editParsed.value
  if (!parsed || parsed.source === 'hexes') return
  const match = selectedHandleId.value?.match(/^point-(\d+)$/)
  if (!match) return
  const idx = Number(match[1])
  if (!removeWaypoint(parsed.line, idx)) return
  const next = Math.min(idx, parsed.line.points.length - 1)
  selectedHandleId.value = next >= 0 ? `point-${next}` : null
}

function toggleSmooth() {
  const parsed = editParsed.value
  if (!parsed?.line) return
  parsed.line.smooth = !parsed.line.smooth
}

function toggleStandAnchor() {
  const hex = editParsed.value?.hex
  if (!hasLandmarkMarker(hex)) return
  const pos = resolveAvatarPosition(hex, size)
  if (hex.standAt?.from === 'landmark') {
    hex.standAt = { x: Math.round(pos.x), y: Math.round(pos.y) }
  } else {
    const anchor = landmarkAnchor(hex, size)
    hex.standAt = {
      from: 'landmark',
      dx: Math.round(((pos.x - anchor.x) / size) * 100) / 100,
      dy: Math.round(((pos.y - anchor.y) / size) * 100) / 100,
    }
  }
}

async function copyYaml(which) {
  const yaml = exportMapYaml(
    editableRoutes.value,
    editableFeatures.value,
    editableHexes.value,
  )
  const text = yaml[which] || yaml.both
  try {
    await navigator.clipboard.writeText(text)
    exportStatus.value = `Copied ${which} YAML`
  } catch {
    exportStatus.value = 'Copy failed — try Download'
  }
  setTimeout(() => {
    exportStatus.value = ''
  }, 2500)
}

function downloadYaml() {
  const yaml = exportMapYaml(
    editableRoutes.value,
    editableFeatures.value,
    editableHexes.value,
  )
  const blob = new Blob([yaml.both], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'map-export.yaml'
  a.click()
  URL.revokeObjectURL(url)
  exportStatus.value = 'Downloaded map-export.yaml'
  setTimeout(() => {
    exportStatus.value = ''
  }, 2500)
}

function resetMapBuilder() {
  syncFromMapData(mapData)
  selectedHandleId.value = null
  exportStatus.value = 'Reset to file defaults'
  setTimeout(() => {
    exportStatus.value = ''
  }, 2500)
}

const currentHexData = computed(() => hexById.value[state.currentId])
const discoveredList = computed(() => [...state.discovered])

const moves = computed(() => availableMoves(state.currentId, routeModels.value))
const offRoad = computed(() =>
  offRoadNeighbors(
    state.currentId,
    editableHexes.value,
    hexById.value,
    moves.value.map((m) => m.toHexId),
    size,
    fences.value,
  ),
)

function moveTo(hexId) {
  if (traveling.value || !hexById.value[hexId]) return
  traveling.value = true
  state.currentId = hexId
  state.discovered.add(hexId)
  setTimeout(() => {
    traveling.value = false
  }, 650)
}

// Auto-walk forward along the hero's trail from wherever we are.
async function autoTravel() {
  const main = routeModels.value.find((r) => r.id === 'hero-route') ?? routeModels.value[0]
  if (!main) return
  const sequence = main.spans.map((s) => s.hexId).filter((id) => id != null)
  let idx = sequence.indexOf(state.currentId)
  if (idx === -1) idx = 0
  for (let i = idx + 1; i < sequence.length; i++) {
    moveTo(sequence[i])
    await new Promise((r) => setTimeout(r, 750))
  }
}

function reset() {
  state.currentId = START
  state.discovered = new Set([START])
}

function nameOf(hexId) {
  const h = hexById.value[hexId]
  return h?.landmark?.name ?? hexId
}

// --- Indoor building state (the Utility Station) ---
const building = buildBuilding(buildingData)
const place = ref('outdoors') // 'outdoors' | 'indoors'

const indoor = reactive({
  currentRoom: building.start,
  discovered: new Set([building.start]),
  level: building.roomById[building.start]?.level ?? building.levels[0]?.id,
  viewLevel: building.roomById[building.start]?.level ?? building.levels[0]?.id,
  moving: false,
})

// You can enter the building when standing on a hex flagged as that area.
const atBuildingEntrance = computed(() => currentHexData.value?.area === 'utility')
const atGatePuzzle = computed(() => currentHexData.value?.puzzle === 'gate')
const currentRoomData = computed(() => building.roomById[indoor.currentRoom])
const indoorMoves = computed(() => movesFrom(building, indoor.currentRoom, indoor.level))
const reachableRooms = computed(() =>
  indoorMoves.value.filter((m) => !m.onSpiral).map((m) => m.toRoomId),
)
const levelsTopDown = computed(() => building.levels)

function enterBuilding() {
  if (!atBuildingEntrance.value) return
  place.value = 'indoors'
}
function exitBuilding() {
  place.value = 'outdoors'
}

function applyIndoorMove(move) {
  if (indoor.moving) return
  if (!indoorMoves.value.some((m) => moveKey(m) === moveKey(move))) return

  indoor.moving = true

  if (move.onSpiral) {
    indoor.level = move.toLevel
    indoor.viewLevel = move.toLevel
    setTimeout(() => {
      indoor.moving = false
    }, 500)
    return
  }

  const from = building.roomById[indoor.currentRoom]
  const to = building.roomById[move.toRoomId]
  if (!to) {
    indoor.moving = false
    return
  }

  indoor.currentRoom = move.toRoomId
  indoor.discovered.add(move.toRoomId)

  if (to.feature === 'spiral-stair') {
    indoor.level = move.toLevel ?? from.level ?? from.levels?.[0]
  } else {
    indoor.level = move.toLevel ?? to.level ?? to.levels?.[0]
  }
  indoor.viewLevel = indoor.level

  setTimeout(() => {
    indoor.moving = false
  }, 500)
}

function moveToRoom(roomId) {
  const move = indoorMoves.value.find((m) => !m.onSpiral && m.toRoomId === roomId)
  if (move) applyIndoorMove(move)
}

function resetIndoor() {
  indoor.currentRoom = building.start
  indoor.discovered = new Set([building.start])
  indoor.level = building.roomById[building.start]?.level
  indoor.viewLevel = indoor.level
}
</script>

<template>
  <main>
    <header>
      <h1>Atomic Adventures — Travel Map Prototype</h1>
      <p class="sub">
        Follow the marked routes (or strike off-road). Unexplored hexes stay
        hidden, but a path may hint at what lies beyond.
      </p>
    </header>

    <section v-if="place === 'outdoors'" class="stage" :class="{ expanded }">
      <HexMap
        :map-data="displayMapData"
        :route-models="routeModels"
        :feature-models="featureModels"
        :current-hex="state.currentId"
        :discovered="discoveredList"
        :mode="mode"
        :expanded="expanded"
        :builder-view="builderView"
        :builder-edit="builderEdit"
        :edit-mode="editMode"
        :edit-handles="editHandles"
        :edit-kind="editParsed?.line?.kind ?? 'path'"
        :selected-handle-id="selectedHandleId"
        :add-point-mode="addPointMode"
        @hex-click="moveTo"
        @select-handle="onSelectHandle"
        @waypoint-move="onWaypointMove"
        @builder-map-click="onBuilderMapClick"
      />
    </section>

    <section v-if="place === 'outdoors'" class="hud">
      <div class="location">
        <span class="label">Location</span>
        <strong>{{ currentHexData.landmark?.name ?? currentHexData.id }}</strong>
        <em v-if="currentHexData.landmark?.blurb">
          {{ currentHexData.landmark.blurb }}
        </em>
        <p v-if="atGatePuzzle" class="puzzle-hint">
          Puzzle — find a way through the gate to continue.
        </p>
        <button
          v-if="atBuildingEntrance"
          class="enter-btn"
          @click="enterBuilding"
        >
          Enter the {{ building.name }} 🚪
        </button>
      </div>

      <div class="travel">
        <span class="label">Follow a route</span>
        <div class="options">
          <button
            v-for="m in moves"
            :key="m.routeId + m.toHexId"
            class="route-btn"
            :class="'k-' + m.kind"
            :disabled="traveling"
            @click="moveTo(m.toHexId)"
          >
            Take {{ m.routeName }} {{ m.label }}
            <span class="dest">→ {{ nameOf(m.toHexId) }}</span>
          </button>
          <button
            v-for="o in offRoad"
            :key="'off-' + o.toHexId"
            class="route-btn off"
            :disabled="traveling"
            @click="moveTo(o.toHexId)"
          >
            Go off-road {{ o.label }}
            <span class="dest">→ ?</span>
          </button>
        </div>
      </div>

      <div class="controls">
        <button :disabled="traveling" @click="autoTravel">
          Auto-travel main path ⏩
        </button>
        <button @click="reset">Reset</button>
        <button @click="expanded = !expanded">
          {{ expanded ? 'Collapse map' : 'Expand map ⤢' }}
        </button>
      </div>

      <div class="modes">
        <span class="label">View</span>
        <label
          v-for="vm in ['slice', 'explored', 'full']"
          :key="vm"
          class="mode-pill"
          :class="{ active: mode === vm }"
        >
          <input type="radio" :value="vm" v-model="mode" />
          {{ vm }}
        </label>
        <label class="mode-pill builder-pill" :class="{ active: builderView }">
          <input type="checkbox" v-model="builderView" />
          builder
        </label>
      </div>

      <div v-if="builderView" class="builder-panel">
        <span class="label">Edit</span>
        <select v-model="editSelection" class="builder-select">
          <optgroup label="Buildings &amp; stands">
            <option
              v-for="item in editableItems.filter((l) => l.source === 'hexes')"
              :key="item.id"
              :value="`${item.source}:${item.id}`"
            >
              {{ item.label }}
            </option>
          </optgroup>
          <optgroup label="Routes">
            <option
              v-for="line in editableItems.filter((l) => l.source === 'routes')"
              :key="line.id"
              :value="`${line.source}:${line.id}`"
            >
              {{ line.label }} ({{ line.kind }})
            </option>
          </optgroup>
          <optgroup label="Features">
            <option
              v-for="line in editableItems.filter((l) => l.source === 'features')"
              :key="line.id"
              :value="`${line.source}:${line.id}`"
            >
              {{ line.label }} ({{ line.kind }})
            </option>
          </optgroup>
        </select>

        <div v-if="editMode === 'line'" class="builder-actions">
          <label class="mode-pill sm" :class="{ active: editParsed?.line?.smooth }">
            <input type="checkbox" :checked="editParsed?.line?.smooth" @change="toggleSmooth" />
            smooth curve
          </label>
          <label class="mode-pill sm" :class="{ active: addPointMode }">
            <input type="checkbox" v-model="addPointMode" />
            click to add point
          </label>
          <button
            class="sm"
            :disabled="!selectedHandleId?.startsWith('point-')"
            @click="deleteSelectedPoint"
          >
            Delete point
          </button>
        </div>

        <div v-if="editMode === 'placement'" class="builder-actions">
          <label
            v-if="hasLandmarkMarker(editParsed?.hex)"
            class="mode-pill sm"
            :class="{ active: standAnchoredToLandmark }"
          >
            <input
              type="checkbox"
              :checked="standAnchoredToLandmark"
              @change="toggleStandAnchor"
            />
            stand follows building
          </label>
        </div>

        <p class="builder-hint builder-export-note">
          Paste each section into <code>map.yaml</code>, replacing the matching
          block (<code>hexes:</code>, <code>features:</code>, or
          <code>routes:</code>). Copy hexes replaces the <em>entire</em> hex
          list — save the file and the map reloads automatically.
        </p>

        <p class="builder-hint">
          <template v-if="editMode === 'placement'">
            <span class="handle-key landmark">●</span> purple = building icon —
            <span class="handle-key stand">●</span> green = player stand.
            Drag to reposition; enable “stand follows building” so the player
            stays beside the icon when you move it.
          </template>
          <template v-else-if="editMode === 'line'">
            Drag yellow handles to reshape the line. Dashed guide = control
            points; solid stroke uses smoothing when enabled.
            <template v-if="editHandles.length">
              {{ editHandles.length }} points
              <template v-if="selectedHandleId">
                — selected {{ selectedHandleId }}
              </template>
            </template>
          </template>
        </p>

        <div class="builder-export">
          <span class="label">Export</span>
          <div class="export-btns">
            <button class="sm" @click="copyYaml('hexes')">Copy hexes</button>
            <button class="sm" @click="copyYaml('features')">Copy features</button>
            <button class="sm" @click="copyYaml('routes')">Copy routes</button>
            <button class="sm" @click="copyYaml('both')">Copy all</button>
            <button class="sm" @click="downloadYaml">Download</button>
            <button class="sm muted" @click="resetMapBuilder">Reset</button>
          </div>
          <p v-if="exportStatus" class="export-status">{{ exportStatus }}</p>
        </div>
      </div>

      <p class="progress">
        Discovered {{ discoveredList.length }} / {{ mapData.hexes.length }} hexes
      </p>
    </section>

    <!-- ===================== INDOORS ===================== -->
    <section v-if="place === 'indoors'" class="stage" :class="{ expanded }">
      <GridMap
        :building="building"
        :current-room="indoor.currentRoom"
        :discovered="[...indoor.discovered]"
        :level="indoor.viewLevel"
        :stand-level="indoor.level"
        :reachable-rooms="reachableRooms"
        :expanded="expanded"
        @room-click="moveToRoom"
      />
    </section>

    <section v-if="place === 'indoors'" class="hud">
      <div class="location">
        <span class="label">{{ building.name }}</span>
        <strong>{{ currentRoomData?.name ?? currentRoomData?.id }}</strong>
        <em v-if="currentRoomData?.blurb">{{ currentRoomData.blurb }}</em>
      </div>

      <div class="travel">
        <span class="label">Move</span>
        <div class="options">
          <button
            v-for="m in indoorMoves"
            :key="moveKey(m)"
            class="route-btn"
            :class="'k-' + (m.kind === 'door' ? 'path' : 'road')"
            :disabled="indoor.moving"
            @click="applyIndoorMove(m)"
          >
            Go {{ m.label }}
            <span class="dest">→ {{ m.onSpiral || indoor.discovered.has(m.toRoomId) ? m.toName : '?' }}</span>
          </button>
        </div>
      </div>

      <div class="modes">
        <span class="label">Floor</span>
        <label
          v-for="lv in levelsTopDown"
          :key="lv.id"
          class="mode-pill"
          :class="{ active: indoor.viewLevel === lv.id }"
        >
          <input type="radio" :value="lv.id" v-model="indoor.viewLevel" />
          {{ lv.name }}
        </label>
      </div>

      <div class="controls">
        <button @click="exitBuilding">← Step outside</button>
        <button @click="resetIndoor">Reset</button>
        <button @click="expanded = !expanded">
          {{ expanded ? 'Collapse map' : 'Expand map ⤢' }}
        </button>
      </div>

      <p class="progress">
        Explored {{ indoor.discovered.size }} / {{ building.rooms.length }} rooms
      </p>
    </section>
  </main>
</template>

<style scoped>
main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
header h1 {
  font-size: 1.4rem;
  margin: 0 0 0.25rem;
}
.sub {
  color: #9aa0ac;
  margin: 0 0 1.5rem;
  font-size: 0.92rem;
}
.stage {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.stage.expanded {
  display: block;
}
.hud {
  display: grid;
  gap: 1rem;
  background: #20242d;
  border: 1px solid #2f3540;
  border-radius: 12px;
  padding: 1.25rem;
}
.location {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.location strong {
  font-size: 1.1rem;
}
.location em {
  color: #9aa0ac;
  font-size: 0.88rem;
}
.puzzle-hint {
  margin: 0.35rem 0 0;
  color: #d4a84b;
  font-size: 0.9rem;
}
.enter-btn {
  margin-top: 0.6rem;
  align-self: flex-start;
  background: #3a5a3f;
  border-color: #4e7a55;
}
.enter-btn:hover {
  background: #46694c;
}
.label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
  color: #6f7787;
}
.travel .options {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.35rem;
}
.route-btn {
  text-align: left;
  border-left-width: 4px;
}
.route-btn.k-path {
  border-left-color: #c39a6b;
}
.route-btn.k-road {
  border-left-color: #9aa0a6;
}
.route-btn.k-trail {
  border-left-color: #d7c48f;
}
.route-btn.off {
  border-left-color: #5a6270;
  color: #aeb4c0;
  font-style: italic;
}
.dest {
  color: #7f8794;
  font-size: 0.82rem;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
button {
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s ease;
}
button:hover:not(:disabled) {
  background: #3a4860;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.modes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.mode-pill {
  border: 1px solid #3f4c63;
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  text-transform: capitalize;
}
.mode-pill.active {
  background: #ffd166;
  color: #1a1d23;
  border-color: #ffd166;
}
.mode-pill input {
  display: none;
}
.progress {
  margin: 0;
  color: #6f7787;
  font-size: 0.85rem;
}
.builder-panel {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  background: #1a1f28;
  border: 1px solid #3a4558;
  border-radius: 8px;
}
.builder-select {
  width: 100%;
  max-width: 420px;
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.88rem;
}
.builder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.mode-pill.sm {
  font-size: 0.8rem;
  padding: 0.2rem 0.6rem;
}
button.sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.82rem;
}
button.sm.muted {
  background: #252a33;
  border-color: #3a404a;
  color: #9aa0ac;
}
.builder-hint {
  margin: 0;
  color: #8a919e;
  font-size: 0.82rem;
  line-height: 1.45;
}
.builder-export {
  display: grid;
  gap: 0.4rem;
}
.export-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.export-status {
  margin: 0;
  color: #7dcea0;
  font-size: 0.82rem;
}
.handle-key {
  font-weight: 700;
}
.handle-key.landmark {
  color: #c792ea;
}
.handle-key.stand {
  color: #7dcea0;
}
</style>
