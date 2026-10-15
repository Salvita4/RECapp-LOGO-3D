<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import logo from './assets/logo-contours.json'
import HandPractice from './components/HandPractice.vue'
import { contourLetter } from './scene/logoParts.js'

const canvas = ref(null)
const ready = ref(false)
const zoom = ref(1)
const controls = ref({ speed: 1, direction: 1, letters: 1, paused: false })
let logoScene
let unmounted = false

function updateZoom(value) {
  zoom.value = value
  logoScene?.setZoom(value)
}

function updateControls(value) {
  controls.value = value
  logoScene?.setControls(value)
}

const fallbackPaths = computed(() => logo.layers.map((layer) => ({
  color: layer.color,
  path: layer.contours.map(({ points }) => {
    const letter = contourLetter(points)
    const scaled = letter ? points.map(([x, y]) => [
      letter.x + (x - letter.x) * controls.value.letters,
      letter.y + (y - letter.y) * controls.value.letters,
    ]) : points
    return `M${scaled.map((p) => p.join(',')).join('L')}Z`
  }).join(''),
})))

function contextLost(event) {
  event.preventDefault()
  ready.value = false
}

function contextRestored() {
  ready.value = true
}

onMounted(async () => {
  try {
    const { createLogoScene } = await import('./scene/createLogoScene.js')
    if (unmounted) return
    logoScene = createLogoScene(canvas.value)
    logoScene.setZoom(zoom.value)
    logoScene.setControls(controls.value)
    ready.value = true
  } catch (error) {
    // Keep the complete logo visible if WebGL is unavailable.
    console.warn('No se pudo iniciar el logo 3D.', error)
  }
})

onBeforeUnmount(() => {
  unmounted = true
  logoScene?.dispose()
})
</script>

<template>
  <main class="logo-stage" aria-label="RECapp, logo tridimensional en rojo y blanco">
    <canvas
      ref="canvas"
      aria-hidden="true"
      @webglcontextlost="contextLost"
      @webglcontextrestored="contextRestored"
    />
    <svg
      v-if="!ready"
      class="fallback-logo"
      :style="{ transform: `translate(-50%, -50%) scale(${zoom})` }"
      :viewBox="`0 0 ${logo.width} ${logo.height}`"
      aria-hidden="true"
    >
      <path v-for="layer in fallbackPaths" :key="layer.color" :fill="layer.color" :d="layer.path" />
    </svg>
    <HandPractice @zoom="updateZoom" @controls="updateControls" />
  </main>
</template>
