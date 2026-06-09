<script setup>
defineProps({
  hydroElements: { type: Object, default: null },
  // fog=true  → building-shell look, no labels (pre-discovery)
  // fog=false → full colored sketch with labels (post-discovery or builder)
  fog: { type: Boolean, default: true },
})

function polyPoints(pts) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}
</script>

<template>
  <g v-if="hydroElements" class="hydro-layer" :class="{ fog }" pointer-events="none">

    <!-- ── Penstock pipe (east bank, between river and footpath) ── -->
    <polyline
      :points="polyPoints(hydroElements.penstock)"
      class="penstock"
    />

    <!-- ── Intake connector (intake box → penstock) ── -->
    <polyline
      :points="polyPoints(hydroElements.intakeConnector)"
      class="penstock"
    />

    <!-- ── Intake screen ── -->
    <polygon
      :points="polyPoints(hydroElements.intakeCorners)"
      class="intake-box"
    />
    <!-- Crosshatch detail — hidden in fog -->
    <line
      v-if="!fog"
      v-for="(seg, i) in hydroElements.intakeHatch"
      :key="'ih-' + i"
      :x1="seg[0].x" :y1="seg[0].y"
      :x2="seg[1].x" :y2="seg[1].y"
      class="intake-hatch"
    />
    <!-- Intake label — hidden in fog -->
    <text
      v-if="!fog"
      :x="hydroElements.intakeCorners[0].x"
      :y="hydroElements.intakeCorners[0].y - 5"
      class="hydro-label"
    >intake</text>

    <!-- ── Divert valve (midstream) ── -->
    <!-- Bypass pipe — hidden in fog -->
    <polyline
      v-if="!fog"
      :points="polyPoints(hydroElements.valve.bypass)"
      class="bypass-pipe"
    />
    <!-- Valve body -->
    <circle
      :cx="hydroElements.valve.cx"
      :cy="hydroElements.valve.cy"
      :r="hydroElements.valve.r"
      class="valve-body"
    />
    <!-- Handwheel spokes — hidden in fog -->
    <line
      v-if="!fog"
      :x1="hydroElements.valve.spoke1[0].x" :y1="hydroElements.valve.spoke1[0].y"
      :x2="hydroElements.valve.spoke1[1].x" :y2="hydroElements.valve.spoke1[1].y"
      class="valve-wheel"
    />
    <line
      v-if="!fog"
      :x1="hydroElements.valve.spoke2[0].x" :y1="hydroElements.valve.spoke2[0].y"
      :x2="hydroElements.valve.spoke2[1].x" :y2="hydroElements.valve.spoke2[1].y"
      class="valve-wheel"
    />

    <!-- ── Powerhouse enclosure ── -->
    <polygon
      :points="polyPoints(hydroElements.powerhouse.corners)"
      class="powerhouse-box"
    />

    <!-- Drain pipe -->
    <polyline
      :points="polyPoints(hydroElements.powerhouse.drain)"
      class="drain-pipe"
    />

    <!-- Entry valve — hidden in fog -->
    <circle
      v-if="!fog"
      :cx="hydroElements.powerhouse.entryValve.cx"
      :cy="hydroElements.powerhouse.entryValve.cy"
      :r="hydroElements.powerhouse.entryValve.r"
      class="valve-body"
    />

    <!-- Pressure gauge + needle — hidden in fog -->
    <circle
      v-if="!fog"
      :cx="hydroElements.powerhouse.gauge.cx"
      :cy="hydroElements.powerhouse.gauge.cy"
      :r="hydroElements.powerhouse.gauge.r"
      class="pressure-gauge"
    />
    <line
      v-if="!fog"
      :x1="hydroElements.powerhouse.gauge.cx"
      :y1="hydroElements.powerhouse.gauge.cy"
      :x2="hydroElements.powerhouse.gauge.cx"
      :y2="hydroElements.powerhouse.gauge.cy - hydroElements.powerhouse.gauge.r * 0.75"
      class="gauge-needle"
    />

    <!-- Turbine circle -->
    <circle
      :cx="hydroElements.powerhouse.turbine.cx"
      :cy="hydroElements.powerhouse.turbine.cy"
      :r="hydroElements.powerhouse.turbine.r"
      class="turbine-circle"
    />
    <!-- Turbine blade marks — hidden in fog -->
    <line
      v-if="!fog"
      :x1="hydroElements.powerhouse.turbine.cx - hydroElements.powerhouse.turbine.r * 0.65"
      :y1="hydroElements.powerhouse.turbine.cy"
      :x2="hydroElements.powerhouse.turbine.cx + hydroElements.powerhouse.turbine.r * 0.65"
      :y2="hydroElements.powerhouse.turbine.cy"
      class="turbine-blade"
    />
    <line
      v-if="!fog"
      :x1="hydroElements.powerhouse.turbine.cx"
      :y1="hydroElements.powerhouse.turbine.cy - hydroElements.powerhouse.turbine.r * 0.65"
      :x2="hydroElements.powerhouse.turbine.cx"
      :y2="hydroElements.powerhouse.turbine.cy + hydroElements.powerhouse.turbine.r * 0.65"
      class="turbine-blade"
    />

    <!-- Generator box -->
    <rect
      :x="hydroElements.powerhouse.generator.x"
      :y="hydroElements.powerhouse.generator.y"
      :width="hydroElements.powerhouse.generator.w"
      :height="hydroElements.powerhouse.generator.h"
      class="generator-box"
    />
    <!-- Generator label — hidden in fog -->
    <text
      v-if="!fog"
      :x="hydroElements.powerhouse.generator.x + hydroElements.powerhouse.generator.w / 2"
      :y="hydroElements.powerhouse.generator.y + hydroElements.powerhouse.generator.h / 2 + 3"
      class="hydro-label-sm"
    >gen</text>

    <!-- Powerhouse label — hidden in fog -->
    <text
      v-if="!fog"
      :x="hydroElements.powerhouse.box.x + hydroElements.powerhouse.box.w / 2"
      :y="hydroElements.powerhouse.box.y - 5"
      class="hydro-label"
    >powerhouse</text>

    <!-- Penstock label — hidden in fog -->
    <text
      v-if="!fog"
      :x="(hydroElements.penstock[0].x + hydroElements.penstock[1].x) / 2"
      :y="hydroElements.penstock[0].y - 5"
      class="hydro-label"
    >penstock</text>

  </g>
</template>

<style scoped>
.hydro-layer {
  pointer-events: none;
}

/* Penstock pipe and connector */
.penstock {
  fill: none;
  stroke: #8abcdc;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.9;
}

/* Bypass / divert pipe */
.bypass-pipe {
  fill: none;
  stroke: #8abcdc;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 3 4;
  opacity: 0.65;
}

/* Drain pipe */
.drain-pipe {
  fill: none;
  stroke: #8abcdc;
  stroke-width: 2.5;
  stroke-linecap: round;
  opacity: 0.8;
}

/* Intake screen box */
.intake-box {
  fill: rgba(58, 100, 140, 0.25);
  stroke: #8abcdc;
  stroke-width: 2;
  stroke-linejoin: round;
}

/* Crosshatch lines inside intake box */
.intake-hatch {
  stroke: #8abcdc;
  stroke-width: 1;
  opacity: 0.7;
}

/* Valve body circles */
.valve-body {
  fill: #5a6e5c;
  stroke: #b4d4c8;
  stroke-width: 2;
}

/* Valve handwheel spokes */
.valve-wheel {
  stroke: #b4d4c8;
  stroke-width: 2;
  stroke-linecap: round;
}

/* Powerhouse enclosure */
.powerhouse-box {
  fill: rgba(40, 60, 50, 0.55);
  stroke: #9abcaa;
  stroke-width: 2;
  stroke-linejoin: round;
}

/* Pressure gauge */
.pressure-gauge {
  fill: rgba(30, 45, 40, 0.8);
  stroke: #e0d4a8;
  stroke-width: 1.5;
}
.gauge-needle {
  stroke: #e0d4a8;
  stroke-width: 1;
  stroke-linecap: round;
}

/* Turbine */
.turbine-circle {
  fill: rgba(30, 55, 70, 0.7);
  stroke: #8abcdc;
  stroke-width: 2;
}
.turbine-blade {
  stroke: #8abcdc;
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0.75;
}

/* Generator */
.generator-box {
  fill: rgba(50, 60, 40, 0.7);
  stroke: #b4c89a;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

/* Labels */
.hydro-label {
  fill: #c8dab8;
  font-size: 8px;
  font-weight: 600;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.7);
  stroke-width: 2.5px;
}
.hydro-label-sm {
  fill: #b4c89a;
  font-size: 7px;
  font-weight: 600;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.7);
  stroke-width: 2px;
}

/* ── Fog mode — matches building-shell look (pre-discovery) ── */
.hydro-layer.fog .penstock,
.hydro-layer.fog .drain-pipe {
  stroke: rgba(255, 255, 255, 0.30);
  stroke-width: 2.5;
  opacity: 1;
}
.hydro-layer.fog .intake-box,
.hydro-layer.fog .powerhouse-box,
.hydro-layer.fog .valve-body,
.hydro-layer.fog .turbine-circle,
.hydro-layer.fog .generator-box {
  fill: #14181f;
  stroke: rgba(255, 255, 255, 0.22);
  stroke-width: 2;
}
</style>
