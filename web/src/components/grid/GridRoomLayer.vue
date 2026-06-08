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
        :y="p.center.y - cell * 0.16"
        class="room-icon"
      >
        {{ p.room.icon }}
      </text>
      <text
        :x="p.center.x"
        :y="p.center.y + (isOpenVoid(p.room) ? 0 : isDiscovered(p.room) ? cell * 0.14 : 6)"
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
        :y="p.center.y + cell * 0.34"
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
