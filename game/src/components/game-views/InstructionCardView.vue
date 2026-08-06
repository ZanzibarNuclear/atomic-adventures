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
const CARD_TITLE = "Hydro Generator Start-up Procedure";

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
  { id: 1, title: "Clear debris" },
  { id: 2, title: "Open the intake" },
  { id: 3, title: "Align the diversion valve" },
  { id: 4, title: "Open the turbine valve" },
  { id: 5, title: "Connect station power" },
  { id: 6, title: "Check the console" },
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
            <strong>{{ step.title }}</strong>
          </li>
        </ol>
      </section>

      <!--
        Map side — field sketch: stream with flow chevrons, penstock on the bank
        (not over water), powerhouse left, station outline with control-room detail.
      -->
      <section v-else class="card-face back-face map-only">
        <svg
          class="field-sketch"
          viewBox="0 0 720 340"
          role="img"
          aria-labelledby="field-sketch-title">
          <title id="field-sketch-title">
            Field sketch: Clearwater Run, penstock on the bank to the powerhouse,
            Clearwater Station with control room on the west end
          </title>

          <defs>
            <linearGradient id="run-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#7ad4ef" />
              <stop offset="45%" stop-color="#20c8fb" />
              <stop offset="100%" stop-color="#0e8fb4" />
            </linearGradient>
            <linearGradient id="pipe-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#c5d0d8" />
              <stop offset="35%" stop-color="#8a98a4" />
              <stop offset="70%" stop-color="#5c6770" />
              <stop offset="100%" stop-color="#3d464e" />
            </linearGradient>
            <linearGradient id="ph-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#c5d6b0" />
              <stop offset="100%" stop-color="#8fa67a" />
            </linearGradient>
            <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-opacity="0.22" />
            </filter>
          </defs>

          <rect class="sketch-ground" x="0" y="0" width="720" height="340" />

          <!-- Far bank -->
          <path
            class="far-bank"
            d="M0 58 C90 32 170 62 260 36 C350 18 440 50 530 32 C610 18 670 46 720 28 L720 0 L0 0 Z" />
          <g class="far-trees" opacity="0.42">
            <path d="M70 54 L84 16 L98 54 Z" />
            <path d="M150 48 L166 8 L182 48 Z" />
            <path d="M250 44 L264 10 L278 44 Z" />
            <path d="M360 52 L376 10 L392 52 Z" />
            <path d="M470 46 L484 12 L498 46 Z" />
            <path d="M580 52 L594 16 L608 52 Z" />
            <path d="M650 56 L662 24 L674 56 Z" />
          </g>

          <!-- Clearwater Run — water only; flow chevrons left -->
          <path
            class="stream-body"
            d="M12 70
               C100 60 200 78 320 66
               C420 56 520 68 708 74
               L708 122
               C520 118 420 106 320 114
               C200 124 100 108 12 116
               Z" />
          <path
            class="stream-highlight"
            d="M24 82
               C110 72 210 90 320 78
               C420 68 520 80 696 86" />
          <g class="flow-chevrons" aria-hidden="true">
            <path d="M100 86 L74 96 L100 106" />
            <path d="M180 82 L154 92 L180 102" />
            <path d="M260 80 L234 90 L260 100" />
            <path d="M340 78 L314 88 L340 98" />
            <path d="M420 80 L394 90 L420 100" />
            <path d="M500 82 L474 92 L500 102" />
            <path d="M580 84 L554 94 L580 104" />
            <path d="M640 86 L614 96 L640 106" />
          </g>
          <text class="stream-label" x="280" y="60">Clearwater Run</text>

          <!--
            Penstock on the brown bank (south of the stream).
            From intake riser → mid valve (3) with bypass into stream →
            powerhouse right wall at the bank edge (4).
          -->
          <g class="penstock" filter="url(#soft-shadow)">
            <!-- Drop from intake in the stream down to the bank, then west -->
            <path
              class="pipe-outer"
              d="M580 118
                 L580 142
                 L480 144
                 L380 146
                 L240 148
                 L160 150
                 L128 148" />
            <path
              class="pipe-inner"
              d="M580 118
                 L580 142
                 L480 144
                 L380 146
                 L240 148
                 L160 150
                 L128 148" />
            <path
              class="pipe-shine"
              d="M577 120
                 L577 140
                 L480 141
                 L380 143
                 L240 145
                 L165 147" />
            <g class="pipe-flange" transform="translate(580 130)">
              <ellipse cx="0" cy="0" rx="7" ry="4.5" />
            </g>
            <g class="pipe-flange" transform="translate(500 143) rotate(2)">
              <ellipse cx="0" cy="0" rx="4.5" ry="8.5" />
            </g>
            <g class="pipe-flange" transform="translate(300 147) rotate(2)">
              <ellipse cx="0" cy="0" rx="4.5" ry="8.5" />
            </g>
            <g class="pipe-flange" transform="translate(200 149) rotate(4)">
              <ellipse cx="0" cy="0" rx="4.5" ry="8.5" />
            </g>
            <!--
              Mid-run turbine valve (marker 3) with bypass spur into the stream
              for shutdown / maintenance.
            -->
            <g class="pipe-valve" transform="translate(380 146)">
              <circle class="valve-body" r="10" />
              <circle class="valve-rim" r="6.5" />
              <path class="valve-cross" d="M-4.5 0 H4.5 M0 -4.5 V4.5" />
              <rect class="valve-stem" x="-2.2" y="8" width="4.4" height="9" rx="1" />
              <rect class="valve-handwheel" x="-6.5" y="15" width="13" height="4.5" rx="1.2" />
            </g>
            <path class="bypass-outer" d="M380 136 L380 112 L380 98" />
            <path class="bypass-inner" d="M380 136 L380 112 L380 98" />
            <path class="bypass-shine" d="M377 132 L377 100" />
            <g class="pipe-flange" transform="translate(380 112)">
              <ellipse cx="0" cy="0" rx="7" ry="4" />
            </g>
            <ellipse class="bypass-outlet" cx="380" cy="94" rx="8" ry="5" />
            <path class="bypass-splash" d="M372 92 C376 86 384 86 388 92" />
            <!-- Couples into the right wall of the powerhouse -->
            <circle class="pipe-coupling" cx="128" cy="148" r="6.5" />
          </g>
          <text class="map-label quiet" x="250" y="172">Penstock</text>

          <!-- Intake sits in the stream (blue water); markers 1–2 stay on the bank -->
          <g class="intake-works" filter="url(#soft-shadow)">
            <rect class="intake-pad" x="548" y="78" width="80" height="42" rx="3" />
            <rect class="intake-rack" x="556" y="86" width="42" height="26" rx="2" />
            <path
              class="intake-slot"
              d="M564 90 V108 M572 90 V108 M580 90 V108 M588 90 V108" />
            <circle class="diversion-valve" cx="616" cy="100" r="8" />
            <path class="diversion-cross" d="M612 100 H620 M616 96 V104" />
            <text class="map-label" x="588" y="72">Intake</text>
          </g>

          <!--
            Powerhouse on the bank edge (land), tight to the stream so outflow
            can rejoin the water. Penstock enters the right wall.
          -->
          <g class="powerhouse-group" filter="url(#soft-shadow)">
            <rect class="powerhouse" x="72" y="120" width="56" height="50" rx="3" />
            <rect class="powerhouse-roof" x="68" y="112" width="64" height="12" rx="2" />
            <circle class="gen-ring" cx="100" cy="146" r="13" />
            <circle class="gen-hub" cx="100" cy="146" r="3.5" />
            <path class="gen-cross" d="M100 137 V155 M91 146 H109" />
            <!-- Tailrace: discharge from the house back into the run (north edge) -->
            <path class="tailrace" d="M90 120 C94 112 106 112 110 120" />
            <path class="tailrace" d="M96 118 C98 108 102 108 104 118" />
            <text class="map-label quiet" x="100" y="188">Powerhouse</text>
          </g>

          <!--
            Clearwater Station: control room (detailed) at west end of a simple
            building outline — no interior room partitions or doors.
          -->
          <g class="station" filter="url(#soft-shadow)">
            <!-- Whole station outline: control room + corridor + east mass -->
            <path
              class="station-outline"
              d="M130 218
                 L280 218
                 L280 248
                 L350 248
                 L350 228
                 L580 228
                 L580 318
                 L350 318
                 L350 292
                 L280 292
                 L280 318
                 L130 318
                 Z" />
            <!-- Control-room fill (startup area) -->
            <rect class="control-bay" x="132" y="220" width="146" height="96" rx="1" />

            <!-- Step 5: electrical panel on the left wall -->
            <rect class="power-panel" x="138" y="248" width="14" height="40" rx="1.5" />
            <path
              class="power-panel-slots"
              d="M141 254 H149 M141 260 H149 M141 266 H149 M141 272 H149 M141 278 H149" />

            <!-- Step 6: console screens in an arc (facing into the room) -->
            <g class="console-arc">
              <rect class="console-screen" x="188" y="252" width="16" height="12" rx="1" transform="rotate(-28 196 258)" />
              <rect class="console-screen" x="208" y="246" width="16" height="12" rx="1" transform="rotate(-12 216 252)" />
              <rect class="console-screen" x="228" y="244" width="16" height="12" rx="1" />
              <rect class="console-screen" x="248" y="246" width="16" height="12" rx="1" transform="rotate(12 256 252)" />
              <path class="console-desk" d="M186 268 Q228 258 270 268 L268 276 Q228 268 188 276 Z" />
            </g>

            <text class="map-label quiet" x="205" y="308">Control room</text>
            <text class="station-label" x="465" y="278">Clearwater Station</text>
          </g>

          <!--
            Checklist markers:
            1–2 bank at intake · 3 penstock bypass valve · 4 powerhouse · 5 panel · 6 console
          -->
          <g class="map-point" transform="translate(568 138)">
            <circle r="12" />
            <text y="4">1</text>
          </g>
          <g class="map-point twin" transform="translate(596 138)">
            <circle r="12" />
            <text y="4">2</text>
          </g>
          <g class="map-point" transform="translate(380 172)">
            <circle r="12" />
            <text y="4">3</text>
          </g>
          <g class="map-point" transform="translate(72 146)">
            <circle r="12" />
            <text y="4">4</text>
          </g>
          <!-- 5 at electrical panel (left wall) -->
          <g class="map-point" transform="translate(156 268)">
            <circle r="12" />
            <text y="4">5</text>
          </g>
          <!-- 6 in front of console arc -->
          <g class="map-point twin" transform="translate(228 278)">
            <circle r="12" />
            <text y="4">6</text>
          </g>
        </svg>
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
  /* Front and back share one laminated height (driven by the map aspect). */
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: 720 / 380;
  display: flex;
  flex-direction: column;
  padding: clamp(0.75rem, 2vw, 1.25rem);
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
  padding-bottom: clamp(0.65rem, 1.5vw, 1rem);
}

.card-title-block {
  display: grid;
  gap: 0.15rem;
  margin-bottom: 0.65rem;
  flex: 0 0 auto;
}

.plant-label {
  margin: 0;
  color: #1a7a96;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.card-title-block h2 {
  margin: 0;
  font-size: clamp(1.25rem, 2.8vw, 1.75rem);
}

.checklist {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
  flex: 1 1 auto;
  min-height: 0;
  align-content: stretch;
}

.checklist li {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  min-height: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid rgba(85, 99, 53, 0.35);
  border-radius: 7px;
  background: rgba(255, 252, 232, 0.72);
}

.step-number {
  display: grid;
  place-items: center;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 50%;
  background: #1a7a96;
  color: #fff8db;
  font-size: 1.05rem;
  font-weight: 900;
}

.checklist strong {
  font-size: 0.92rem;
  line-height: 1.3;
  font-weight: 800;
}

.field-sketch {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: block;
  border: 1px solid rgba(85, 99, 53, 0.35);
  border-radius: 8px;
  background: #efe6bc;
}

.sketch-ground {
  fill: #efe6bc;
}

.far-bank {
  fill: #d4cca0;
}

.far-trees path {
  fill: #5f7a4a;
  stroke: #3e4f30;
  stroke-width: 1;
}

/* ── Stream ── */
.stream-body {
  fill: url(#run-water);
  stroke: #0e7a9c;
  stroke-width: 1.5;
}

.stream-highlight {
  fill: none;
  stroke: rgba(255, 255, 255, 0.45);
  stroke-width: 3;
  stroke-linecap: round;
}

.flow-chevrons path {
  fill: none;
  stroke: rgba(255, 255, 255, 0.72);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ── Penstock (real pipe) ── */
.pipe-outer {
  fill: none;
  stroke: #3d464e;
  stroke-width: 14;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pipe-inner {
  fill: none;
  stroke: url(#pipe-metal);
  stroke-width: 10;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pipe-shine {
  fill: none;
  stroke: rgba(255, 255, 255, 0.45);
  stroke-width: 2.2;
  stroke-linecap: round;
}

.bypass-outer {
  fill: none;
  stroke: #3d464e;
  stroke-width: 9;
  stroke-linecap: round;
}

.bypass-inner {
  fill: none;
  stroke: url(#pipe-metal);
  stroke-width: 6;
  stroke-linecap: round;
}

.bypass-shine {
  fill: none;
  stroke: rgba(255, 255, 255, 0.4);
  stroke-width: 1.5;
  stroke-linecap: round;
}

.bypass-outlet {
  fill: #5c6770;
  stroke: #2e353c;
  stroke-width: 1.2;
}

.bypass-splash {
  fill: none;
  stroke: rgba(255, 255, 255, 0.75);
  stroke-width: 1.6;
  stroke-linecap: round;
}

.pipe-flange ellipse {
  fill: #6a7480;
  stroke: #2e353c;
  stroke-width: 1.2;
}

.pipe-coupling {
  fill: #5c6770;
  stroke: #2e353c;
  stroke-width: 1.5;
}

.valve-body {
  fill: #6b7580;
  stroke: #2a3138;
  stroke-width: 1.8;
}

.valve-rim {
  fill: none;
  stroke: #c5d0d8;
  stroke-width: 1.5;
}

.valve-cross {
  fill: none;
  stroke: #e8eef2;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.valve-stem {
  fill: #4a545c;
  stroke: #2a3138;
  stroke-width: 0.8;
}

.valve-handwheel {
  fill: #7a8792;
  stroke: #2a3138;
  stroke-width: 0.8;
}

/* ── Buildings ── */
.station-outline {
  fill: #d4c08a;
  stroke: #3e4931;
  stroke-width: 2.4;
}

.control-bay {
  fill: #c6d3b0;
  stroke: none;
}

.power-panel {
  fill: #4a5560;
  stroke: #2a3138;
  stroke-width: 1.2;
}

.power-panel-slots {
  fill: none;
  stroke: #9ab0c0;
  stroke-width: 1.3;
  stroke-linecap: round;
}

.console-screen {
  fill: #5ec8e8;
  stroke: #2a3a28;
  stroke-width: 1;
}

.console-desk {
  fill: #6a5a40;
  stroke: #3e4931;
  stroke-width: 1;
  opacity: 0.85;
}

.powerhouse {
  fill: url(#ph-fill);
  stroke: #3e4931;
  stroke-width: 2;
}

.powerhouse-roof {
  fill: #6e7d62;
  stroke: #3e4931;
  stroke-width: 1.5;
}

.tailrace {
  fill: none;
  stroke: #20c8fb;
  stroke-width: 2.2;
  stroke-linecap: round;
  opacity: 0.75;
}

.gen-ring {
  fill: none;
  stroke: #2a3a28;
  stroke-width: 2;
}

.gen-hub {
  fill: #2a3a28;
}

.gen-cross {
  fill: none;
  stroke: #2a3a28;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.intake-pad {
  fill: #a8b498;
  stroke: #3e4931;
  stroke-width: 1.5;
}

.intake-rack {
  fill: #8a9a80;
  stroke: #3e4931;
  stroke-width: 1.3;
}

.intake-slot {
  fill: none;
  stroke: #2a3a28;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.diversion-valve {
  fill: #6b7580;
  stroke: #2a3138;
  stroke-width: 1.4;
}

.diversion-cross {
  fill: none;
  stroke: #e8eef2;
  stroke-width: 1.4;
  stroke-linecap: round;
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
  fill: #0a6a88;
  font-size: 17px;
  font-weight: 800;
  text-anchor: middle;
  letter-spacing: 0.04em;
}

.map-point circle {
  fill: #1a7a96;
  stroke: #fff8db;
  stroke-width: 2.5;
}

.map-point text {
  fill: #fff8db;
  font-size: 13px;
  font-weight: 900;
  text-anchor: middle;
}

.map-point.twin circle {
  fill: #156882;
}

@media (max-width: 760px) {
  .checklist {
    grid-template-columns: 1fr;
  }

  .card-chrome {
    flex-wrap: wrap;
  }
}
</style>
