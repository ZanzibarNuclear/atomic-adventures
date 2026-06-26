<script setup>
/**
 * Map landmark: utility station beside the river.
 * Footprint from the utility-station first-floor perimeter (L-shape + control wing).
 * Layout +x = north, +y = east; icon shows north face (driveway) + west river side.
 */
const S = 5.0;
const OX = 1;
const OY = -22;

/** Plan (layout x, y) → icon: east = screen-x, north = screen-up. */
function P(lx, ly) {
  return { x: (ly - 2.5) * S + OX, y: -(lx + 1) * S + OY };
}

/** West-face depth (river side recedes down-left). */
const D = { x: -3, y: 2 };

function pt(lx, ly, depth = 0) {
  const p = P(lx, ly);
  return { x: p.x + depth * D.x, y: p.y + depth * D.y };
}

function ring(...coords) {
  return coords
    .map(([x, y, d = 0]) => {
      const p = pt(x, y, d);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

// Perimeter vertices (layout units), clockwise from south-west.
const FOOTPRINT = [
  [-6, 0],
  [-3, 0],
  [-3, 0.2],
  [-1, 0.2],
  [-1, 0],
  [4, 0],
  [4, 5],
  [0, 5],
  [0, 2],
  [-1, 2],
  [-1, 0.7],
  [-3, 0.7],
  [-3, 3],
  [-6, 3],
];
</script>

<template>
  <g class="utility-station" aria-hidden="true">
    <!-- Offset tuned so north facade meets station-driveway end (hex dy ≈ −0.17) -->
    <g transform="translate(0, 21)">
      <!-- Extruded west (river) wall -->
      <polygon
        :points="ring(...FOOTPRINT.map(([x, y]) => [x, y, 1]))"
        class="us-wall-side" />

      <!-- North facade (driveway) -->
      <polygon
        :points="ring([4, 0], [4, 5], [4, 5, 1], [4, 0, 1])"
        class="us-wall" />

      <!-- South-east wall -->
      <polygon
        :points="ring([4, 5], [0, 5], [0, 5, 1], [4, 5, 1])"
        class="us-wall-side us-wall-dim" />

      <!-- L-notch inner wall -->
      <polygon
        :points="ring([0, 2], [0, 5], [0, 5, 1], [0, 2, 1])"
        class="us-wall-side us-wall-dim" />

      <!-- Control wing south wall -->
      <polygon
        :points="ring([-6, 0], [-3, 0], [-3, 0, 1], [-6, 0, 1])"
        class="us-wall-side" />

      <!-- Floor slab on 2-story section (large bay, y ≥ 2) -->
      <line
        :x1="pt(4, 2).x"
        :y1="pt(4, 2).y"
        :x2="pt(4, 5).x"
        :y2="pt(4, 5).y"
        class="us-floor-slab" />
      <line
        :x1="pt(4, 2, 1).x"
        :y1="pt(4, 2, 1).y"
        :x2="pt(4, 5, 1).x"
        :y2="pt(4, 5, 1).y"
        class="us-floor-slab" />

      <!-- River-side windows (library / conference, west face) -->
      <polygon
        :points="ring([-1, 0.35, 1], [-1, 1.85, 1], [-1, 1.85], [-1, 0.35])"
        class="us-window-side" />
      <line
        :x1="pt(-1, 1.1, 1).x"
        :y1="pt(-1, 1.1, 1).y"
        :x2="pt(-1, 1.1).x"
        :y2="pt(-1, 1.1).y"
        class="us-mullion" />
      <polygon
        :points="ring([0.5, 0.4, 1], [0.5, 1.7, 1], [0.5, 1.7], [0.5, 0.4])"
        class="us-window us-window-dim" />

      <!-- Small EV bay roll-up (north face, y = 0–2) -->
      <polygon
        :points="ring([4, 0.12], [4, 1.88], [4, 1.88, 1], [4, 0.12, 1])"
        class="us-roll-door" />
      <line
        v-for="i in 4"
        :key="'s' + i"
        :x1="pt(4, 0.3 + i * 0.35).x"
        :y1="pt(4, 0.3 + i * 0.35).y"
        :x2="pt(4, 0.3 + i * 0.35, 1).x"
        :y2="pt(4, 0.3 + i * 0.35, 1).y"
        class="us-roll-line" />

      <!-- Large two-story bay roll-up (north face, y = 2–5) -->
      <polygon
        :points="ring([4, 2.05], [4, 4.9], [4, 4.9, 1], [4, 2.05, 1])"
        class="us-roll-door us-roll-large" />
      <line
        v-for="i in 6"
        :key="'l' + i"
        :x1="pt(4, 2.2 + i * 0.42).x"
        :y1="pt(4, 2.2 + i * 0.42).y"
        :x2="pt(4, 2.2 + i * 0.42, 1).x"
        :y2="pt(4, 2.2 + i * 0.42, 1).y"
        class="us-roll-line" />

      <!-- L-shaped roof -->
      <polygon
        :points="ring(...FOOTPRINT.map(([x, y]) => [x, y]))"
        class="us-roof" />
      <polyline
        :points="
          ring(
            [4, 0],
            [4, 5],
            [0, 5],
            [0, 2],
            [-1, 2],
            [-1, 0.7],
            [-3, 0.7],
            [-3, 3],
            [-6, 3],
            [-6, 0],
            [-3, 0],
            [-3, 0.2],
            [-1, 0.2],
            [-1, 0],
            [4, 0],
          )
        "
        class="us-coping" />

      <polyline
        :points="
          ring(
            [-6, 0, 1],
            [-3, 0, 1],
            [-3, 0.2, 1],
            [-1, 0.2, 1],
            [-1, 0, 1],
            [4, 0, 1],
            [4, 5, 1],
            [0, 5, 1],
          )
        "
        class="us-weather" />
    </g>
  </g>
</template>

<style scoped>
.utility-station {
  pointer-events: all;
}

.us-wall {
  fill: #949ba3;
  stroke: #555b62;
  stroke-width: 0.9;
}

.us-wall-side {
  fill: #80878f;
  stroke: #555b62;
  stroke-width: 0.75;
}

.us-wall-dim {
  fill: #787f87;
}

.us-floor-slab {
  stroke: #6d747c;
  stroke-width: 1.3;
}

.us-window,
.us-window-side {
  fill: #7a95a8;
  stroke: #4a5660;
  stroke-width: 0.55;
}

.us-window-side {
  fill: #6f8899;
}

.us-window-dim {
  fill: #72899a;
}

.us-mullion {
  stroke: #4a5660;
  stroke-width: 0.42;
  opacity: 0.8;
}

.us-roll-door {
  fill: #6d737b;
  stroke: #434850;
  stroke-width: 0.75;
}

.us-roll-large {
  fill: #656b73;
}

.us-roll-line {
  stroke: #3f444b;
  stroke-width: 0.42;
  opacity: 0.85;
}

.us-roof {
  fill: #50565d;
  stroke: #353940;
  stroke-width: 0.85;
}

.us-coping {
  fill: none;
  stroke: #737981;
  stroke-width: 0.9;
}

.us-weather {
  fill: none;
  stroke: #5c6759;
  stroke-width: 1.1;
  opacity: 0.45;
}
</style>
