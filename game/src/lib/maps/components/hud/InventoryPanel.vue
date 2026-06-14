<template>
  <div v-if="items.length" class="inventory">
    <span class="label">Carrying</span>
    <ul class="inventory-list">
      <li v-for="item in items" :key="item.id">
        <strong>{{ item.name }}</strong>
        <em v-if="item.description">{{ item.description }}</em>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
});
</script>

<style scoped>
.inventory {
  margin-top: 0.75rem;
}
.inventory-list {
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}
.inventory-list li {
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
}
.inventory-list em {
  display: block;
  color: #7f8794;
  font-size: 0.78rem;
  font-style: normal;
}
</style>
