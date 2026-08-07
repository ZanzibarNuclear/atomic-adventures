<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useHydroConsoleMonitor } from "../../composables/useHydroConsoleMonitor.js";
import HydroGraphsPanel from "./hydro-console/HydroGraphsPanel.vue";
import HydroGridPanel from "./hydro-console/HydroGridPanel.vue";
import HydroSchematicPanel from "./hydro-console/HydroSchematicPanel.vue";

const PANEL_ID = "hydro-control-room-panel";

/** Console CRT screens — extend this list as more terminals come online. */
const CONSOLE_SCREENS = Object.freeze([
  {
    id: "hydro-plant",
    title: "Hydro power generator",
    subtitle: null,
  },
  {
    id: "station-grid",
    title: "Station grid",
    subtitle: "Bus · loads · utilization",
  },
]);

const props = defineProps({
  gameState: { type: Object, required: true },
  payload: { type: Object, default: null },
  /** Optional indoor facility + stage for load binding */
  stationContext: { type: Object, default: null },
});

defineEmits(["return-to-map"]);

const panelId = computed(() => props.payload?.panelId ?? PANEL_ID);
const validPanel = computed(() => panelId.value === PANEL_ID);

const stationContextRef = computed(() => props.stationContext);

const {
  equipment,
  guidedActions,
  markerLines,
  powerGraph,
  pressureGraph,
  speedGraph,
  gameTimeLabel,
  statusLabel,
  telemetry,
} = useHydroConsoleMonitor(props.gameState, validPanel, stationContextRef);

const screenIndex = ref(0);

const activeScreen = computed(
  () => CONSOLE_SCREENS[screenIndex.value] ?? CONSOLE_SCREENS[0],
);
const screenCount = CONSOLE_SCREENS.length;
const canGoPrev = computed(() => screenCount > 1);
const canGoNext = computed(() => screenCount > 1);

function goPrev() {
  if (!canGoPrev.value) return;
  screenIndex.value = (screenIndex.value - 1 + screenCount) % screenCount;
}

function goNext() {
  if (!canGoNext.value) return;
  screenIndex.value = (screenIndex.value + 1) % screenCount;
}

function selectScreen(index) {
  if (index < 0 || index >= screenCount) return;
  screenIndex.value = index;
}

function onKeydown(event) {
  if (!validPanel.value) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    goPrev();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    goNext();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});

// Optional focus from stage payload: focus "grid" | "generation" | screen id
watch(
  () => props.payload?.focus ?? props.payload?.screen,
  (focus) => {
    if (!focus) return;
    const byId = CONSOLE_SCREENS.findIndex((s) => s.id === focus);
    if (byId >= 0) {
      screenIndex.value = byId;
      return;
    }
    if (focus === "grid" || focus === "station" || focus === "loads") {
      screenIndex.value = CONSOLE_SCREENS.findIndex((s) => s.id === "station-grid");
    } else if (focus === "generation" || focus === "hydro" || focus === "plant") {
      screenIndex.value = CONSOLE_SCREENS.findIndex((s) => s.id === "hydro-plant");
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="hydro-console-view">
    <header class="console-header">
      <div>
        <p class="eyebrow">Control Room</p>
        <h1>Operational console</h1>
      </div>
      <button class="exit-button" type="button" @click="$emit('return-to-map')">Return to map</button>
    </header>

    <section v-if="!validPanel" class="console-error">
      <h2>Console unavailable</h2>
      <p>Unknown panel ID: {{ panelId }}</p>
    </section>

    <template v-else>
      <div class="screen-shell" aria-label="Console screens">
        <button
          type="button"
          class="screen-nav screen-nav-prev"
          :disabled="!canGoPrev"
          aria-label="Previous screen"
          @click="goPrev">
          <span aria-hidden="true">‹</span>
        </button>

        <div class="screen-stage">
          <div class="screen-chrome">
            <div class="screen-title-block">
              <h2 class="screen-title">{{ activeScreen.title }}</h2>
              <p v-if="activeScreen.subtitle" class="screen-subtitle">{{ activeScreen.subtitle }}</p>
            </div>
            <div class="screen-dots" role="tablist" aria-label="Console screens">
              <button
                v-for="(screen, index) in CONSOLE_SCREENS"
                :key="screen.id"
                type="button"
                role="tab"
                class="screen-dot"
                :class="{ active: index === screenIndex }"
                :aria-selected="index === screenIndex"
                :aria-label="screen.title"
                @click="selectScreen(index)" />
            </div>
          </div>

          <div class="screen-body" :data-screen="activeScreen.id">
            <!-- Screen 1: hydro power generator -->
            <section
              v-show="activeScreen.id === 'hydro-plant'"
              class="console-stack"
              role="tabpanel"
              :aria-label="activeScreen.title">
              <div
                class="status-banner"
                :class="{ online: statusLabel === 'Online', fault: statusLabel === 'Fault' }"
                role="status"
                aria-live="polite">
                <strong class="status-banner-value">{{ statusLabel }}</strong>
                <span class="status-banner-time">{{ gameTimeLabel }}</span>
              </div>

              <HydroGraphsPanel
                :marker-lines="markerLines"
                :power-graph="powerGraph"
                :pressure-graph="pressureGraph"
                :speed-graph="speedGraph"
                :telemetry="telemetry" />

              <HydroSchematicPanel
                :equipment="equipment"
                :guided-actions="guidedActions"
                :telemetry="telemetry"
                @return-to-map="$emit('return-to-map')" />
            </section>

            <!-- Screen 2: station bus / loads -->
            <section
              v-show="activeScreen.id === 'station-grid'"
              class="console-grid console-grid-grid"
              role="tabpanel"
              :aria-label="activeScreen.title">
              <HydroGridPanel :telemetry="telemetry" />
            </section>
          </div>
        </div>

        <button
          type="button"
          class="screen-nav screen-nav-next"
          :disabled="!canGoNext"
          aria-label="Next screen"
          @click="goNext">
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </template>
  </section>
</template>

<style>
/* CRT / generator screens: phosphor green family (not base Cherenkov brand). */
.hydro-console-view {
  min-height: calc(100vh - 4rem);
  padding: 1.25rem clamp(0.5rem, 2vw, 1.5rem) 2rem;
  color: #eef7f1;
  background:
    linear-gradient(135deg, rgba(9, 24, 26, 0.96), rgba(21, 28, 34, 0.98) 52%, rgba(18, 20, 24, 0.98)),
    var(--color-console-bg, #121820);
  --console-accent: var(--color-console-phosphor, #8dd6cb);
}

.hydro-console-view .console-header {
  max-width: 1120px;
  margin: 0 auto 0.75rem;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.hydro-console-view .console-header h1 {
  margin: 0.1rem 0 0;
  /* ~40% smaller than prior clamp(1.7rem, 4vw, 2.8rem) */
  font-size: clamp(1rem, 2.4vw, 1.7rem);
  letter-spacing: 0;
}

.hydro-console-view .eyebrow {
  margin: 0;
  color: #8dd6cb;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.hydro-console-view button {
  border: 1px solid #79c7b8;
  border-radius: 7px;
  background: #dff9ef;
  color: #0b2523;
  padding: 0.6rem 0.8rem;
  font-weight: 700;
}

.hydro-console-view .exit-button {
  background: transparent;
  color: #d6f6ee;
}

/* Multi-screen shell: arrows flank the active CRT */
.hydro-console-view .screen-shell {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: stretch;
  max-width: 1240px;
  margin: 0 auto;
}

.hydro-console-view .screen-nav {
  align-self: center;
  width: 2.75rem;
  height: 4.5rem;
  padding: 0;
  border-radius: 8px;
  border: 1px solid rgba(121, 199, 184, 0.55);
  background: rgba(8, 22, 24, 0.92);
  color: #b8efe4;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
}

.hydro-console-view .screen-nav:hover:not(:disabled) {
  background: rgba(20, 48, 50, 0.95);
  color: #e8fff8;
}

.hydro-console-view .screen-nav:disabled {
  opacity: 0.35;
  cursor: default;
}

.hydro-console-view .screen-stage {
  min-width: 0;
  border: 1px solid rgba(141, 214, 203, 0.35);
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(12, 28, 30, 0.95), rgba(6, 14, 16, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 0 1px rgba(0, 0, 0, 0.35);
}

.hydro-console-view .screen-chrome {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem 0.65rem;
  border-bottom: 1px solid rgba(141, 214, 203, 0.18);
}

.hydro-console-view .screen-title {
  margin: 0;
  font-size: 1.25rem;
  color: #eef7f1;
}

.hydro-console-view .screen-subtitle {
  margin: 0.2rem 0 0;
  color: #abc7c0;
  font-size: 0.88rem;
}

.hydro-console-view .screen-dots {
  display: flex;
  gap: 0.4rem;
  padding-top: 0.35rem;
}

.hydro-console-view .screen-dot {
  width: 0.65rem;
  height: 0.65rem;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(141, 214, 203, 0.55);
  background: transparent;
}

.hydro-console-view .screen-dot.active {
  background: #8dd6cb;
  border-color: #8dd6cb;
}

.hydro-console-view .screen-body {
  padding: 0.85rem;
}

.hydro-console-view .console-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

.hydro-console-view .console-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
  gap: 0.85rem;
}

.hydro-console-view .console-grid-grid {
  grid-template-columns: 1fr;
}

.hydro-console-view .status-banner {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 1rem;
  border: 1px solid rgba(255, 224, 154, 0.35);
  border-radius: 8px;
  background:
    linear-gradient(120deg, rgba(48, 40, 18, 0.75), rgba(8, 18, 20, 0.9));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.hydro-console-view .status-banner.online {
  border-color: rgba(133, 215, 138, 0.45);
  background:
    linear-gradient(120deg, rgba(18, 48, 32, 0.8), rgba(8, 18, 20, 0.9));
}

.hydro-console-view .status-banner.fault {
  border-color: rgba(255, 155, 138, 0.5);
  background:
    linear-gradient(120deg, rgba(56, 24, 20, 0.8), rgba(8, 18, 20, 0.9));
}

.hydro-console-view .status-banner-value {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #ffe09a;
}

.hydro-console-view .status-banner.online .status-banner-value {
  color: #c9f5c9;
}

.hydro-console-view .status-banner.fault .status-banner-value {
  color: #ff9b8a;
}

.hydro-console-view .status-banner-time {
  color: #abc7c0;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.hydro-console-view .schematic-panel,
.hydro-console-view .graphs-panel,
.hydro-console-view .grid-panel,
.hydro-console-view .console-error {
  border: 1px solid rgba(141, 214, 203, 0.28);
  border-radius: 8px;
  background: rgba(8, 18, 20, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  padding: 1rem;
}

.hydro-console-view .plant-schematic {
  display: grid;
  grid-template-columns:
    minmax(5.5rem, 1fr)
    minmax(1.5rem, 0.35fr)
    minmax(5.5rem, 1fr)
    minmax(1.5rem, 0.35fr)
    minmax(5.5rem, 1fr)
    minmax(1.5rem, 0.35fr)
    minmax(5.5rem, 1fr)
    minmax(1.5rem, 0.35fr)
    minmax(5.5rem, 1fr);
  align-items: start;
  gap: 0.35rem 0.4rem;
}

.hydro-console-view .equip-column {
  display: grid;
  gap: 0.5rem;
  justify-items: center;
}

.hydro-console-view .node {
  display: inline-grid;
  place-items: center;
  width: 100%;
  min-width: 5.25rem;
  min-height: 3.25rem;
  border: 1px solid rgba(223, 249, 239, 0.32);
  border-radius: 8px;
  background: #16292c;
  font-weight: 700;
  text-align: center;
  padding: 0.35rem 0.4rem;
}

.hydro-console-view .pipe {
  align-self: center;
  height: 0.45rem;
  margin-top: 1.4rem;
  border-radius: 999px;
  background: #344448;
}

.hydro-console-view .pipe.active {
  background: linear-gradient(90deg, #5fb7dd, #85d78a);
}

.hydro-console-view .badge-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
}

.hydro-console-view .check {
  display: block;
  width: 100%;
  text-align: center;
  border: 1px solid rgba(255, 190, 120, 0.38);
  border-radius: 999px;
  padding: 0.32rem 0.5rem;
  color: #ffd9aa;
  background: rgba(96, 52, 24, 0.35);
  font-size: 0.8rem;
  line-height: 1.2;
}

.hydro-console-view .check.ok {
  border-color: rgba(133, 215, 138, 0.5);
  color: #c9f5c9;
  background: rgba(24, 78, 50, 0.35);
}

.hydro-console-view .grid-readouts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0.85rem 0;
}

.hydro-console-view .grid-readouts .readout {
  border: 1px solid rgba(141, 214, 203, 0.18);
  border-radius: 8px;
  min-height: 4.5rem;
}

.hydro-console-view .readout {
  display: grid;
  gap: 0.35rem;
  min-height: 5.5rem;
  padding: 0.9rem;
}

.hydro-console-view .readout span,
.hydro-console-view .quiet,
.hydro-console-view li span {
  color: #abc7c0;
}

.hydro-console-view .readout strong {
  font-size: 1.35rem;
  color: #f4f7ef;
}

.hydro-console-view .readout strong.tight {
  color: #ffe09a;
}

.hydro-console-view .readout strong.deficit {
  color: #ff9b8a;
}

.hydro-console-view .graphs-panel h2,
.hydro-console-view .schematic-panel h2,
.hydro-console-view .grid-panel h2 {
  margin: 0 0 0.7rem;
  font-size: 1rem;
}

.hydro-console-view .guided-actions {
  display: grid;
  gap: 0.65rem;
}

.hydro-console-view .guided-action {
  display: grid;
  gap: 0.35rem;
}

.hydro-console-view .guided-action span {
  color: #abc7c0;
}

.hydro-console-view .guided-action button {
  justify-self: start;
  margin-top: 0.15rem;
  padding: 0.45rem 0.65rem;
}

.hydro-console-view .console-guidance {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.75fr);
  gap: 0.9rem;
  margin-top: 0.9rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(141, 214, 203, 0.18);
}

.hydro-console-view .console-guidance-single {
  grid-template-columns: 1fr;
}

.hydro-console-view .graphs-header,
.hydro-console-view .graph-labels,
.hydro-console-view .legend,
.hydro-console-view .util-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.hydro-console-view .graphs-header span,
.hydro-console-view .graph-labels span,
.hydro-console-view .legend,
.hydro-console-view .util-header span {
  color: #abc7c0;
}

.hydro-console-view .util-header span.over {
  color: #ff9b8a;
}

.hydro-console-view .util-track {
  height: 0.85rem;
  border-radius: 999px;
  background: rgba(30, 48, 50, 0.9);
  border: 1px solid rgba(141, 214, 203, 0.2);
  overflow: hidden;
}

.hydro-console-view .util-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5fb7dd, #85d78a);
  transition: width 0.25s ease;
}

.hydro-console-view .util-fill.over {
  background: linear-gradient(90deg, #e8a45a, #ff7a66);
}

.hydro-console-view .util-fill.idle {
  background: #3a5558;
}

.hydro-console-view .grid-panel.dimmed {
  filter: brightness(0.92);
}

.hydro-console-view .grid-panel.offline {
  opacity: 0.88;
}

.hydro-console-view .load-table {
  margin-top: 1rem;
}

.hydro-console-view .load-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.hydro-console-view .load-table th,
.hydro-console-view .load-table td {
  text-align: left;
  padding: 0.45rem 0.35rem;
  border-bottom: 1px solid rgba(141, 214, 203, 0.14);
}

.hydro-console-view .load-table th {
  color: #8dd6cb;
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hydro-console-view .load-table tr.drawing td {
  color: #e8fff0;
}

.hydro-console-view .load-hint {
  margin: 0.75rem 0 0;
}

.hydro-console-view .graph-stack {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.hydro-console-view .graph-stack-triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.hydro-console-view .graph-card {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  min-height: 10rem;
  padding: 0.8rem;
  border: 1px solid rgba(141, 214, 203, 0.18);
  border-radius: 8px;
  background: rgba(5, 12, 15, 0.5);
}

.hydro-console-view .graph-labels {
  min-height: 2.4rem;
}

.hydro-console-view .graph-labels strong,
.hydro-console-view .graph-labels span {
  overflow-wrap: anywhere;
}

.hydro-console-view .graph-card svg {
  width: 100%;
  height: 5.5rem;
  border: 1px solid rgba(141, 214, 203, 0.14);
  border-radius: 6px;
  background:
    linear-gradient(rgba(141, 214, 203, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(141, 214, 203, 0.08) 1px, transparent 1px),
    rgba(7, 16, 19, 0.82);
  background-size: 100% 33.333%, 25% 100%, 100% 100%;
}

.hydro-console-view .graph-card polyline {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.hydro-console-view .event-marker-line {
  stroke: rgba(255, 255, 255, 0.42);
  stroke-width: 1;
  stroke-dasharray: 2 2;
  vector-effect: non-scaling-stroke;
}

.hydro-console-view .legend {
  justify-content: flex-start;
  flex-wrap: wrap;
  min-height: 1.2rem;
  font-size: 0.82rem;
}

.hydro-console-view .legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.hydro-console-view .legend i {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
}

.hydro-console-view ul,
.hydro-console-view ol {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hydro-console-view li {
  display: grid;
  gap: 0.15rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(141, 214, 203, 0.14);
}

.hydro-console-view li strong {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.hydro-console-view .console-error {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}

@media (max-width: 980px) {
  .hydro-console-view .graph-stack-triple {
    grid-template-columns: 1fr;
  }

  .hydro-console-view .plant-schematic {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .hydro-console-view .pipe {
    width: 0.45rem;
    height: 1.25rem;
    margin: 0 auto;
  }
}

@media (max-width: 760px) {
  .hydro-console-view .screen-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .hydro-console-view .screen-nav {
    width: 100%;
    height: 2.5rem;
    font-size: 1.5rem;
  }

  .hydro-console-view .screen-nav-prev {
    order: 2;
  }

  .hydro-console-view .screen-stage {
    order: 1;
  }

  .hydro-console-view .screen-nav-next {
    order: 3;
  }

  .hydro-console-view .console-header,
  .hydro-console-view .console-grid {
    display: grid;
  }

  .hydro-console-view .console-grid,
  .hydro-console-view .console-guidance,
  .hydro-console-view .grid-readouts,
  .hydro-console-view .graph-stack,
  .hydro-console-view .graph-stack-triple {
    grid-template-columns: 1fr;
  }

  .hydro-console-view .status-banner {
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
  }

  .hydro-console-view .status-banner-time {
    text-align: left;
  }
}
</style>
