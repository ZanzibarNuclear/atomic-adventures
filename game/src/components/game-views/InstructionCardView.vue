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

/** Eyebrow: plant name. Title: procedure. */
const CARD_EYEBROW = "Clearwater Diversion";
const CARD_TITLE = "Hydro Generator Start-up";

watch(
  () => props.payload?.id,
  () => {
    side.value = "front";
  },
);

function flipCard() {
  side.value = side.value === "front" ? "back" : "front";
}

const steps = [
  {
    id: 1,
    title: "Clear debris and open the intake",
    location: "Intake · Clearwater Run",
  },
  {
    id: 2,
    title: "Align the upstream/diversion valve",
    location: "Intake works · diversion valve",
  },
  {
    id: 3,
    title: "Open the turbine valve",
    location: "Return pipe · mid-cascade",
  },
  {
    id: 4,
    title: "Return to the control room",
    location: "Powerhouse · foot of the cascade",
  },
  {
    id: 5,
    title: "Connect station power",
    location: "Control room · Clearwater Station",
  },
  {
    id: 6,
    title: "Check the console",
    location: "Control room · Clearwater Station",
  },
];
</script>

<template>
  <section class="instruction-card-view" aria-label="Hydro startup instruction card">
    <section v-if="!documentEntry" class="card-error">
      <h2>Document unavailable</h2>
      <p>The selected document ID does not exist in character content.</p>
      <button type="button" class="done-button" @click="$emit('return-to-map')">Done</button>
    </section>

    <section v-else-if="!isKnownCard" class="card-error">
      <h2>Unsupported document</h2>
      <p>This document is not registered as a hydro startup instruction card.</p>
      <button type="button" class="done-button" @click="$emit('return-to-map')">Done</button>
    </section>

    <article v-else class="laminated-card" :class="side" aria-live="polite">
      <header class="card-chrome">
        <button type="button" class="flip-button" @click="flipCard">
          Flip to {{ side === "front" ? "map" : "checklist" }}
        </button>
        <button type="button" class="done-button" @click="$emit('return-to-map')">Done</button>
      </header>

      <section v-if="side === 'front'" class="card-face front-face">
        <div class="card-title-block">
          <p class="plant-label">{{ CARD_EYEBROW }}</p>
          <h2>{{ CARD_TITLE }}</h2>
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

      <!--
        Map side only — control-room window view of Clearwater Diversion:
        stream left↔right (downstream ← left, upstream → right), cascade along
        the station face. Not a full outdoor hex map.
      -->
      <section v-else class="card-face back-face map-only">
        <svg
          class="field-sketch"
          viewBox="0 0 720 400"
          role="img"
          aria-labelledby="field-sketch-title">
          <title id="field-sketch-title">
            Field sketch from the control room: Clearwater Run left to right,
            cascade along Clearwater Station, intake upstream, powerhouse at the cascade foot
          </title>

          <rect class="sketch-ground" x="0" y="0" width="720" height="400" />

          <!-- Far bank / forest wash (above stream, opposite the station) -->
          <path
            class="far-bank"
            d="M0 70 C80 50 160 85 240 60 C320 40 400 75 480 55 C560 38 640 70 720 48 L720 0 L0 0 Z" />
          <g class="far-trees" opacity="0.4">
            <path d="M90 78 L102 42 L114 78 Z" />
            <path d="M180 72 L194 30 L208 72 Z" />
            <path d="M300 68 L312 36 L324 68 Z" />
            <path d="M420 74 L434 34 L448 74 Z" />
            <path d="M540 70 L552 38 L564 70 Z" />
            <path d="M640 76 L652 44 L664 76 Z" />
          </g>

          <!--
            Clearwater Run: horizontal.
            Left = downstream, right = upstream (as seen from control room).
          -->
          <path
            class="stream-band"
            d="M20 168
               C100 158 180 175 260 162
               C340 150 400 155 460 168
               C520 180 580 172 700 178" />
          <path
            class="stream"
            d="M20 168
               C100 158 180 175 260 162
               C340 150 400 155 460 168
               C520 180 580 172 700 178" />
          <text class="stream-label" x="360" y="148">Clearwater Run</text>
          <text class="flow-hint" x="80" y="198">← downstream</text>
          <text class="flow-hint" x="620" y="198">upstream →</text>

          <!-- Cascade along the station face (center-right of stream) -->
          <g class="cascade">
            <path d="M400 155 L412 195" />
            <path d="M418 152 L428 198" />
            <path d="M436 154 L444 200" />
            <path d="M454 158 L460 204" />
            <path d="M470 162 L474 206" />
            <path d="M408 178 L418 210" />
            <path d="M428 176 L436 212" />
            <path d="M448 180 L454 214" />
          </g>
          <text class="map-label" x="440" y="236">Cascade</text>

          <!--
            Clearwater Station — complex footprint (not a single rectangle).
            Sits south of the cascade; control room bay faces the water.
          -->
          <g class="station">
            <!-- main hall -->
            <path
              class="station-mass"
              d="M250 248
                 L390 248
                 L400 268
                 L400 330
                 L240 330
                 L240 270
                 Z" />
            <!-- east shop / garage wing -->
            <path
              class="station-wing"
              d="M390 248
                 L470 252
                 L478 270
                 L478 318
                 L400 318
                 L400 268
                 Z" />
            <!-- control-room bay (toward stream / cascade) -->
            <path
              class="control-bay"
              d="M300 220
                 L372 220
                 L380 248
                 L292 248
                 Z" />
            <!-- control-room windows looking at cascade -->
            <rect class="window" x="308" y="228" width="16" height="12" rx="1" />
            <rect class="window" x="330" y="228" width="16" height="12" rx="1" />
            <rect class="window" x="352" y="228" width="16" height="12" rx="1" />
            <!-- roof hint -->
            <path
              class="roof"
              d="M292 248 L336 200 L380 248" />
            <text class="station-label" x="350" y="300">Clearwater Station</text>
            <text class="map-label quiet" x="336" y="214">Control room</text>
          </g>

          <!-- Powerhouse at foot of cascade (downstream of cascade, stream edge) -->
          <g class="powerhouse-group">
            <path
              class="powerhouse"
              d="M410 210
                 L455 208
                 L460 238
                 L408 240
                 Z" />
            <text class="map-label" x="434" y="258">Powerhouse</text>
          </g>

          <!-- Return / penstock pipe: intake (right) → mid-cascade → powerhouse -->
          <path
            class="return-pipe"
            d="M580 170
               C540 175 500 182 470 190
               C450 196 432 204 420 216" />
          <text class="map-label quiet" x="510" y="210">Return pipe</text>

          <!-- Intake works (upstream / right) -->
          <g class="intake-works">
            <rect class="intake-rack" x="560" y="148" width="48" height="22" rx="2" />
            <path class="intake-slot" d="M568 152 L568 166 M580 152 L580 166 M592 152 L592 166" />
            <text class="map-label" x="584" y="138">Intake</text>
          </g>

          <!--
            Markers (control-room view):
            1 intake · 2 diversion (same works, slightly offset)
            3 return pipe mid-cascade
            4 powerhouse foot of cascade
            5 & 6 inside control-room bay
          -->
          <g class="map-point" transform="translate(572 159)">
            <circle r="14" />
            <text y="5">1</text>
          </g>
          <g class="map-point twin" transform="translate(598 159)">
            <circle r="14" />
            <text y="5">2</text>
          </g>

          <g class="map-point" transform="translate(448 198)">
            <circle r="14" />
            <text y="5">3</text>
          </g>

          <g class="map-point" transform="translate(432 224)">
            <circle r="14" />
            <text y="5">4</text>
          </g>

          <g class="map-point" transform="translate(324 236)">
            <circle r="14" />
            <text y="5">5</text>
          </g>
          <g class="map-point twin" transform="translate(350 236)">
            <circle r="14" />
            <text y="5">6</text>
          </g>
        </svg>

        <ul class="map-key">
          <li><span class="key-line stream"></span>Clearwater Run</li>
          <li><span class="key-line pipe"></span>Return pipe / penstock</li>
          <li><span class="key-swatch station"></span>Clearwater Station</li>
          <li><span class="key-swatch powerhouse"></span>Powerhouse</li>
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
    radial-gradient(circle at 16% 14%, rgba(32, 200, 251, 0.12), transparent 25rem),
    linear-gradient(145deg, #111820, #252525 52%, #171b20);
  color: #f4f0df;
}

.card-error,
.laminated-card {
  max-width: 1120px;
  margin: 0 auto;
}

.card-error {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  padding: 1rem;
  border: 1px solid rgba(238, 225, 185, 0.35);
  border-radius: 8px;
  background: rgba(20, 24, 29, 0.84);
}

.laminated-card {
  display: grid;
  gap: 0;
}

.card-chrome {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid rgba(32, 200, 251, 0.22);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: rgba(12, 18, 24, 0.92);
}

button {
  border: 1px solid #7f8e70;
  border-radius: 7px;
  background: #edf3cf;
  color: #1d2417;
  padding: 0.58rem 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.flip-button {
  background: color-mix(in srgb, var(--color-cherenkov) 22%, #1a2830);
  border-color: var(--color-brand-border, rgba(32, 200, 251, 0.45));
  color: #e8f9ff;
}

.done-button {
  background: transparent;
  border-color: rgba(244, 240, 223, 0.45);
  color: #f4f0df;
}

.card-face {
  position: relative;
  overflow: hidden;
  min-height: min(70vh, 620px);
  padding: clamp(1rem, 3vw, 2rem);
  border: 10px solid rgba(255, 255, 255, 0.34);
  border-radius: 0 0 8px 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.48), transparent 28%),
    #f8f1cf;
  box-shadow:
    inset 0 0 0 1px rgba(56, 48, 28, 0.16),
    0 1.2rem 2.8rem rgba(0, 0, 0, 0.32);
  color: #243019;
}

.card-face.map-only {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 0.75rem;
}

.card-title-block {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.plant-label {
  margin: 0;
  color: #1a7a96;
  text-transform: uppercase;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.card-title-block h2 {
  margin: 0;
  font-size: clamp(1.55rem, 3.6vw, 2.4rem);
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
  background: #1a7a96;
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

.field-sketch {
  width: 100%;
  max-height: min(58vh, 480px);
  border: 1px solid rgba(85, 99, 53, 0.35);
  border-radius: 8px;
  background: #efe6bc;
}

.sketch-ground {
  fill: #efe6bc;
}

.far-bank {
  fill: #d8d0a4;
}

.far-trees path {
  fill: #5f7a4a;
  stroke: #3e4f30;
  stroke-width: 1;
}

.stream-band {
  fill: none;
  stroke: rgba(32, 200, 251, 0.2);
  stroke-width: 26;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.stream {
  fill: none;
  stroke: #20c8fb;
  stroke-width: 7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cascade path {
  fill: none;
  stroke: #148fb8;
  stroke-width: 2.5;
  stroke-linecap: round;
}

.return-pipe {
  fill: none;
  stroke: #5a6570;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.station-mass {
  fill: #d4c08a;
  stroke: #3e4931;
  stroke-width: 2.5;
}

.station-wing {
  fill: #c9b882;
  stroke: #3e4931;
  stroke-width: 2.2;
}

.control-bay {
  fill: #c6d3b0;
  stroke: #3e4931;
  stroke-width: 2.2;
}

.roof {
  fill: #8a7a58;
  stroke: #3e4931;
  stroke-width: 1.5;
}

.window {
  fill: #7ec8e0;
  stroke: #2a3a28;
  stroke-width: 1;
}

.powerhouse {
  fill: #b8a66e;
  stroke: #3e4931;
  stroke-width: 2;
}

.intake-rack {
  fill: #9aab90;
  stroke: #3e4931;
  stroke-width: 1.5;
}

.intake-slot {
  fill: none;
  stroke: #3e4931;
  stroke-width: 1.2;
}

.station-label,
.map-label {
  fill: #27311d;
  font-size: 13px;
  font-weight: 800;
  text-anchor: middle;
}

.station-label {
  font-size: 14px;
}

.map-label.quiet {
  font-size: 11px;
  font-weight: 700;
  fill: #4a5640;
}

.stream-label {
  fill: #0a7a9a;
  font-size: 18px;
  font-weight: 800;
  text-anchor: middle;
  letter-spacing: 0.04em;
}

.flow-hint {
  fill: #5a6a50;
  font-size: 12px;
  font-weight: 700;
  text-anchor: middle;
}

.map-point circle {
  fill: #1a7a96;
  stroke: #fff8db;
  stroke-width: 2.5;
}

.map-point text {
  fill: #fff8db;
  font-size: 14px;
  font-weight: 900;
  text-anchor: middle;
}

.map-point.twin circle {
  fill: #156882;
}

.map-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.2rem;
  padding: 0;
  margin: 0;
  list-style: none;
  color: #52622f;
  font-size: 0.9rem;
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
  background: #20c8fb;
}

.key-line.pipe {
  background: #5a6570;
}

.key-swatch {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 3px;
  border: 1px solid #3e4931;
}

.key-swatch.station {
  background: #d4c08a;
}

.key-swatch.powerhouse {
  background: #b8a66e;
}

@media (max-width: 760px) {
  .checklist {
    grid-template-columns: 1fr;
  }

  .card-chrome {
    flex-wrap: wrap;
  }

  .checklist li {
    min-height: 0;
  }
}
</style>
