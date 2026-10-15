<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import ControlIcon from './ControlIcon.vue'
import { handAperture, apertureToZoom, smoothZoom } from '../tracking/handZoom.js'
import { MODES, heightToSpeed, apertureToLetters, palmPosition, handDirection, commandGesture, createGestureHold } from '../tracking/handControls.js'

const emit = defineEmits(['zoom', 'controls'])
const zoom = ref(1)
const aperture = ref(null)
const mode = ref('zoom')
const speed = ref(1)
const letters = ref(1)
const direction = ref(1)
const paused = ref(false)
const gestureProgress = ref(0)
const handDetected = ref(false)
const trackingState = ref('off')
const previewAspect = ref(4 / 3)
const cameraLabel = computed(() => !active.value ? 'Cámara apagada'
  : trackingState.value === 'loading' ? 'Preparando seguimiento'
  : trackingState.value === 'error' ? 'Seguimiento no disponible'
  : handDetected.value ? 'Mano detectada' : 'Buscando tu mano')
const modeInfo = computed(() => MODES.find((item) => item.id === mode.value))
let hold = createGestureHold()
let lastControlTime = null
let pendingDirection = null
let directionSince = null

function publishControls() {
  emit('controls', { speed: speed.value, letters: letters.value, direction: direction.value, paused: paused.value })
}

function selectMode(value) {
  mode.value = value
  lastControlTime = null
  pendingDirection = null
  directionSince = null
}

function togglePaused() {
  paused.value = !paused.value
  publishControls()
}

function processHand(points, timestamp) {
  handDetected.value = Boolean(points)
  const width = video.value.videoWidth, height = video.value.videoHeight
  aperture.value = handAperture(points, width, height)
  const gesture = commandGesture(points, width, height)
  const held = hold.update(gesture, timestamp, Boolean(points))
  gestureProgress.value = held.progress
  if (held.action === 'victory') {
    const index = MODES.findIndex((item) => item.id === mode.value)
    selectMode(MODES[(index + 1) % MODES.length].id)
  } else if (held.action === 'fist') togglePaused()

  // Los comandos tienen prioridad: cerrar el puño no modifica el zoom.
  if (gesture || held.latched || aperture.value === null) {
    lastControlTime = null
    pendingDirection = null
    directionSince = null
    message.value = !points ? 'Sin mano detectada. Se conservan los últimos valores.'
      : held.latched ? 'Acción aplicada. Soltá el gesto un momento para seguir.'
      : gesture === 'victory' ? 'Mantené la V para cambiar de modo…'
      : gesture === 'fist' ? 'Mantené el puño para pausar o reanudar…'
      : 'Mostrá la palma de frente para medirla.'
    return
  }
  const seconds = lastControlTime === null ? 0.05 : (timestamp - lastControlTime) / 1000
  lastControlTime = timestamp
  const palm = palmPosition(points)
  if (mode.value === 'zoom') {
    zoom.value = smoothZoom(zoom.value, apertureToZoom(aperture.value), seconds)
    emit('zoom', zoom.value)
  } else if (mode.value === 'speed') {
    speed.value = smoothZoom(speed.value, heightToSpeed(palm.y), seconds)
    publishControls()
  } else if (mode.value === 'letters') {
    letters.value = smoothZoom(letters.value, apertureToLetters(aperture.value), seconds)
    publishControls()
  } else {
    const next = handDirection(palm.x)
    if (next !== pendingDirection || (directionSince !== null && seconds > 0.3)) {
      pendingDirection = next
      directionSince = timestamp
    }
    if (next !== null && timestamp - directionSince >= 300 && direction.value !== next) {
      direction.value = next
      publishControls()
    }
  }
  message.value = `Mano detectada. Control de ${modeInfo.value.label.toLowerCase()} activo.`
}

const video = ref(null)
const overlay = ref(null)
const active = ref(false)
const loading = ref(false)
const message = ref('Activá la cámara y colocá una mano dentro del recuadro.')
let stream = null
let unmounted = false
let tracker = null
let frame = null
let trackingSession = 0

async function startTracking() {
  trackingState.value = 'loading'
  const session = ++trackingSession
  message.value = 'Cargando el detector de manos…'
  try {
    const { createHandTracker } = await import('../tracking/createHandTracker.js')
    if (session !== trackingSession) return
    const loadedTracker = await createHandTracker(overlay.value)
    // Si apagaste la cámara durante la carga, liberamos el detector recién creado.
    if (session !== trackingSession) {
      loadedTracker.close()
      return
    }
    tracker = loadedTracker
    trackingState.value = 'ready'
    let lastVideoTime = -1
    let lastDetection = -Infinity
    function trackHand(timestamp) {
      if (session !== trackingSession) return
      try {
        // Hasta 20 detecciones por segundo; evitamos analizar dos veces el mismo cuadro.
        if (!document.hidden && video.value.readyState >= 2
          && video.value.currentTime !== lastVideoTime && timestamp - lastDetection >= 50) {
          lastVideoTime = video.value.currentTime
          lastDetection = timestamp
          const points = tracker.detect(video.value, timestamp)
          processHand(points, timestamp)
        }
        frame = requestAnimationFrame(trackHand)
      } catch (error) {
        trackingFailed(error)
      }
    }
    frame = requestAnimationFrame(trackHand)
  } catch (error) {
    if (session === trackingSession) trackingFailed(error)
  }
}

function stopTracking() {
  handDetected.value = false
  trackingState.value = 'off'
  aperture.value = null
  gestureProgress.value = 0
  hold = createGestureHold()
  lastControlTime = null
  pendingDirection = null
  directionSince = null
  trackingSession++
  cancelAnimationFrame(frame)
  tracker?.close()
  tracker = null
}

function trackingFailed(error) {
  stopTracking()
  trackingState.value = 'error'
  message.value = 'No se pudo iniciar o continuar el seguimiento. Apagá y activá la cámara para reintentar.'
  console.warn('Seguimiento de manos:', error)
}

function stopCamera() {
  stopTracking()
  // Soltar las pistas apaga la cámara; ocultar el video no alcanza.
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (video.value) video.value.srcObject = null
  active.value = false
  message.value = 'Cámara apagada. Podés volver a activarla.'
}

async function startCamera() {
  if (loading.value || active.value) return
  if (!navigator.mediaDevices?.getUserMedia) {
    message.value = 'Abrí la práctica desde localhost o HTTPS para usar la cámara.'
    return
  }

  loading.value = true
  message.value = 'Esperando acceso a la cámara…'
  try {
    // 1. Pedir video al navegador. No necesitamos micrófono.
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    })
    // El permiso puede llegar después de que se haya cerrado el componente.
    if (unmounted) {
      cameraStream.getTracks().forEach((track) => track.stop())
      return
    }

    // 2. Conectar el flujo de la cámara al elemento <video>.
    stream = cameraStream
    video.value.srcObject = stream
    await video.value.play()
    if (unmounted) return
    active.value = true
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      stopCamera()
      message.value = 'La cámara se desconectó. Podés intentar activarla de nuevo.'
    }, { once: true })
    // 3. Analizar el video y dibujar los puntos encima.
    void startTracking()
  } catch (error) {
    if (unmounted) return
    stopCamera()
    const errors = {
      NotAllowedError: 'El acceso a la cámara está bloqueado. Revisá el permiso del sitio y reintentá.',
      NotFoundError: 'No se encontró una cámara. Conectá una y reintentá.',
      NotReadableError: 'No se pudo abrir la cámara. Revisá si otra aplicación la está usando.',
    }
    message.value = errors[error.name] ?? 'No se pudo iniciar el video. Revisá la cámara y reintentá.'
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  unmounted = true
  stopCamera()
})
</script>

<template>
  <aside class="hand-practice" aria-labelledby="practice-title">
    <header class="panel-header">
      <div>
        <div class="eyebrow"><span class="brand-dot" /> REC<span class="brand-divider">/</span> INTERACTIVE</div>
        <h1 id="practice-title">Control por gestos</h1>
      </div>
      <span class="playback-state" :class="{ paused }"><span />{{ paused ? 'En pausa' : 'En giro' }}</span>
    </header>

    <div class="camera-viewport" :style="{ aspectRatio: previewAspect }">
      <div v-show="active" class="camera-preview">
        <video ref="video" autoplay muted playsinline aria-label="Vista de tu cámara en espejo"
          @loadedmetadata="previewAspect = video.videoWidth / video.videoHeight || 4 / 3" />
        <canvas ref="overlay" class="hand-overlay" aria-hidden="true" />
      </div>
      <div v-if="!active" class="camera-placeholder">
        <span class="camera-symbol"><ControlIcon name="camera" /></span>
        <strong>{{ loading ? 'Conectando tu cámara' : 'Tu mano tiene el control' }}</strong>
        <span>{{ loading ? 'Aceptá el permiso del navegador' : 'Activá la cámara para empezar' }}</span>
      </div>
      <div class="camera-badge" :class="{ detected: handDetected }"><span />{{ cameraLabel }}</div>
      <div v-if="active" class="mirror-label">VISTA EN ESPEJO</div>
      <div class="viewfinder" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>

    <div class="section-label"><span>CONTROL ACTIVO</span><span>✌ Cambiar modo</span></div>
    <div class="modes" role="group" aria-label="Modo de control">
      <button v-for="item in MODES" :key="item.id" type="button" :aria-pressed="mode === item.id" @click="selectMode(item.id)">
        <ControlIcon :name="item.id" /><span>{{ item.label }}</span>
      </button>
    </div>
    <p class="mode-hint">{{ modeInfo.hint }}</p>

    <div class="metrics" aria-label="Valores de los controles">
      <div class="metric zoom-reading" :class="{ selected: mode === 'zoom' }"><span>Zoom</span><strong>{{ zoom.toFixed(2) }}×</strong></div>
      <div class="metric" :class="{ selected: mode === 'speed' }"><span>Velocidad</span><strong class="speed-value">{{ speed.toFixed(2) }}×</strong></div>
      <div class="metric" :class="{ selected: mode === 'direction' }"><span>Giro</span><strong class="direction-value">{{ direction === 1 ? 'Derecha' : 'Izquierda' }}</strong></div>
      <div class="metric" :class="{ selected: mode === 'letters' }"><span>Letras</span><strong class="letters-value">{{ letters.toFixed(2) }}×</strong></div>
    </div>

    <div class="gesture-feedback" :class="{ confirming: gestureProgress > 0 }">
      <div><span>{{ !active ? 'Gestos en espera' : gestureProgress >= 1 ? 'Gesto confirmado · soltá la mano' : gestureProgress > 0 ? 'Mantené el gesto…' : 'Listo para tu próximo gesto' }}</span><span>{{ Math.round(gestureProgress * 100) }}%</span></div>
      <progress aria-label="Confirmación del gesto" :value="gestureProgress" max="1" />
    </div>
    <p class="tracking-message" role="status">{{ message }}</p>

    <div class="camera-actions">
      <button class="pause-button" type="button" :aria-pressed="paused" @click="togglePaused">
        <ControlIcon :name="paused ? 'play' : 'pause'" />{{ paused ? 'Reanudar giro' : 'Pausar giro' }}
      </button>
      <button v-if="active" class="camera-button stop" type="button" @click="stopCamera"><ControlIcon name="power" />Apagar cámara</button>
      <button v-else class="camera-button" type="button" :disabled="loading" @click="startCamera">
        <ControlIcon name="camera" />{{ loading ? 'Conectando…' : 'Activar cámara' }}
      </button>
    </div>

    <details class="gesture-guide">
      <summary>Guía de gestos<ControlIcon name="chevron" /></summary>
      <div class="guide-content">
        <p><span class="gesture-symbol">✌</span><span><strong>Cambiar de modo</strong> Mantené la V durante ¾ de segundo.</span></p>
        <p><span class="gesture-symbol">✊</span><span><strong>Pausar o reanudar</strong> Cerrá el puño con el pulgar recogido durante ¾ de segundo.</span></p>
        <p class="guide-note">Soltá cada gesto antes de repetirlo. Mostrá la palma de frente, con buena luz.</p>
        <div class="legend"><span class="thumb">● Pulgar</span><span class="index">● Índice</span><span>Apertura {{ aperture === null ? '—' : aperture.toFixed(2) }}</span></div>
      </div>
    </details>
  </aside>
</template>

<style scoped>
.hand-practice {
  --accent: #ef3440;
  position: fixed;
  z-index: 2;
  right: 24px;
  bottom: 24px;
  width: min(368px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #434348 transparent;
  padding: 20px;
  border: 1px solid #ffffff1c;
  border-radius: 22px;
  background: linear-gradient(155deg, #1b1c20f5, #101114fa 65%);
  box-shadow: 0 20px 70px #0009, inset 0 1px 0 #ffffff08;
  backdrop-filter: blur(20px);
  color: #f4f4f5;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.eyebrow { display: flex; align-items: center; gap: 6px; color: #b6b6bf; font-size: 9px; font-weight: 650; letter-spacing: 1.7px; }
.brand-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px #ef344044; }
.brand-divider { color: #60616a; padding: 0 2px; }
h1 { margin: 7px 0 0; font-size: 19px; font-weight: 600; letter-spacing: -.6px; }
.playback-state { display: flex; align-items: center; gap: 6px; white-space: nowrap; color: #c8c8cf; font-size: 10px; }
.playback-state > span { width: 5px; height: 5px; border-radius: 50%; background: #b8c2b9; }
.playback-state.paused > span { background: #ffbb65; }
.camera-viewport { position: relative; isolation: isolate; overflow: hidden; border: 1px solid #ffffff12; border-radius: 13px; background: radial-gradient(ellipse at 50% 45%, #2c252a, #121316 75%); }
.camera-preview { position: absolute; inset: 0; transform: scaleX(-1); }
video { display: block; width: 100%; height: 100%; }
.hand-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.camera-placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 7px; padding: 36px 16px 16px; text-align: center; }
.camera-symbol { display: grid; place-items: center; width: 46px; height: 46px; margin-bottom: 5px; border: 1px solid #ffffff16; border-radius: 14px; background: #ffffff05; color: #dfb6ba; }
.camera-symbol svg { width: 23px; height: 23px; }
.camera-placeholder strong { font-size: 13px; font-weight: 550; }
.camera-placeholder > span:last-child { font-size: 11px; color: #a2a1ab; }
.camera-badge { position: absolute; top: 12px; left: 12px; display: flex; align-items: center; gap: 6px; border: 1px solid #ffffff16; border-radius: 6px; padding: 5px 7px; background: #131417cc; color: #d1d1d8; font-size: 9px; backdrop-filter: blur(8px); }
.camera-badge > span { width: 5px; height: 5px; background: #878792; border-radius: 50%; }
.camera-badge.detected > span { background: #8fe4ae; }
.mirror-label { position: absolute; bottom: 12px; right: 12px; padding: 4px 6px; border-radius: 4px; background: #0009; color: #e7e7ed; font-size: 8px; letter-spacing: 1px; }
.viewfinder { position: absolute; inset: 8px; pointer-events: none; }
.viewfinder i { position: absolute; width: 12px; height: 12px; border-color: #ffffff35; border-style: solid; border-width: 0; }
.viewfinder i:nth-child(1) { top: 0; left: 0; border-top-width: 1px; border-left-width: 1px; border-radius: 5px 0 0; }
.viewfinder i:nth-child(2) { top: 0; right: 0; border-top-width: 1px; border-right-width: 1px; border-radius: 0 5px 0 0; }
.viewfinder i:nth-child(3) { bottom: 0; left: 0; border-bottom-width: 1px; border-left-width: 1px; border-radius: 0 0 0 5px; }
.viewfinder i:nth-child(4) { bottom: 0; right: 0; border-bottom-width: 1px; border-right-width: 1px; border-radius: 0 0 5px; }
.section-label { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 9px; color: #a1a1ae; font-size: 9px; letter-spacing: 1.2px; font-weight: 600; }
.section-label > span:last-child { color: #c5c5cd; font-weight: 400; letter-spacing: 0; font-size: 10px; }
.modes { display: grid; grid-template-columns: repeat(4, 1fr); padding: 4px; gap: 3px; border: 1px solid #ffffff0a; border-radius: 11px; background: #090a0d88; }
button { display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid transparent; font: inherit; cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
button svg { width: 17px; height: 17px; flex-shrink: 0; }
.modes button { flex-direction: column; gap: 6px; min-width: 0; padding: 9px 2px; border-radius: 8px; background: transparent; color: #a9a9b4; font-size: 10px; }
.modes button svg { width: 19px; height: 19px; }
.modes button:hover { color: #fff; background: #ffffff08; }
.modes button[aria-pressed="true"] { border-color: #ef34404d; background: #ef344019; color: #ff7a84; }
.mode-hint { min-height: 36px; margin: 10px 2px 14px; font-size: 11px; line-height: 1.65; color: #b9b9c4; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #ffffff0d; border-bottom: 1px solid #ffffff0d; }
.metric { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 12px 0; text-align: center; }
.metric:not(:last-child)::after { content: ''; position: absolute; right: 0; top: 15px; bottom: 15px; width: 1px; background: #ffffff0c; }
.metric > span { font-size: 9px; color: #9b9baa; }
.metric strong { font-size: 15px; font-weight: 550; font-variant-numeric: tabular-nums; letter-spacing: -.4px; }
.metric .direction-value { font-size: 11px; min-height: 18px; display: grid; place-items: center; }
.metric.selected strong { color: #ff7a84; }
.gesture-feedback { margin-top: 14px; }
.gesture-feedback > div { display: flex; justify-content: space-between; font-size: 9px; color: #9b9baa; }
.gesture-feedback.confirming > div { color: #e8b5bb; }
progress { display: block; appearance: none; width: 100%; height: 3px; margin-top: 7px; overflow: hidden; border: 0; border-radius: 4px; background: #2a2a31; accent-color: var(--accent); }
progress::-webkit-progress-bar { background: #2a2a31; border-radius: 4px; }
progress::-webkit-progress-value { background: var(--accent); border-radius: 4px; }
progress::-moz-progress-bar { background: var(--accent); border-radius: 4px; }
.tracking-message { margin: 10px 0 14px; min-height: 32px; font-size: 10px; line-height: 1.6; color: #a9a9b5; }
.camera-actions { display: grid; grid-template-columns: 1fr 1.15fr; gap: 8px; }
.camera-actions button { min-height: 40px; padding: 9px 6px; border-radius: 9px; font-size: 11px; font-weight: 550; }
.pause-button { color: #dddde5; border-color: #ffffff1c; background: #ffffff05; }
.pause-button:hover { background: #ffffff0e; }
.camera-button { color: #fff; background: #d92331; box-shadow: 0 3px 12px #d923311a; }
.camera-button:hover { background: #ef3440; }
.camera-button.stop { color: #ff9ba3; background: #ef344010; border-color: #ef34403b; box-shadow: none; }
.camera-button.stop:hover { background: #ef344024; }
button:disabled { opacity: .6; cursor: wait; }
button:focus-visible, summary:focus-visible { outline: 2px solid #ff7a84; outline-offset: 3px; }
.gesture-guide { margin-top: 14px; border-top: 1px solid #ffffff0d; }
summary { display: flex; align-items: center; justify-content: space-between; padding: 13px 0 0; color: #b6b6c3; font-size: 11px; cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary svg { width: 13px; height: 13px; transition: transform .15s; }
details[open] summary svg { transform: rotate(90deg); }
.guide-content { padding-top: 8px; }
.guide-content p { display: flex; align-items: center; gap: 10px; font-size: 11px; line-height: 1.6; color: #a9a9b5; }
.guide-content strong { display: block; color: #dddde5; font-weight: 500; }
.gesture-symbol { display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0; background: #ffffff06; border-radius: 8px; font-size: 17px; }
.guide-content .guide-note { font-size: 10px; }
.legend { display: flex; gap: 12px; font-size: 9px; color: #a9a9b5; }
.thumb { color: #ffad46; }
.index { color: #5cdeff; }
@media (max-height: 820px) and (min-width: 600px) {
  .hand-practice { padding: 16px; width: 330px; right: 16px; bottom: 16px; max-height: calc(100dvh - 32px); }
  .panel-header { margin-bottom: 12px; }
  .camera-viewport { max-width: 260px; margin-inline: auto; }
  .section-label { margin-top: 12px; }
  .mode-hint { margin-bottom: 8px; }
  .metric { padding-block: 9px; }
}
@media (max-width: 599px) {
  .hand-practice { right: 16px; bottom: 16px; max-height: calc(100dvh - 32px); }
}
@media (prefers-reduced-motion: reduce) {
  button, summary svg { transition: none; }
}
</style>
