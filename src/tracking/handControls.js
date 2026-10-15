export const MODES = [
  { id: 'zoom', label: 'Zoom', hint: 'Separá pulgar e índice para acercar; juntalos para alejar.' },
  { id: 'speed', label: 'Velocidad', hint: 'Subí la mano para acelerar; bajala para frenar.' },
  { id: 'direction', label: 'Giro', hint: 'Llevá la mano al lado izquierdo o derecho del recuadro. En el centro se conserva el sentido.' },
  { id: 'letters', label: 'Letras', hint: 'Separá pulgar e índice para agrandar las letras; juntalos para achicarlas.' },
]
export const MIN_SPEED = 0.25
export const MAX_SPEED = 3
export const MIN_LETTERS = 0.65
export const MAX_LETTERS = 1.08
const clamp = (value) => Math.max(0, Math.min(1, value))
export const heightToSpeed = (y) => MIN_SPEED + clamp((0.8 - y) / 0.6) * (MAX_SPEED - MIN_SPEED)
export const apertureToLetters = (value) => MIN_LETTERS + clamp((value - 0.15) / 1.2) * (MAX_LETTERS - MIN_LETTERS)
export const palmPosition = (points) => ({ x: (points[0].x + points[9].x) / 2, y: (points[0].y + points[9].y) / 2 })
export const handDirection = (x) => x > 0.65 ? -1 : x < 0.35 ? 1 : null // Video en espejo.

// Reglas geométricas sencillas para practicar con la palma de frente.
// No son un modelo entrenado de clasificación de gestos.
export function commandGesture(points, width, height) {
  if (!points || points.length !== 21) return null
  const p = points.map(({ x, y }) => ({ x: x * width, y: y * height }))
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const palm = distance(p[0], p[9])
  if (palm < 1) return null
  const fingers = [5, 9, 13, 17].map((base) => {
    const a = p[base], joint = p[base + 1], tip = p[base + 3]
    const length = distance(a, joint) * distance(tip, joint)
    if (length < 1) return 'unknown'
    const cosine = ((a.x - joint.x) * (tip.x - joint.x) + (a.y - joint.y) * (tip.y - joint.y)) / length
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI
    if (angle > 155 && distance(tip, a) > distance(joint, a) * 1.4) return 'open'
    if (angle < 115 && distance(tip, p[0]) < distance(joint, p[0]) * 1.15) return 'closed'
    return 'unknown'
  })
  // El pulgar también debe estar recogido, para no confundir una pinza con un puño.
  if (fingers.every((finger) => finger === 'closed') && distance(p[4], p[9]) < palm * 0.9) return 'fist'
  if (fingers[0] === 'open' && fingers[1] === 'open'
    && fingers[2] === 'closed' && fingers[3] === 'closed') return 'victory'
  return null
}

// Un gesto sostenido dispara una sola acción. Hay que soltarlo para rearmar.
export function createGestureHold(holdMs = 750, releaseMs = 350) {
  let candidate = null, since = null, latched = false, neutralSince = null, previous = null
  return {
    update(gesture, timestamp, visible = true) {
      if (previous !== null && timestamp - previous > 300) {
        candidate = null; since = null; neutralSince = null
      }
      previous = timestamp
      if (!visible || !gesture) {
        candidate = null; since = null
        if (!visible) neutralSince = null
        else {
          neutralSince ??= timestamp
          if (timestamp - neutralSince >= releaseMs) latched = false
        }
        return { action: null, progress: 0, latched }
      }
      neutralSince = null
      if (latched) return { action: null, progress: 1, latched }
      if (candidate !== gesture) { candidate = gesture; since = timestamp }
      const progress = clamp((timestamp - since) / holdMs)
      if (progress === 1) {
        latched = true
        return { action: gesture, progress, latched }
      }
      return { action: null, progress, latched }
    },
  }
}
