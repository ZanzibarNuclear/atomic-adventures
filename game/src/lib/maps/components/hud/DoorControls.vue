<template>
  <div v-if="doors.length" class="doors">
    <span class="label">Doors</span>
    <div v-for="d in doors" :key="d.doorId" class="door-row">
      <span class="door-name">
        {{ doorLabel(building, d.doorId, d.toName) }}
        <em class="door-state">{{
          doorStatusText(
            doorStateFor(d.doorId),
            building.doorById[d.doorId],
            facility,
          )
        }}</em>
        <em v-if="doorLockHint(d.doorId)" class="door-hint">{{
          doorLockHint(d.doorId)
        }}</em>
      </span>
      <span
        v-if="!isSelfClosingDoor(building.doorById[d.doorId])"
        class="door-actions">
        <button
          v-if="canBreakLock(doorState, building.areaId, d.doorId, building)"
          class="sm"
          @click="$emit('break-lock', d.doorId)">
          Break lock
        </button>
        <button
          v-if="
            !isEnablerLock(building.doorById[d.doorId]) &&
            (canToggleLock(
              doorState,
              building.areaId,
              d.doorId,
              building,
              playerRoomId,
              inventory,
              facility,
            ) ||
              doorStateFor(d.doorId).locked)
          "
          class="sm"
          :disabled="!canToggleDoorLock(d.doorId)"
          :title="
            canToggleDoorLock(d.doorId)
              ? ''
              : doorLockHint(d.doorId) || 'Cannot change lock'
          "
          @click="$emit('toggle-lock', d.doorId)">
          {{ doorStateFor(d.doorId).locked ? "Unlock" : "Lock" }}
        </button>
        <button
          v-if="
            canOpenDoor(doorState, building.areaId, d.doorId) ||
            canCloseDoor(doorState, building.areaId, d.doorId)
          "
          class="sm"
          @click="$emit('toggle-door', d.doorId)">
          {{ doorStateFor(d.doorId).open ? "Close" : "Open" }}
        </button>
      </span>
    </div>
  </div>
</template>

<script setup>
import {
  doorLabel,
  doorStatusText,
  canOpenDoor,
  canCloseDoor,
  canToggleLock,
  canBreakLock,
  isEnablerLock,
  isSelfClosingDoor,
} from "../../composables/useDoors.js";

const props = defineProps({
  doors: { type: Array, default: () => [] },
  building: { type: Object, required: true },
  doorState: { type: Object, required: true },
  facility: { type: Object, required: true },
  inventory: { type: Object, required: true },
  playerRoomId: { type: String, default: null },
  doorStateFor: { type: Function, required: true },
  doorLockHint: { type: Function, required: true },
  canToggleDoorLock: { type: Function, required: true },
});

defineEmits(["break-lock", "toggle-lock", "toggle-door"]);
</script>

<style scoped>
.doors {
  margin-top: 0.75rem;
}
.door-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  margin-top: 0.35rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.door-row:last-child {
  border-bottom: none;
}
.door-name {
  font-size: 0.88rem;
}
.door-state {
  color: #8b94a3;
  font-style: normal;
  margin-left: 0.35rem;
}
.door-hint {
  display: block;
  color: #6f7787;
  font-size: 0.78rem;
  margin-top: 0.15rem;
}
.door-actions {
  display: flex;
  gap: 0.35rem;
}
</style>
