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
import { buildBuilding, movesFrom } from './composables/useGrid.js'
import {
  listEditableLines,
  findEditableLine,
  resolvedWaypoints,
  setWaypointWorld,
  addWaypoint,
  removeWaypoint,
  exportMapYaml,
} from './composables/useMapBuilder.js'

const hexById = Object.fromEntries(mapData.hexes.map((h) => [h.id, h]))
const size = mapData.size ?? 44
const START = mapData.start ?? mapData.journey[0]

// Editable copies of routes/features — updated by the map builder.
const editableFeatures = ref(structuredClone(mapData.features ?? []))
const editableRoutes = ref(structuredClone(mapData.routes ?? []))

const displayMapData = computed(() => ({
  ...mapData,
  features: editableFeatures.value,
}))
const routeModels = computed(() =>
  buildRouteModels(editableRoutes.value, hexById, mapData.hexes, size),
)
const mapFeatures = computed(() =>
  editableFeatures.value.filter((f) => f.kind !== 'gate'),
)
const featureModels = computed(() =>
  buildRouteModels(mapFeatures.value, hexById, mapData.hexes, size),
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
const editableLines = computed(() =>
  listEditableLines(editableRoutes.value, editableFeatures.value),
)
const editSelection = ref('') // "routes:hero-route" or "features:mountain-river"
const selectedPointIndex = ref(-1)
const addPointMode = ref(false)
const exportStatus = ref('')

const editParsed = computed(() => {
  if (!editSelection.value) return null
  const [source, id] = editSelection.value.split(':')
  const line = findEditableLine(
    editableRoutes.value,
    editableFeatures.value,
    source,
    id,
  )
  if (!line) return null
  return { source, id, line }
})

const editHandles = computed(() => {
  if (!editParsed.value) return []
  return resolvedWaypoints(editParsed.value.line, hexById, size)
})

const builderEdit = computed(
  () => builderView.value && editParsed.value != null,
)

watch(builderView, (on) => {
  if (on && !editSelection.value && editableLines.value.length) {
    const first = editableLines.value[0]
    editSelection.value = `${first.source}:${first.id}`
  }
  if (!on) {
    addPointMode.value = false
    selectedPointIndex.value = -1
  }
})

watch(editSelection, () => {
  selectedPointIndex.value = -1
  addPointMode.value = false
})

function onSelectPoint(index) {
  selectedPointIndex.value = index
}

function onWaypointMove({ index, x, y }) {
  const parsed = editParsed.value
  if (!parsed) return
  setWaypointWorld(parsed.line, index, x, y, hexById, size)
}

function onBuilderMapClick({ x, y }) {
  const parsed = editParsed.value
  if (!parsed) return
  const idx = addWaypoint(parsed.line, x, y)
  selectedPointIndex.value = idx
}

function deleteSelectedPoint() {
  const parsed = editParsed.value
  if (!parsed || selectedPointIndex.value < 0) return
  if (!removeWaypoint(parsed.line, selectedPointIndex.value)) return
  selectedPointIndex.value = Math.min(
    selectedPointIndex.value,
    parsed.line.points.length - 1,
  )
}

function toggleSmooth() {
  const parsed = editParsed.value
  if (!parsed) return
  parsed.line.smooth = !parsed.line.smooth
}

async function copyYaml(which) {
  const yaml = exportMapYaml(editableRoutes.value, editableFeatures.value)
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
  const yaml = exportMapYaml(editableRoutes.value, editableFeatures.value)
  const blob = new Blob([yaml.both], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'map-lines.yaml'
  a.click()
  URL.revokeObjectURL(url)
  exportStatus.value = 'Downloaded map-lines.yaml'
  setTimeout(() => {
    exportStatus.value = ''
  }, 2500)
}

function resetMapLines() {
  editableFeatures.value = structuredClone(mapData.features ?? [])
  editableRoutes.value = structuredClone(mapData.routes ?? [])
  selectedPointIndex.value = -1
  exportStatus.value = 'Reset to file defaults'
  setTimeout(() => {
    exportStatus.value = ''
  }, 2500)
}

const currentHexData = computed(() => hexById[state.currentId])
const discoveredList = computed(() => [...state.discovered])

const moves = computed(() => availableMoves(state.currentId, routeModels.value))
const offRoad = computed(() =>
  offRoadNeighbors(
    state.currentId,
    mapData.hexes,
    hexById,
    moves.value.map((m) => m.toHexId),
    size,
    fences.value,
  ),
)

function moveTo(hexId) {
  if (traveling.value || !hexById[hexId]) return
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
  const h = hexById[hexId]
  return h?.landmark?.name ?? hexId
}

// --- Indoor building state (the Utility Station) ---
const building = buildBuilding(buildingData)
const place = ref('outdoors') // 'outdoors' | 'indoors'

const indoor = reactive({
  currentRoom: building.start,
  discovered: new Set([building.start]),
  level: building.roomById[building.start]?.level ?? building.levels[0]?.id,
  moving: false,
})

// You can enter the building when standing on a hex flagged as that area.
const atBuildingEntrance = computed(() => currentHexData.value?.area === 'utility')
const atGatePuzzle = computed(() => currentHexData.value?.puzzle === 'gate')
const currentRoomData = computed(() => building.roomById[indoor.currentRoom])
const indoorMoves = computed(() => movesFrom(building, indoor.currentRoom))
const levelsTopDown = computed(() => building.levels)

function enterBuilding() {
  if (!atBuildingEntrance.value) return
  place.value = 'indoors'
}
function exitBuilding() {
  place.value = 'outdoors'
}

function moveToRoom(roomId) {
  if (indoor.moving || !building.roomById[roomId]) return
  // Only move to rooms connected to where we stand.
  if (!indoorMoves.value.some((m) => m.toRoomId === roomId)) return
  indoor.moving = true
  indoor.currentRoom = roomId
  indoor.discovered.add(roomId)
  indoor.level = building.roomById[roomId].level
  setTimeout(() => {
    indoor.moving = false
  }, 500)
}

function resetIndoor() {
  indoor.currentRoom = building.start
  indoor.discovered = new Set([building.start])
  indoor.level = building.roomById[building.start]?.level
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
        :edit-handles="editHandles"
        :edit-kind="editParsed?.line?.kind ?? 'path'"
        :selected-point-index="selectedPointIndex"
        :add-point-mode="addPointMode"
        @hex-click="moveTo"
        @select-point="onSelectPoint"
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
        <span class="label">Edit line</span>
        <select v-model="editSelection" class="builder-select">
          <optgroup label="Routes">
            <option
              v-for="line in editableLines.filter((l) => l.source === 'routes')"
              :key="line.id"
              :value="`${line.source}:${line.id}`"
            >
              {{ line.label }} ({{ line.kind }})
            </option>
          </optgroup>
          <optgroup label="Features">
            <option
              v-for="line in editableLines.filter((l) => l.source === 'features')"
              :key="line.id"
              :value="`${line.source}:${line.id}`"
            >
              {{ line.label }} ({{ line.kind }})
            </option>
          </optgroup>
        </select>

        <div class="builder-actions">
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
            :disabled="selectedPointIndex < 0"
            @click="deleteSelectedPoint"
          >
            Delete point
          </button>
        </div>

        <p class="builder-hint">
          Drag the yellow handles to reshape the line. The dashed guide shows
          control points; the rendered stroke uses smoothing when enabled.
          <template v-if="editHandles.length">
            {{ editHandles.length }} points
            <template v-if="selectedPointIndex >= 0">
              — selected #{{ selectedPointIndex + 1 }}
            </template>
          </template>
        </p>

        <div class="builder-export">
          <span class="label">Export</span>
          <div class="export-btns">
            <button class="sm" @click="copyYaml('features')">Copy features</button>
            <button class="sm" @click="copyYaml('routes')">Copy routes</button>
            <button class="sm" @click="copyYaml('both')">Copy all</button>
            <button class="sm" @click="downloadYaml">Download</button>
            <button class="sm muted" @click="resetMapLines">Reset</button>
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
        :level="indoor.level"
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
            :key="m.toRoomId"
            class="route-btn"
            :class="'k-' + (m.kind === 'door' ? 'path' : 'road')"
            :disabled="indoor.moving"
            @click="moveToRoom(m.toRoomId)"
          >
            Go {{ m.label }}
            <span class="dest">→ {{ indoor.discovered.has(m.toRoomId) ? m.toName : '???' }}</span>
          </button>
        </div>
      </div>

      <div class="modes">
        <span class="label">Floor</span>
        <label
          v-for="lv in levelsTopDown"
          :key="lv.id"
          class="mode-pill"
          :class="{ active: indoor.level === lv.id }"
        >
          <input type="radio" :value="lv.id" v-model="indoor.level" />
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
</style>
