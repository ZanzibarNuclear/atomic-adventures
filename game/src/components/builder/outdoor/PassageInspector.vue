<script setup>
defineProps({
  selected: { type: Object, required: true },
  passageKinds: { type: Array, required: true },
  allHexIds: { type: Array, required: true },
  csv: { type: Function, required: true },
  setCsv: { type: Function, required: true },
  pointMode: { type: Function, required: true },
  setPointMode: { type: Function, required: true },
  removeBoothAt: { type: Function, required: true },
  ensureBoothAt: { type: Function, required: true },
});
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selected.id }}</code>
    </div>
    <label>Label<input v-model="selected.label" /></label>
    <label>Kind
      <select v-model="selected.kind">
        <option v-for="kind in passageKinds" :key="kind">{{ kind }}</option>
      </select>
    </label>
    <label>Visibility
      <select v-model="selected.visibility"><option>obvious</option><option>hidden</option></select>
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Location</h4>
    </div>
    <label>Hex
      <select v-model="selected.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select>
    </label>
    <label>Radius<input v-model.number="selected.radius" type="number" /></label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Requirements</h4>
    </div>
    <label>All flags
      <input
        :value="csv(selected.require?.all)"
        @input="selected.require ??= {}; setCsv(selected.require, 'all', $event)"
      />
    </label>
    <label>Any flags
      <input
        :value="csv(selected.require?.any)"
        @input="selected.require ??= {}; setCsv(selected.require, 'any', $event)"
      />
    </label>
    <label>Not flags
      <input
        :value="csv(selected.require?.not)"
        @input="selected.require ??= {}; setCsv(selected.require, 'not', $event)"
      />
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Unlock action</h4>
    </div>
    <label>Button label
      <input
        :value="selected.unlock?.label ?? ''"
        @input="selected.unlock ??= {}; selected.unlock.label = $event.target.value"
      />
    </label>
    <label>Locked status
      <input
        :value="selected.unlock?.status ?? ''"
        @input="selected.unlock ??= {}; selected.unlock.status = $event.target.value"
      />
    </label>
    <label>Set flags
      <input
        :value="csv(selected.unlock?.set_flags)"
        @input="selected.unlock ??= {}; setCsv(selected.unlock, 'set_flags', $event)"
      />
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>On crossing</h4>
    </div>
    <label>Set flags
      <input
        :value="csv(selected.on_cross?.set_flags)"
        @input="selected.on_cross ??= {}; setCsv(selected.on_cross, 'set_flags', $event)"
      />
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Passage point</h4>
    </div>
    <label>Coordinate mode
      <select :value="pointMode(selected.at)" @change="setPointMode(selected.at, $event.target.value)">
        <option value="hex">Hex anchor</option><option value="raw">World coordinates</option>
      </select>
    </label>
    <template v-if="selected.at?.hex != null">
      <label>Anchor hex<select v-model="selected.at.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select></label>
      <div class="field-grid">
        <label>dx<input v-model.number="selected.at.dx" type="number" step=".01" /></label>
        <label>dy<input v-model.number="selected.at.dy" type="number" step=".01" /></label>
      </div>
    </template>
    <div v-else class="field-grid">
      <label>X<input v-model.number="selected.at.x" type="number" /></label>
      <label>Y<input v-model.number="selected.at.y" type="number" /></label>
    </div>
  </section>

  <section v-if="selected.kind === 'gate'" class="form-section">
    <div class="section-heading">
      <h4>Guard booth point</h4>
    </div>
    <div v-if="selected.boothAt">
      <label>Coordinate mode
        <select :value="pointMode(selected.boothAt)" @change="setPointMode(selected.boothAt, $event.target.value)">
          <option value="hex">Hex anchor</option><option value="raw">World coordinates</option>
        </select>
      </label>
      <template v-if="selected.boothAt?.hex != null">
        <label>Anchor hex<select v-model="selected.boothAt.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select></label>
        <div class="field-grid">
          <label>dx<input v-model.number="selected.boothAt.dx" type="number" step=".01" /></label>
          <label>dy<input v-model.number="selected.boothAt.dy" type="number" step=".01" /></label>
        </div>
      </template>
      <div v-else class="field-grid">
        <label>X<input v-model.number="selected.boothAt.x" type="number" /></label>
        <label>Y<input v-model.number="selected.boothAt.y" type="number" /></label>
      </div>
      <button type="button" class="sm danger-outline" @click="removeBoothAt">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
        </svg>
        Remove booth
      </button>
    </div>
    <button v-else type="button" class="sm add-btn" @click="ensureBoothAt">
      <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
      </svg>
      Add guard booth
    </button>
  </section>
</template>
