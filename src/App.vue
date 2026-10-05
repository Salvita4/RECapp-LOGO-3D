<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import logo from './assets/logo-contours.json'

const canvas = ref(null)
const ready = ref(false)
let disposeScene
let unmounted = false

const fallbackPaths = logo.layers.map((layer) => ({
  color: layer.color,
  path: layer.contours.map(({ points }) => `M${points.map((p) => p.join(',')).join('L')}Z`).join(''),
}))

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
    disposeScene = createLogoScene(canvas.value)
    ready.value = true
  } catch (error) {
    // Keep the complete logo visible if WebGL is unavailable.
    console.warn('No se pudo iniciar el logo 3D.', error)
  }
})

onBeforeUnmount(() => {
  unmounted = true
  disposeScene?.()
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
      :viewBox="`0 0 ${logo.width} ${logo.height}`"
      aria-hidden="true"
    >
      <path v-for="layer in fallbackPaths" :key="layer.color" :fill="layer.color" :d="layer.path" />
    </svg>
  </main>
</template>
