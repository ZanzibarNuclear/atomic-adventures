<script setup>
defineProps({
  events: { type: Array, required: true },
});
</script>

<template>
  <div class="history-panel">
    <h2>Recent events</h2>
    <p v-if="!events.length" class="quiet">No hydro events recorded.</p>
    <ol v-else>
      <li v-for="event in events" :key="event.eventId">
        <span>{{ Math.round(event.elapsedMinutes) }} min</span>
        <strong>{{ event.label || event.type }}</strong>
      </li>
    </ol>
  </div>
</template>
