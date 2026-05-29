<script setup>
import { computed, reactive, ref } from 'vue'
import HexMap from './components/HexMap.vue'
import mapData from '../content/world/map.yaml'

const hexById = Object.fromEntries(mapData.hexes.map((h) => [h.id, h]))
const journey = mapData.journey

// --- Player state (this is the slice that would be saved/loaded) ---
const state = reactive({
  stepIndex: 0, // how far along the journey we are
  discovered: new Set([journey[0]]),
})

const mode = ref('explored') // 'slice' | 'explored' | 'full'
const expanded = ref(false)
const traveling = ref(false)

const currentHex = computed(() => journey[state.stepIndex])
const currentHexData = computed(() => hexById[currentHex.value])
const atEnd = computed(() => state.stepIndex >= journey.length - 1)

function travelNext() {
  if (atEnd.value || traveling.value) return
  traveling.value = true
  state.stepIndex += 1
  state.discovered.add(currentHex.value)
  // Match the avatar's CSS travel transition before re-enabling the button.
  setTimeout(() => {
    traveling.value = false
  }, 650)
}

async function travelAll() {
  while (!atEnd.value) {
    travelNext()
    await new Promise((r) => setTimeout(r, 750))
  }
}

function reset() {
  state.stepIndex = 0
  state.discovered = new Set([journey[0]])
}

// Pass discovered as a plain array so the prop stays reactive.
const discoveredList = computed(() => [...state.discovered])
</script>

<template>
  <main>
    <header>
      <h1>Atomic Adventures — Travel Map Prototype</h1>
      <p class="sub">
        Act I journey: home → west → north → west → south → west to the Utility
        Station. Unexplored hexes stay hidden until you arrive.
      </p>
    </header>

    <section class="stage" :class="{ expanded }">
      <HexMap
        :map-data="mapData"
        :current-hex="currentHex"
        :discovered="discoveredList"
        :mode="mode"
        :expanded="expanded"
        @hex-click="(id) => console.log('clicked', id)"
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

      <div class="controls">
        <button :disabled="atEnd || traveling" @click="travelNext">
          {{ atEnd ? 'Arrived' : 'Travel to next stop ▸' }}
        </button>
        <button :disabled="atEnd || traveling" @click="travelAll">
          Auto-travel ⏩
        </button>
        <button @click="reset">Reset</button>
        <button @click="expanded = !expanded">
          {{ expanded ? 'Collapse map' : 'Expand map ⤢' }}
        </button>
      </div>

      <div class="modes">
        <span class="label">View</span>
        <label
          v-for="m in ['slice', 'explored', 'full']"
          :key="m"
          class="mode-pill"
          :class="{ active: mode === m }"
        >
          <input type="radio" :value="m" v-model="mode" />
          {{ m }}
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
