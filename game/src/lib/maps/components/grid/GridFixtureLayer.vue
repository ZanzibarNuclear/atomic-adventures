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
        'builder-selectable': builderView,
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
          v-if="f.visualOnly && builderView"
          :x="f.box.x - cell * 0.08"
          :y="f.box.y - cell * 0.08"
          :width="f.box.w + cell * 0.16"
          :height="f.box.h + cell * 0.16"
          class="fixture-hit"
        />
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
        <template v-else-if="!f.visualOnly">
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
  builderView: { type: Boolean, default: false },
  builderFixtureClickTarget: { type: String, default: 'fixture' },
})

const emit = defineEmits(['stair-fixture-click', 'stair-exit-click', 'select-item'])

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
  if (props.builderView) {
    if (props.builderFixtureClickTarget === 'feature-room' && f.featureRoomId) {
      emit('select-item', { source: 'rooms', id: f.featureRoomId })
      return
    }
    emit('select-item', { source: 'fixtures', id: f.id })
    return
  }
  if (f.visualOnly) return
  if (!f.featureRoomId || props.currentRoom === f.featureRoomId) return
  emit('stair-fixture-click', f)
}
</script>

<style scoped>
.fixture {
  cursor: default;
}
.fixture.reachable,
.fixture.stair-clickable,
.fixture.builder-selectable {
  cursor: pointer;
}
.fixture.fog {
  cursor: default;
}
.fixture-fog-fill {
  fill: #222a25;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
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
.stair-hit {
  fill: transparent;
  stroke: none;
}
.fixture-hit {
  fill: transparent;
  stroke: none;
}
.stair-tread {
  stroke: #c9b88a;
  stroke-linecap: round;
  pointer-events: none;
}
.stair-pad {
  fill: #20262f;
  stroke: #d7c48f;
  stroke-width: 1.5;
  pointer-events: none;
}
.spiral-exit {
  cursor: default;
  opacity: 0.45;
}
.spiral-exit.reachable {
  cursor: pointer;
  opacity: 1;
}
.spiral-exit.reachable .stair-pad {
  pointer-events: all;
}
.spiral-exit .stair-pad {
  pointer-events: all;
}
.stair-icon {
  fill: #d7c48f;
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.spiral-glass {
  fill: rgba(126, 200, 255, 0.16);
  stroke: none;
  transition: fill 0.3s ease;
}
.fixture.current .spiral-glass {
  fill: rgba(126, 200, 255, 0.28);
}
.spiral-frame {
  fill: none;
  stroke: #9fd3ff;
  stroke-width: 2.5;
  stroke-linejoin: round;
  transition: stroke 0.3s ease, stroke-width 0.3s ease;
}
.fixture.current .spiral-frame {
  stroke: #ffd166;
  stroke-width: 3.5;
}
</style>
