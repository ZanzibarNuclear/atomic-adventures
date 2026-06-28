<template>
  <div
    class="modal-backdrop"
    role="presentation"
    @click.self="$emit('close')">
    <section
      class="credits-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Credits">
      <button
        type="button"
        class="close-button"
        aria-label="Close credits"
        @click="$emit('close')">
        x
      </button>
      <img
        class="credits-logo"
        src="/atomic-ambitions-logo.png"
        alt="Atomic Ambitions" />
      <p>This experience is brought to you by the plucky crew at Atomic Ambitions.</p>
      <nav class="credits-links" aria-label="Credits links">
        <a href="https://www.atomicambitions.com/" target="_blank" rel="noopener">
          Atomic Ambitions
        </a>
        <a href="https://www.atomicambitions.com/policies" target="_blank" rel="noopener">
          Terms of Use
        </a>
      </nav>
      <p class="copyright">Copyright 2026 by Atomic Ambitions.</p>
    </section>
  </div>
</template>

<script setup>
defineEmits(["close"]);
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(10, 12, 16, 0.68);
}
.credits-dialog {
  position: relative;
  width: min(100%, 22rem);
  border: 1px solid #465166;
  border-radius: 8px;
  background: #202630;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.42);
  padding: 1.25rem;
}
.credits-logo {
  display: block;
  width: min(12rem, 72%);
  height: auto;
  margin: 0.2rem auto 1rem;
}
.credits-dialog p {
  margin: 0;
  color: #d5dce6;
}
.credits-links {
  display: flex;
  justify-content: center;
  gap: 0.8rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.credits-dialog .copyright {
  margin-top: 3px;
  color: #9aa0ac;
  font-size: 0.82rem;
  text-align: center;
}
.close-button {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  width: 2rem;
  height: 2rem;
  padding: 0;
  line-height: 1;
}
</style>
