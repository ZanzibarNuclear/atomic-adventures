<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  documents: { type: Array, default: () => [] },
  payload: { type: Object, default: () => ({}) },
});

defineEmits(["return-to-map"]);

const side = ref("front");
const documentEntry = computed(() =>
  props.documents.find((entry) => entry.id === props.payload?.id) ?? null,
);
const isKnownCard = computed(() =>
  props.payload?.documentType === "hydro-startup-card" ||
  documentEntry.value?.properties?.type === "hydro-startup-card",
);

watch(
  () => props.payload?.id,
  () => {
    side.value = "front";
  },
);

const steps = [
  {
    id: 1,
    title: "Clear debris and open the intake",
    location: "Upstream intake",
  },
  {
    id: 2,
    title: "Align the upstream/diversion valve",
    location: "Diversion valve",
  },
  {
    id: 3,
    title: "Open the turbine valve",
    location: "Powerhouse pipe valve",
  },
  {
    id: 4,
    title: "Return to the control room",
    location: "Powerhouse",
  },
  {
    id: 5,
    title: "Connect station power",
    location: "Control-room console",
  },
  {
    id: 6,
    title: "Check the console",
    location: "Control-room console",
  },
];
</script>

<template>
  <section class="instruction-card-view" aria-labelledby="instruction-card-title">
    <header class="card-view-header">
      <div>
        <p class="eyebrow">Laminated field card</p>
        <h1 id="instruction-card-title">
          {{ documentEntry?.title ?? "Instruction card unavailable" }}
        </h1>
      </div>
      <button class="exit-button" type="button" @click="$emit('return-to-map')">Return</button>
    </header>

    <section v-if="!documentEntry" class="card-error">
      <h2>Document unavailable</h2>
      <p>The selected document ID does not exist in character content.</p>
    </section>

    <section v-else-if="!isKnownCard" class="card-error">
      <h2>Unsupported document</h2>
      <p>This document is not registered as a hydro startup instruction card.</p>
    </section>

    <article v-else class="laminated-card" :class="side" aria-live="polite">
      <div class="card-toolbar" aria-label="Card side">
        <button
          type="button"
          :aria-pressed="side === 'front'"
          @click="side = 'front'">
          Front
        </button>
        <button
          type="button"
          :aria-pressed="side === 'back'"
          @click="side = 'back'">
          Back
        </button>
      </div>

      <section v-if="side === 'front'" class="card-face front-face">
        <div class="card-title-block">
          <span class="plant-label">Upper Penstock Station</span>
          <h2>Startup checklist</h2>
          <p>Perform these steps in order. Reading the card does not move any valve or switch.</p>
        </div>
        <ol class="checklist">
          <li v-for="step in steps" :key="step.id">
            <span class="step-number">{{ step.id }}</span>
            <span>
              <strong>{{ step.title }}</strong>
              <small>{{ step.location }}</small>
            </span>
          </li>
        </ol>
      </section>

      <section v-else class="card-face back-face">
        <div class="card-title-block">
          <span class="plant-label">Hydro path mini-map</span>
          <h2>Where each step happens</h2>
        </div>

        <svg class="hydro-minimap" viewBox="0 0 760 430" role="img" aria-labelledby="hydro-minimap-title">
          <title id="hydro-minimap-title">Mini-map of the intake, valves, powerhouse, control room, and water path</title>
          <path class="ridge" d="M38 86 C164 38 279 74 398 48 C520 21 622 57 724 36" />
          <path class="river" d="M42 118 C150 158 219 134 310 171 C398 207 491 184 601 228 C654 249 694 279 724 334" />
          <path class="water-path" d="M129 139 C206 159 239 202 292 236 C348 272 415 283 501 289" />
          <path class="penstock" d="M293 236 C345 225 390 232 443 260 C473 276 497 287 533 300" />
          <rect class="powerhouse" x="508" y="266" width="142" height="82" rx="8" />
          <rect class="control-room" x="548" y="218" width="94" height="50" rx="7" />

          <g class="map-point" transform="translate(128 139)">
            <circle r="21" />
            <text y="7">1</text>
          </g>
          <g class="map-point" transform="translate(292 236)">
            <circle r="21" />
            <text y="7">2</text>
          </g>
          <g class="map-point" transform="translate(532 300)">
            <circle r="21" />
            <text y="7">3</text>
          </g>
          <g class="map-point" transform="translate(565 336)">
            <circle r="21" />
            <text y="7">4</text>
          </g>
          <g class="map-point" transform="translate(594 244)">
            <circle r="21" />
            <text y="7">5</text>
          </g>
          <g class="map-point" transform="translate(628 244)">
            <circle r="21" />
            <text y="7">6</text>
          </g>

          <text class="map-label" x="88" y="94">Intake</text>
          <text class="map-label" x="246" y="211">Diversion valve</text>
          <text class="map-label" x="401" y="249">Penstock pressure pipe</text>
          <text class="map-label" x="514" y="363">Powerhouse</text>
          <text class="map-label" x="548" y="209">Control room</text>
          <text class="flow-label" x="188" y="177">water path</text>
        </svg>

        <ul class="map-key">
          <li><span class="key-line water"></span>Water route from intake to turbine</li>
          <li><span class="key-line room"></span>Powerhouse and control-room locations</li>
        </ul>
      </section>
    </article>
  </section>
</template>

<style scoped>
.instruction-card-view {
  min-height: calc(100vh - 4rem);
  padding: 1.25rem clamp(1rem, 3vw, 2.25rem) 2rem;
  background:
    radial-gradient(circle at 16% 14%, rgba(149, 181, 151, 0.2), transparent 25rem),
    linear-gradient(145deg, #111820, #252525 52%, #171b20);
  color: #f4f0df;
}

.card-view-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  max-width: 1120px;
  margin: 0 auto 1rem;
}

.card-view-header h1 {
  margin: 0.1rem 0 0;
  font-size: clamp(1.7rem, 4vw, 3rem);
  letter-spacing: 0;
}

.eyebrow {
  margin: 0;
  color: #c8dd9b;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

button {
  border: 1px solid #7f8e70;
  border-radius: 7px;
  background: #edf3cf;
  color: #1d2417;
  padding: 0.58rem 0.78rem;
  font-weight: 700;
}

.exit-button {
  background: transparent;
  color: #f4f0df;
}

.card-error,
.laminated-card {
  max-width: 1120px;
  margin: 0 auto;
}

.card-error {
  padding: 1rem;
  border: 1px solid rgba(238, 225, 185, 0.35);
  border-radius: 8px;
  background: rgba(20, 24, 29, 0.84);
}

.laminated-card {
  display: grid;
  gap: 0.85rem;
}

.card-toolbar {
  display: flex;
  gap: 0.55rem;
  justify-content: center;
}

.card-toolbar button {
  min-width: 5.5rem;
  background: rgba(237, 243, 207, 0.12);
  color: #f4f0df;
}

.card-toolbar button[aria-pressed="true"] {
  background: #edf3cf;
  color: #1d2417;
}

.card-face {
  position: relative;
  overflow: hidden;
  min-height: min(70vh, 620px);
  padding: clamp(1rem, 3vw, 2rem);
  border: 10px solid rgba(255, 255, 255, 0.34);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.48), transparent 28%),
    #f8f1cf;
  box-shadow:
    inset 0 0 0 1px rgba(56, 48, 28, 0.16),
    0 1.2rem 2.8rem rgba(0, 0, 0, 0.32);
  color: #243019;
}

.card-title-block {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.plant-label {
  color: #52622f;
  text-transform: uppercase;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.card-title-block h2 {
  margin: 0;
  font-size: clamp(1.65rem, 4vw, 2.8rem);
}

.card-title-block p {
  max-width: 50rem;
  margin: 0;
  color: #52622f;
}

.checklist {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.checklist li {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  min-height: 5.25rem;
  padding: 0.75rem;
  border: 1px solid rgba(85, 99, 53, 0.35);
  border-radius: 8px;
  background: rgba(255, 252, 232, 0.72);
}

.step-number {
  display: grid;
  place-items: center;
  width: 2.65rem;
  height: 2.65rem;
  border-radius: 50%;
  background: #2e5f78;
  color: #fff8db;
  font-size: 1.25rem;
  font-weight: 900;
}

.checklist strong,
.checklist small {
  display: block;
}

.checklist small {
  margin-top: 0.3rem;
  color: #61704a;
}

.hydro-minimap {
  width: 100%;
  aspect-ratio: 760 / 430;
  border: 1px solid rgba(85, 99, 53, 0.35);
  border-radius: 8px;
  background: #e9e0b8;
}

.ridge {
  fill: none;
  stroke: #8d895d;
  stroke-width: 12;
  stroke-linecap: round;
}

.river {
  fill: none;
  stroke: rgba(73, 132, 154, 0.35);
  stroke-width: 50;
  stroke-linecap: round;
}

.water-path {
  fill: none;
  stroke: #2e8faf;
  stroke-width: 12;
  stroke-linecap: round;
}

.penstock {
  fill: none;
  stroke: #42505d;
  stroke-width: 9;
  stroke-linecap: round;
}

.powerhouse,
.control-room {
  fill: #d8c28a;
  stroke: #3e4931;
  stroke-width: 4;
}

.control-room {
  fill: #c6d3b0;
}

.map-point circle {
  fill: #2e5f78;
  stroke: #fff8db;
  stroke-width: 4;
}

.map-point text {
  fill: #fff8db;
  font-size: 22px;
  font-weight: 900;
  text-anchor: middle;
}

.map-label,
.flow-label {
  fill: #27311d;
  font-size: 20px;
  font-weight: 800;
}

.flow-label {
  fill: #236d8a;
  font-size: 18px;
}

.map-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.2rem;
  padding: 0;
  margin: 1rem 0 0;
  list-style: none;
  color: #52622f;
}

.map-key li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.key-line {
  width: 2.2rem;
  height: 0.35rem;
  border-radius: 99px;
  background: #2e8faf;
}

.key-line.room {
  background: #d8c28a;
  border: 1px solid #3e4931;
}

@media (max-width: 760px) {
  .card-view-header,
  .checklist {
    grid-template-columns: 1fr;
  }

  .card-view-header {
    display: grid;
  }

  .checklist li {
    min-height: 0;
  }
}
</style>
