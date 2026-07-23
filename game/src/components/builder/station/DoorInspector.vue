<script setup>
import { computed } from "vue";
import { setRollDoorProps } from "../../../lib/maps/composables/useGridBuilder.js";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
  characterCatalog: { type: Object, required: true },
  rollDoorRoom: { type: Object, default: null },
});

const linkedRoomIds = computed(() => {
  const doorId = props.selection?.id;
  if (!doorId) return [];
  const ids = new Set();
  for (const link of props.draft?.links ?? []) {
    if (link.door !== doorId) continue;
    if (link.from) ids.add(link.from);
    if (link.to) ids.add(link.to);
  }
  return [...ids];
});

function roomLabel(roomId) {
  const room = (props.draft?.rooms ?? []).find((entry) => entry.id === roomId);
  return room?.label || roomId;
}

function setStandLabel(roomId, value) {
  const door = props.selection.entity;
  const text = String(value ?? "").trim();
  door.standLabels ??= {};
  if (text) {
    door.standLabels[roomId] = text;
    return;
  }
  delete door.standLabels[roomId];
  if (!Object.keys(door.standLabels).length) delete door.standLabels;
}

function setKeyLock(door, value) {
  const key = String(value ?? "").trim();
  if (key) {
    door.lock ??= {};
    door.lock.key = key;
    return;
  }
  if (door.lock) {
    delete door.lock.key;
    if (!Object.keys(door.lock).length) delete door.lock;
  }
}

function setInitialField(door, key, value) {
  door.initial ??= { closed: true, locked: false };
  door.initial[key] = value;
}
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selection.id }}</code>
    </div>
    <label>Label
      <input v-model="selection.entity.label" placeholder="stairway door" />
      <span class="field-hint">
        Player-facing name for open/close/lock actions and the automatic door stand
        (<code>door:{{ selection.id }}</code>). Without a label, the game invents a
        destination phrase instead of using the raw door id.
      </span>
    </label>
    <details class="stand-labels">
      <summary>Per-side stand names (optional)</summary>
      <p class="field-hint">
        Override the automatic stand name on each room side of this door. Leave blank
        to use the shared label above.
      </p>
      <div
        v-for="roomId in linkedRoomIds"
        :key="roomId"
        class="field-grid">
        <label>{{ roomLabel(roomId) }}
          <input
            :value="selection.entity.standLabels?.[roomId] ?? ''"
            :placeholder="selection.entity.label || 'use shared label'"
            @input="setStandLabel(roomId, $event.target.value)"
          />
        </label>
      </div>
    </details>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Access</h4>
    </div>
    <div class="field-grid">
      <label>Initial state
        <select
          :value="selection.entity.initial?.closed ?? true"
          @change="setInitialField(selection.entity, 'closed', $event.target.value === 'true')">
          <option :value="true">Closed</option>
          <option :value="false">Open</option>
        </select>
      </label>
      <label>Initial lock
        <select
          :value="selection.entity.initial?.locked ?? false"
          @change="setInitialField(selection.entity, 'locked', $event.target.value === 'true')">
          <option :value="false">Unlocked</option>
          <option :value="true">Locked</option>
        </select>
      </label>
    </div>
    <fieldset>
      <legend>Key requirement</legend>
      <label>Key item
        <select
          :value="selection.entity.lock?.key ?? ''"
          @change="setKeyLock(selection.entity, $event.target.value)">
          <option value="">No key</option>
          <option
            v-for="item in characterCatalog.items"
            :key="item.id"
            :value="item.id">
            {{ item.label }} ({{ item.id }})
          </option>
        </select>
      </label>
    </fieldset>
  </section>

  <section v-if="selection.entity.kind === 'man'" class="form-section">
    <div class="section-heading">
      <h4>Position</h4>
    </div>
    <div class="field-grid">
      <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
      <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
    </div>
    <fieldset>
      <legend>Orientation</legend>
      <label class="check-field">
        <input v-model="selection.entity.vertical" type="checkbox" />
        Vertical
      </label>
    </fieldset>
  </section>

  <section v-else-if="rollDoorRoom" class="form-section">
    <div class="section-heading">
      <h4>Roll Door</h4>
    </div>
    <label>Wall
      <select
        :value="rollDoorRoom.rollDoor"
        @change="setRollDoorProps(draft, selection.id, { edge: $event.target.value })"
      >
        <option>north</option><option>east</option><option>south</option><option>west</option>
      </select>
    </label>
    <label>Span
      <input
        :value="rollDoorRoom.rollSpan"
        type="number"
        min=".1"
        max="1"
        step=".05"
        @input="setRollDoorProps(draft, selection.id, { rollSpan: Number($event.target.value) })"
      />
    </label>
  </section>
</template>

<style scoped>
.field-hint {
  display: block;
  margin-top: 0.35rem;
  color: #8f98a6;
  font-size: 0.78rem;
  line-height: 1.4;
}
.field-hint code {
  font-size: 0.74rem;
  color: #b8c0cc;
}
.stand-labels {
  margin-top: 0.75rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #151a22;
}
.stand-labels summary {
  cursor: pointer;
  color: #c5d0e0;
  font-size: 0.82rem;
}
.stand-labels .field-grid {
  margin-top: 0.55rem;
}
</style>
