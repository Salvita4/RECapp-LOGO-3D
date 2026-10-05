import * as THREE from 'three'
import logo from '../assets/logo-contours.json'

// All dimensions originate in RECAPP.png, including the transparent stripes.
export const settings = {
  width: 18,
  depth: 0.48,
  revolutionSeconds: 30,
  screenFill: 0.92,
  frontLightIntensity: 2.5,
}

export function createLogoScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setClearColor(0x000000, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Preserve saturated brand colors instead of applying a filmic tone curve.
  renderer.toneMapping = THREE.NoToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 150)
  const group = new THREE.Group()
  scene.add(group)
  const scale = settings.width / logo.width
  const geometries = []
  const materials = []

  for (const layer of logo.layers) {
    const face = new THREE.MeshPhysicalMaterial({
      color: layer.color,
      metalness: 0.12,
      roughness: 0.38,
      specularIntensity: 0.18,
      clearcoat: 0.1,
      clearcoatRoughness: 0.3,
    })
    const edge = new THREE.MeshStandardMaterial({
      color: layer.color,
      metalness: 0.35,
      roughness: 0.26,
    })
    materials.push(face, edge)

    const shapes = layer.contours.map(({ points }) => {
      const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(
        (x - logo.width / 2) * scale,
        (logo.height / 2 - y) * scale,
      )))
      shape.closePath()
      return shape
    })
    // Each stripe is a separate closed solid; only two meshes are needed.
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: settings.depth,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: scale * 0.55,
      bevelSize: scale * 0.55,
      bevelSegments: 2,
      curveSegments: 32,
    })
    geometry.translate(0, 0, -settings.depth / 2)
    geometries.push(geometry)
    group.add(new THREE.Mesh(geometry, [face, edge]))
  }

  // Fixed studio lights let the rotating faces and edges catch the light.
  const frontLight = new THREE.DirectionalLight(0xffffff, settings.frontLightIntensity)
  frontLight.position.set(-2, 3, 14)
  scene.add(frontLight)
  const sideLight = new THREE.DirectionalLight(0xffffff, 1.6)
  sideLight.position.set(12, 2, 4)
  scene.add(sideLight)
  const backLight = new THREE.DirectionalLight(0xffffff, 2)
  backLight.position.set(-5, 4, -10)
  scene.add(backLight, new THREE.AmbientLight(0xffffff, 0.6))

  function resize() {
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const tanFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const horizontalDistance = settings.width / (2 * tanFov * camera.aspect * settings.screenFill)
    const verticalDistance = (logo.height * scale + 1.8) / (2 * tanFov * 0.88)
    camera.position.set(0, 0, Math.max(horizontalDistance, verticalDistance) + settings.depth)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let elapsed = 0
  let previousTime = null
  function render(time) {
    if (previousTime !== null && !reducedMotion.matches) {
      elapsed += Math.min((time - previousTime) / 1000, 0.05)
    }
    previousTime = time
    const phase = elapsed * Math.PI * 2 / settings.revolutionSeconds
    // Linger near readable positions, glide faster through the profile.
    group.rotation.y = phase - 0.32 * Math.sin(2 * phase) - 0.1
    group.rotation.x = -0.045 + Math.sin(phase) * 0.075
    renderer.render(scene, camera)
  }

  function updatePlayback() {
    previousTime = null
    renderer.setAnimationLoop(document.hidden || reducedMotion.matches ? null : render)
    if (!document.hidden) render(performance.now())
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  document.addEventListener('visibilitychange', updatePlayback)
  reducedMotion.addEventListener('change', updatePlayback)
  resize()
  updatePlayback()

  return () => {
    renderer.setAnimationLoop(null)
    observer.disconnect()
    document.removeEventListener('visibilitychange', updatePlayback)
    reducedMotion.removeEventListener('change', updatePlayback)
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    renderer.dispose()
  }
}
