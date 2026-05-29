<script setup>
import { computed, reactive, ref } from 'vue'
import HexMap from './components/HexMap.vue'
import mapData from '../content/world/map.yaml'
import {
  availableMoves,
  offRoadNeighbors,
  buildRouteModels,
  fenceSegments,
} from './composables/useRoutes.js'

const hexById = Object.fromEntries(mapData.hexes.map((h) => [h.id, h]))
const size = mapData.size ?? 44
const START = mapData.start ?? mapData.journey[0]
const routeModels = buildRouteModels(mapData.routes, hexById, mapData.hexes, size)
const featureModels = buildRouteModels(mapData.features, hexById, mapData.hexes, size)
const fences = fenceSegments(featureModels)

// --- Player state (the slice that would be saved/loaded) ---
const state = reactive({
  currentId: START,
  discovered: new Set([START]),
})

const mode = ref('explored') // 'slice' | 'explored' | 'full'
const expanded = ref(false)
const traveling = ref(false)

const currentHexData = computed(() => hexById[state.currentId])
const discoveredList = computed(() => [...state.discovered])

const moves = computed(() => availableMoves(state.currentId, routeModels))
const offRoad = computed(() =>
  offRoadNeighbors(
    state.currentId,
    mapData.hexes,
    hexById,
    moves.value.map((m) => m.toHexId),
    size,
    fences,
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
  const main = routeModels.find((r) => r.id === 'hero-route') ?? routeModels[0]
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

    <section class="stage" :class="{ expanded }">
      <HexMap
        :map-data="mapData"
        :route-models="routeModels"
        :feature-models="featureModels"
        :current-hex="state.currentId"
        :discovered="discoveredList"
        :mode="mode"
        :expanded="expanded"
        @hex-click="moveTo"
      />
    </section>

    <section class="hud">
      <div class="location">
        <span class="label">Location</span>
        <strong>{{ currentHexData.landmark?.name ?? currentHexData.id }}</strong>
        <em v-if="currentHexData.landmark?.blurb">
          {{ currentHexData.landmark.blurb }}
        </em>
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
      </div>

      <p class="progress">
        Discovered {{ discoveredList.length }} / {{ mapData.hexes.length }} hexes
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
</style>
