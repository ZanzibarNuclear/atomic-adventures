<script setup>
/** Map landmark: two-story industrial utility station beside the river. */
</script>

<template>
  <g class="utility-station" aria-hidden="true">
    <!-- Soft ground shadow -->
    <ellipse cx="1" cy="2" rx="22" ry="4" class="us-shadow" />

    <!-- Main block -->
    <rect x="-20" y="-25" width="36" height="25" class="us-wall" />

    <!-- Shallow west (river) face -->
    <polygon points="-20,-25 -24,-27 -24,-2 -20,0" class="us-wall-side" />

    <!-- Floor slab between stories -->
    <rect x="-20" y="-13.5" width="36" height="1.2" class="us-floor-slab" />

    <!-- River-side windows — dirty glass, intact -->
    <rect x="-18" y="-23" width="9" height="7" rx="0.45" class="us-window" />
    <rect x="-18" y="-12" width="9" height="7" rx="0.45" class="us-window" />
    <line x1="-13.5" y1="-23" x2="-13.5" y2="-16" class="us-mullion" />
    <line x1="-18" y1="-19.5" x2="-9" y2="-19.5" class="us-mullion" />
    <line x1="-13.5" y1="-12" x2="-13.5" y2="-5" class="us-mullion" />
    <line x1="-18" y1="-8.5" x2="-9" y2="-8.5" class="us-mullion" />

    <!-- Side-face windows (river wing depth) -->
    <rect x="-23" y="-22" width="3.5" height="6" rx="0.35" class="us-window-side" />
    <rect x="-23" y="-11" width="3.5" height="6" rx="0.35" class="us-window-side" />

    <!-- Upper office window over kitchen -->
    <rect x="-7" y="-23" width="7" height="7" rx="0.4" class="us-window us-window-dim" />
    <line x1="-3.5" y1="-23" x2="-3.5" y2="-16" class="us-mullion" />

    <!-- Small EV bay roll-up -->
    <rect x="-7" y="-11" width="8" height="9.5" rx="0.45" class="us-roll-door" />
    <line v-for="i in 4" :key="'s' + i" x1="-7" :y1="-9 + i * 1.8" x2="1" :y2="-9 + i * 1.8" class="us-roll-line" />

    <!-- Large two-story bay roll-up (faces the driveway) -->
    <rect x="2" y="-23" width="13" height="21" rx="0.45" class="us-roll-door us-roll-large" />
    <line v-for="i in 7" :key="'l' + i" x1="2" :y1="-20.5 + i * 2.6" x2="15" :y2="-20.5 + i * 2.6" class="us-roll-line" />

    <!-- Flat industrial roof — no chimney -->
    <rect x="-21" y="-28" width="38" height="3" rx="0.35" class="us-roof" />
    <line x1="-21" y1="-25.3" x2="17" y2="-25.3" class="us-coping" />

    <!-- Weathering at the sill -->
    <rect x="-20" y="-0.5" width="36" height="1" class="us-weather" />
  </g>
</template>

<style scoped>
.utility-station {
  pointer-events: all;
}

.us-shadow {
  fill: #1a201c;
  opacity: 0.35;
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

.us-floor-slab {
  fill: #6d747c;
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
  stroke: #737981;
  stroke-width: 0.9;
}

.us-weather {
  fill: #5c6759;
  opacity: 0.45;
}
</style>
