<template>
  <g class="fixture-layer">
    <g
      v-for="f in fixtures"
      :key="f.id"
      class="fixture"
      :class="{
        fog: !isFixtureRevealed(f),
        current: f.featureRoomId && currentRoom === f.featureRoomId,
        reachable:
          f.featureRoomId &&
          isFixtureRevealed(f) &&
          reachableRooms.includes(f.featureRoomId),
        'visual-only': f.visualOnly,
        'stair-clickable':
          f.featureRoomId &&
          isFixtureRevealed(f) &&
          !f.visualOnly &&
          currentRoom !== f.featureRoomId &&
          reachableRooms.includes(f.featureRoomId),
      }"
      @click="onFixtureClick(f)"
    >
      <template v-if="!isFixtureRevealed(f)">
        <rect
          :x="(f.fogBox ?? f.box).x"
          :y="(f.fogBox ?? f.box).y"
          :width="(f.fogBox ?? f.box).w"
          :height="(f.fogBox ?? f.box).h"
          rx="4"
          class="fixture-fog-fill"
        />
        <text :x="f.cx" :y="f.cy + 6" class="fog-mark">?</text>
      </template>
      <template v-else-if="f.type === 'spiral'">
        <path :d="f.fillPath" class="spiral-glass" />
        <path :d="f.arcPath" class="spiral-frame" />
        <line
          v-for="(t, i) in f.treads"
          :key="f.id + '-tread-' + i"
          :x1="t.x1"
          :y1="t.y1"
          :x2="t.x2"
          :y2="t.y2"
          class="stair-tread"
          :stroke-width="t.width"
          :opacity="t.opacity"
        />
        <g v-if="f.featureRoomId && currentRoom === f.featureRoomId" class="spiral-exits">
          <g
            v-for="exit in stairExits(f)"
            :key="exit.roomId"
            class="spiral-exit"
            :class="{ reachable: reachableRooms.includes(exit.roomId) }"
            @click.stop="$emit('stair-exit-click', f, exit.roomId)"
          >
            <circle :cx="exit.x" :cy="exit.y" :r="cell * 0.14" class="stair-pad" />
            <text :x="exit.x" :y="exit.y" class="stair-icon">{{ exit.icon }}</text>
          </g>
        </g>
      </template>
      <template v-else>
        <rect
          v-if="!f.visualOnly"
          :x="f.box.x"
          :y="f.box.y"
          :width="f.box.w"
          :height="f.box.h"
          class="stair-hit"
        />
        <line
          v-for="(t, i) in f.treads"
          :key="f.id + '-tread-' + i"
          :x1="t.x1"
          :y1="t.y1"
          :x2="t.x2"
          :y2="t.y2"
          class="stair-tread"
          :stroke-width="t.width"
        />
        <g v-if="f.featureRoomId && currentRoom === f.featureRoomId" class="spiral-exits">
          <g
            v-for="exit in stairExits(f)"
            :key="exit.roomId"
            class="spiral-exit"
            :class="{ reachable: reachableRooms.includes(exit.roomId) }"
            @click.stop="$emit('stair-exit-click', f, exit.roomId)"
          >
            <circle :cx="exit.x" :cy="exit.y" :r="cell * 0.14" class="stair-pad" />
            <text :x="exit.x" :y="exit.y" class="stair-icon">{{ exit.icon }}</text>
          </g>
        </g>
        <template v-else-if="f.featureRoomId">
          <circle :cx="f.cx" :cy="f.cy" :r="cell * 0.15" class="stair-pad" />
          <text :x="f.cx" :y="f.cy" class="stair-icon">{{ dirIcon(f.dir) }}</text>
        </template>
        <template v-else>
          <circle :cx="f.cx" :cy="f.cy" :r="cell * 0.15" class="stair-pad" />
          <text :x="f.cx" :y="f.cy" class="stair-icon">{{ dirIcon(f.dir) }}</text>
        </template>
      </template>
    </g>
  </g>
</template>

<script setup>
const props = defineProps({
  fixtures: { type: Array, default: () => [] },
  cell: { type: Number, required: true },
  currentRoom: { type: String, default: '' },
  reachableRooms: { type: Array, default: () => [] },
  isFixtureRevealed: { type: Function, required: true },
})

const emit = defineEmits(['stair-fixture-click', 'stair-exit-click'])

function dirIcon(dir) {
  if (dir === 'up') return '▲'
  if (dir === 'down') return '▼'
  return '↕'
}

function stairExits(f) {
  const out = []
  if (f.exitUpRoomId) {
    out.push({ roomId: f.exitUpRoomId, x: f.exitUp.x, y: f.exitUp.y, icon: '▲' })
  }
  if (f.exitDownRoomId) {
    out.push({ roomId: f.exitDownRoomId, x: f.exitDown.x, y: f.exitDown.y, icon: '▼' })
  }
  return out
}

function onFixtureClick(f) {
  if (f.visualOnly) return
  if (!f.featureRoomId || props.currentRoom === f.featureRoomId) return
  emit('stair-fixture-click', f)
}
</script>
