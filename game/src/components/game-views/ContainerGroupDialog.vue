<template>
  <Teleport to="body">
    <div
      class="group-modal-backdrop"
      role="presentation"
      @click.self="$emit('close')">
      <section
        class="group-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-dialog-title">
        <header class="group-dialog-header">
          <div>
            <p class="label">Within reach</p>
            <h2 id="group-dialog-title">{{ title }}</h2>
            <p v-if="intro" class="intro">{{ intro }}</p>
          </div>
          <button
            type="button"
            class="group-close"
            aria-label="Close"
            title="Close"
            @click="$emit('close')">
            ×
          </button>
        </header>

        <ul class="box-list">
          <li
            v-for="entry in entries"
            :key="entry.id"
            class="box-card">
            <div class="box-summary">
              <strong>{{ entry.label }}</strong>
              <p v-if="entry.detail" class="box-detail">{{ entry.detail }}</p>
            </div>
            <div class="box-actions">
              <button
                type="button"
                class="sm"
                @click="$emit('look-in', entry)">
                Look in
              </button>
              <button
                v-if="entry.canPickUp"
                type="button"
                class="sm"
                @click="$emit('pick-up', entry)">
                Pick up
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  intro: { type: String, default: "" },
  entries: { type: Array, required: true },
});

defineEmits(["close", "look-in", "pick-up"]);
</script>

<style scoped>
.group-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.68);
}
.group-dialog {
  width: min(36rem, 100%);
  max-height: min(36rem, calc(100vh - 2rem));
  overflow: auto;
  border: 1px solid rgba(120, 150, 195, 0.34);
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  padding: 1rem;
  color: #e8edf5;
}
.group-dialog-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.group-dialog-header .label {
  margin: 0;
  color: #8faed6;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.group-dialog-header h2 {
  margin: 0.15rem 0 0;
  font-size: 1.12rem;
}
.intro {
  margin: 0.4rem 0 0;
  color: #b7d4a8;
  font-size: 0.88rem;
  line-height: 1.45;
}
.group-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: #e8edf5;
  font-size: 1.25rem;
  cursor: pointer;
}
.box-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.box-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: center;
  padding: 0.7rem 0.75rem;
  border: 1px solid rgba(120, 150, 195, 0.28);
  border-radius: 8px;
  background: rgba(28, 36, 52, 0.82);
}
.box-summary strong {
  display: block;
  font-size: 0.95rem;
}
.box-detail {
  margin: 0.25rem 0 0;
  color: #93a3bc;
  font-size: 0.82rem;
}
.box-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: end;
}
@media (max-width: 640px) {
  .box-card {
    grid-template-columns: minmax(0, 1fr);
  }
  .box-actions {
    justify-content: start;
  }
}
</style>
