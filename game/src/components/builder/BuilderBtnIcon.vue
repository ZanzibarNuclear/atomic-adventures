<script setup>
const ICONS = {
  add: ["M12 5v14M5 12h14"],
  remove: [
    "M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7",
  ],
  up: ["M12 19V5M6 11l6-6 6 6"],
  down: ["M12 5v14M6 13l6 6 6-6"],
  edit: ["M4 20h4.5L19 9.5 14.5 5 4 15.5V20z", "M12.5 6.5 17.5 11.5"],
  duplicate: ["M9 7h10v10H9z", "M5 3h10v4"],
  close: ["M6 6l12 12M18 6 6 18"],
  check: ["M5 12.5 9.5 17 19 7.5"],
  revert: ["M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"],
  save: ["M5 4h11l3 3v13H5V4z", "M8 4v5h8V4M8 20v-7h8v7"],
  history: ["M12 8v5l3.2 1.8", "M21 12a9 9 0 1 1-3-6.7"],
  reload: ["M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"],
};

defineProps({
  name: { type: String, required: true },
});
</script>

<template>
  <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      v-for="d in (ICONS[name] ?? ICONS.add)"
      :key="d"
      :d="d"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round" />
  </svg>
</template>
