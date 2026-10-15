<script setup>
defineProps({ name: String })
const paths = {
  zoom: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5M7 10.5h7M10.5 7v7',
  speed: 'M4.2 18a9 9 0 1 1 15.6 0M12 13l4-5M6 13h1M17 13h1M12 5v1M8 7l.7.7M11 18h2',
  direction: 'M20 7v5h-5M4 17v-5h5M5.5 7a7.5 7.5 0 0 1 12.4-1L20 9M4 15l2.1 3a7.5 7.5 0 0 0 12.4-1',
  letters: 'M3 18 8 5l5 13M5 13h6M15 10h6M18 10v8M16 18h4',
  camera: 'M3 7h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM17 11l5-3v10l-5-3',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 4 12 8-12 8Z',
  power: 'M12 2v9M6.3 5.3a9 9 0 1 0 11.4 0',
  chevron: 'm9 5 7 7-7 7',
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name] || paths.camera" />
  </svg>
</template>
