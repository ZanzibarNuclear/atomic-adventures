<script setup>
import { ref } from "vue";
import { RouterLink, RouterView } from "vue-router";

const openMenu = ref(null);

function openGame() {
  window.open("/", "atomic-adventures-game", "popup=yes,width=1100,height=900");
  if (openMenu.value) openMenu.value.open = false;
}
</script>

<template>
  <div class="authoring-shell">
    <header class="authoring-header">
      <div>
        <p class="label">Authoring</p>
        <h1>Atomic Adventures Builder</h1>
      </div>
      <div class="authoring-actions">
        <nav class="builder-tabs" aria-label="Builder workspace">
          <RouterLink to="/builder/story">Story</RouterLink>
          <RouterLink to="/builder/world">World</RouterLink>
          <RouterLink to="/builder/character">Character</RouterLink>
        </nav>
        <details ref="openMenu" class="open-menu">
          <summary>Open</summary>
          <div class="open-menu-popover">
            <button type="button" class="open-menu-item" @click="openGame">Open game</button>
          </div>
        </details>
      </div>
    </header>
    <RouterView />
  </div>
</template>

<style scoped>
.authoring-shell { min-height: 100vh; }
.authoring-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: .85rem 1rem;
  border-bottom: 1px solid #343d4d;
  background: #20252f;
}
.authoring-header h1 { margin: 0; font-size: 1.05rem; }
.authoring-header p { margin: 0 0 .15rem; }
.authoring-actions, .builder-tabs { display: flex; align-items: center; gap: .5rem; }
.builder-tabs {
  padding: .2rem;
  border: 1px solid #3c4658;
  border-radius: 9px;
  background: #171b22;
}
.builder-tabs a {
  padding: .38rem .75rem;
  border-radius: 7px;
  color: #aeb5c0;
  text-decoration: none;
}
.builder-tabs a.router-link-active { background: #49624f; color: #eef7f0; }
.open-menu { position: relative; }
.open-menu summary {
  list-style: none;
  user-select: none;
  border: 1px solid #3a404a;
  border-radius: 8px;
  padding: .4rem .7rem;
  color: #b8bec8;
  cursor: pointer;
}
.open-menu summary::-webkit-details-marker { display: none; }
.open-menu summary::after { content: " ▾"; }
.open-menu-popover {
  position: absolute;
  z-index: 50;
  top: calc(100% + .35rem);
  right: 0;
  min-width: 10rem;
  padding: .35rem;
  border: 1px solid #465166;
  border-radius: 8px;
  background: #202630;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .35);
}
.open-menu-item { width: 100%; border: 0; background: transparent; text-align: left; }
@media (max-width: 650px) {
  .authoring-header { align-items: flex-start; }
  .authoring-header h1 { display: none; }
}
</style>
