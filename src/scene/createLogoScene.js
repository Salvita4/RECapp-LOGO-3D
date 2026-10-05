import * as THREE from 'three'
import logo from '../assets/logo-contours.json'

// All dimensions originate in RECAPP.png, including the transparent stripes.
export const settings = {
  width: 18,
  depth: 0.48,
  revolutionSeconds: 30,
  screenFill: 0.85,
  frontLightIntensity: 2.9,
  floorGap: 0.4,
  reflectionOpacity: 0.24,
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

  // Mirror the actual solids across an invisible black floor. The reflection
  // follows every rotation and fades with distance below the floor plane.
  const floorY = -logo.height * scale / 2 - settings.floorGap
  const reflection = group.clone()
  const mirror = new THREE.Group()
  mirror.position.y = floorY * 2
  mirror.scale.y = -1
  mirror.add(reflection)
  scene.add(mirror)

  const reflectedMaterials = new Map()
  reflection.traverse((object) => {
    if (!object.isMesh) return
    object.material = object.material.map((source) => {
      if (reflectedMaterials.has(source)) return reflectedMaterials.get(source)
      const material = source.clone()
      material.transparent = true
      material.opacity = settings.reflectionOpacity
      material.depthWrite = false
      material.roughness = 0.85
      if (material.isMeshPhysicalMaterial) {
        material.clearcoat = 0
        material.specularIntensity = 0.05
      }
      material.onBeforeCompile = (shader) => {
        shader.uniforms.floorY = { value: floorY }
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float reflectionWorldY;')
          .replace('#include <project_vertex>', `#include <project_vertex>
            reflectionWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`)
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            varying float reflectionWorldY;
            uniform float floorY;`)
          .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
            float distanceToFloor = floorY - reflectionWorldY;
            float fade = 1.0 - smoothstep(0.0, 3.6, distanceToFloor);
            diffuseColor.a *= fade * fade;`)
      }
      material.customProgramCacheKey = () => 'floor-reflection-v1'
      reflectedMaterials.set(source, material)
      materials.push(material)
      return material
    })
  })

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
    // A restrained tilt keeps the long logo floating above the floor all turn.
    group.rotation.x = -0.025
    reflection.rotation.copy(group.rotation)
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
