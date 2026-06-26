<template>
  <aside class="indoor-audit" aria-label="Indoor movement audit">
    <div class="audit-heading">
      <div>
        <strong>Grid movement audit</strong>
        <span>{{ locationLabel }}</span>
      </div>
      <button class="sm" @click="$emit('close')">Close</button>
    </div>

    <div class="audit-section">
      <span class="audit-label">Valid moves</span>
      <ul v-if="validMoves.length">
        <li v-for="move in validMoves" :key="move.key" class="valid">
          {{ move.label }}
        </li>
      </ul>
      <p v-else>None</p>
    </div>

    <div class="audit-section">
      <span class="audit-label">Doors here</span>
      <ul v-if="doors.length">
        <li v-for="door in doors" :key="door.id" :class="door.passable ? 'valid' : 'blocked'">
          {{ door.id }} — {{ door.status }}
        </li>
      </ul>
      <p v-else>None</p>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { displayLabel, roomLabel } from '../../../displayLabel.js'
import { canPassDoor } from '../../composables/useDoors.js'

const props = defineProps({
  indoor: { type: Object, required: true },
})

defineEmits(['close'])

const locationLabel = computed(() => {
  if (props.indoor.currentExteriorNode) {
    return displayLabel(props.indoor.currentExteriorNode)
  }
  return roomLabel(props.indoor.currentRoomData)
})

const validMoves = computed(() =>
  props.indoor.indoorMoves.map((move) => ({
    key: props.indoor.moveKey(move),
    label: `${move.label} → ${move.toName}`,
  })),
)

const doors = computed(() =>
  props.indoor.nearbyDoors.map((nearby) => {
    const door = props.indoor.building.doorById[nearby.doorId]
    const state = props.indoor.doorStateFor(nearby.doorId)
    const passable = canPassDoor(
      props.indoor.indoor.doorState,
      props.indoor.building.areaId,
      nearby.doorId,
      door,
    )
    const status = passable
      ? (door?.selfClosing ? 'self-closing / passable' : 'open')
      : state?.locked
        ? 'locked'
        : 'closed'
    return { id: nearby.doorId, passable, status }
  }),
)
</script>

<style scoped>
.indoor-audit {
  margin: 0 0 1rem;
  padding: .8rem;
  border: 1px solid #526078;
  border-radius: 9px;
  background: rgba(20, 25, 33, .96);
  color: #dfe5ee;
  font-size: .78rem;
}
.audit-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.audit-heading div {
  display: grid;
  gap: .15rem;
}
.audit-heading span,
.audit-section p {
  color: #9ca8b8;
}
.audit-section {
  margin-top: .65rem;
}
.audit-label {
  color: #aeb9ca;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
}
ul {
  margin: .3rem 0 0;
  padding-left: 1.15rem;
}
.valid { color: #9ed7aa; }
.blocked { color: #e7aa91; }
</style>
