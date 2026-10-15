export const MIN_ZOOM = 0.6
export const MAX_ZOOM = 1.15

export function handAperture(points, width, height) {
  if (!points || width <= 0 || height <= 0) return null
  // x e y vienen normalizados por dimensiones distintas: medimos en píxeles.
  const distance = (a, b) => Math.hypot(
    (points[a].x - points[b].x) * width,
    (points[a].y - points[b].y) * height,
  )
  const palm = distance(0, 9) // Muñeca → base del dedo medio.
  if (!Number.isFinite(palm) || palm < 1) return null
  const aperture = distance(4, 8) / palm
  return Number.isFinite(aperture) ? aperture : null
}

export function apertureToZoom(aperture) {
  // Estos umbrales son un punto de partida para nuestra práctica.
  const opening = Math.max(0, Math.min(1, (aperture - 0.15) / (1.35 - 0.15)))
  return MIN_ZOOM + opening * (MAX_ZOOM - MIN_ZOOM)
}

export function smoothZoom(current, target, seconds) {
  // Aproximación gradual; limitamos el salto después de una pausa.
  const weight = 1 - Math.exp(-Math.min(Math.max(seconds, 0), 0.1) / 0.16)
  return current + (target - current) * weight
}
