<script setup>
import { setRollDoorProps } from "../../../lib/maps/composables/useGridBuilder.js";

defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
  characterCatalog: { type: Object, required: true },
  rollDoorRoom: { type: Object, default: null },
});

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
      <input v-model="selection.entity.label" placeholder="Garage man door" />
    </label>
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
