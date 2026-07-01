<script setup>
defineProps({
  stationPowerOn: { type: Boolean, default: false },
});

defineEmits(["close", "set-station-power"]);
</script>

<template>
  <div class="dev-settings-backdrop" role="presentation" @click.self="$emit('close')">
    <section class="dev-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="dev-settings-title">
      <header class="dialog-header">
        <div>
          <p class="label">Developer overrides</p>
          <h2 id="dev-settings-title">Settings</h2>
        </div>
        <button type="button" class="sm muted" @click="$emit('close')">Close</button>
      </header>

      <section class="setting-group">
        <h3>Facility State</h3>
        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="stationPowerOn"
            @change="$emit('set-station-power', $event.target.checked)">
          <span>
            <strong>Station power</strong>
            <small>Sets `hub.hydro_online` and the indoor facility power state.</small>
          </span>
        </label>
      </section>
    </section>
  </div>
</template>

<style scoped>
.dev-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: start center;
  padding: 5rem 1rem 1rem;
  background: rgba(4, 8, 12, 0.58);
}

.dev-settings-dialog {
  width: min(34rem, 100%);
  border: 1px solid #4b586e;
  border-radius: 8px;
  background: #202630;
  color: #dbe2ea;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  padding: 1rem;
}

.dialog-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.dialog-header h2,
.setting-group h3 {
  margin: 0;
}

.label {
  margin: 0 0 0.15rem;
  color: #94a9c5;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.setting-group {
  display: grid;
  gap: 0.65rem;
  padding-top: 0.8rem;
  border-top: 1px solid #39465a;
}

.toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid #3f4d62;
  border-radius: 8px;
  background: #181e27;
}

.toggle-row input {
  margin-top: 0.2rem;
}

.toggle-row span {
  display: grid;
  gap: 0.2rem;
}

.toggle-row small {
  color: #9daabc;
}
</style>
