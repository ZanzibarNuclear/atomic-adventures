<template>
  <g class="room-layer">
    <g
      v-for="p in rooms"
      :key="p.room.id"
      class="room"
      :class="{
        current: p.room.id === currentRoom,
        reachable: reachableRooms.includes(p.room.id),
        visited: isDiscovered(p.room),
        unvisited: (isFogged(p.room) || !isDiscovered(p.room)) && !isOpenVoid(p.room),
        open: isOpenVoid(p.room),
        overlook: p.room.open && p.room.mirror,
        'builder-selected': isItemSelected(p.room.id),
      }"
      @click="$emit('room-click', p.room)"
    >
      <rect :x="p.rect.x" :y="p.rect.y" :width="p.rect.w" :height="p.rect.h" rx="4" class="floor" />
      <line
        v-for="(rl, i) in p.railings"
        :key="p.room.id + '-rail-' + i"
        :x1="rl.x1"
        :y1="rl.y1"
        :x2="rl.x2"
        :y2="rl.y2"
        class="railing"
      />
      <line
        v-for="(w, i) in p.windows"
        v-show="isDiscovered(p.room) || isOpenVoid(p.room)"
        :key="p.room.id + '-win-' + i"
        :x1="w.x1"
        :y1="w.y1"
        :x2="w.x2"
        :y2="w.y2"
        class="window"
      />
      <rect
        v-if="p.entry"
        :x="p.entry.x"
        :y="p.entry.y"
        :width="p.entry.w"
        :height="p.entry.h"
        class="entry-door"
      />
      <text
        v-if="!isOpenVoid(p.room) && p.room.icon && isDiscovered(p.room)"
        :x="p.center.x"
        :y="p.center.y"
        class="room-icon"
      >
        {{ p.room.icon }}
      </text>
      <text
        :x="p.center.x"
        :y="p.center.y + (isOpenVoid(p.room) ? 0 : isDiscovered(p.room) ? cell * 0.24 : 6)"
        class="room-label"
        :class="{
          'open-label': isOpenVoid(p.room),
          'fog-mark': !isOpenVoid(p.room) && !isDiscovered(p.room),
        }"
      >
        {{ isOpenVoid(p.room) ? p.room.name : isDiscovered(p.room) ? p.room.name : '?' }}
      </text>
      <text
        v-if="p.room.note && isDiscovered(p.room) && !isOpenVoid(p.room)"
        :x="p.center.x"
        :y="p.center.y + cell * 0.44"
        class="room-note"
      >
        {{ p.room.note }}
      </text>
    </g>
  </g>
</template>

<script setup>
defineProps({
  rooms: { type: Array, default: () => [] },
  currentRoom: { type: String, default: '' },
  reachableRooms: { type: Array, default: () => [] },
  cell: { type: Number, required: true },
  isDiscovered: { type: Function, required: true },
  isFogged: { type: Function, required: true },
  isOpenVoid: { type: Function, required: true },
  isItemSelected: { type: Function, required: true },
})

defineEmits(['room-click'])
</script>

<style scoped>
.room {
  cursor: pointer;
}
.floor {
  fill: #3b4658;
  stroke: #20262f;
  stroke-width: 2;
  transition: fill 0.3s ease, stroke 0.3s ease;
}
.room.visited .floor {
  fill: #50617a;
}
.room.unvisited .floor {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-dasharray: 4 4;
}
.room.reachable.unvisited .floor {
  stroke: rgba(109, 185, 127, 0.45);
  cursor: pointer;
}
.room.current .floor {
  fill: #5d7090;
  stroke: #ffd166;
  stroke-width: 3.5;
}
.room.open {
  cursor: default;
}
.room.open .floor {
  fill: #14181f;
  stroke: #2b333d;
}
.room.overlook .floor {
  fill: #50617a;
  stroke: #20262f;
}
.room.overlook.unvisited .floor {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-dasharray: 4 4;
}
.railing {
  stroke: #b9923f;
  stroke-width: 2.5;
  stroke-dasharray: 2 3;
  pointer-events: none;
}
.room-icon {
  font-size: 22px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.room-label {
  fill: #f4f1de;
  font-size: 10px;
  text-anchor: middle;
  dominant-baseline: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 3px;
  pointer-events: none;
}
.fog-mark {
  fill: rgba(255, 255, 255, 0.3);
  font-size: 22px;
  text-anchor: middle;
  font-weight: 700;
  paint-order: unset;
  stroke: none;
}
.room-label.open-label {
  fill: #5d6775;
  font-weight: 500;
  font-style: italic;
  font-size: 9px;
  stroke: none;
}
.room-note {
  fill: #aab2c0;
  font-size: 7.5px;
  text-anchor: middle;
  dominant-baseline: middle;
  font-style: italic;
  pointer-events: none;
}
.window {
  stroke: #7ec8ff;
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0.85;
  pointer-events: none;
}
.entry-door {
  fill: #c39a6b;
  pointer-events: none;
}
</style>
