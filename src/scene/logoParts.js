// Límites de las seis letras en el PNG original. El punto y las esquinas
// quedan fuera: cada letra crece alrededor de su propio centro.
export const LETTERS = [
  [73, 65, 333, 429], [370, 65, 630, 429], [667, 65, 927, 429],
  [1131, 113, 1430, 392], [1478, 113, 1756, 421], [1804, 113, 2082, 421],
].map(([left, top, right, bottom], index) => ({
  id: `letter-${index}`, left, top, right, bottom,
  x: (left + right) / 2, y: (top + bottom) / 2,
}))

export function contourLetter(points) {
  return LETTERS.find(({ left, top, right, bottom }) =>
    points.every(([x, y]) => x >= left && x <= right && y >= top && y <= bottom))
}

export function partitionLayer(layer) {
  const parts = new Map()
  for (const contour of layer.contours) {
    const letter = contourLetter(contour.points)
    const key = letter?.id ?? 'fixed'
    if (!parts.has(key)) parts.set(key, { letter, contours: [] })
    parts.get(key).contours.push(contour)
  }
  return [...parts.values()]
}
