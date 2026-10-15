export function handPose(pose = 'open') {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }))
  points[0] = { x: 0.5, y: 0.85 }
  points[1] = { x: 0.4, y: 0.75 }
  points[2] = { x: 0.32, y: 0.65 }
  points[3] = { x: 0.26, y: 0.55 }
  points[4] = { x: 0.2, y: 0.45 }
  if (pose === 'fist') points[4] = { x: 0.53, y: 0.66 }
  for (const [finger, base] of [5, 9, 13, 17].entries()) {
    const x = 0.4 + finger * 0.1, y = finger === 1 ? 0.58 : 0.6
    const open = pose === 'open' || (pose === 'victory' && finger < 2)
    points[base] = { x, y }
    points[base + 1] = { x, y: y - (open ? 0.15 : 0.09) }
    points[base + 2] = { x: x + (open ? 0 : 0.02), y: y - (open ? 0.25 : 0.04) }
    points[base + 3] = { x: x + (open ? 0 : 0.015), y: y + (open ? -0.35 : 0.06) }
  }
  return points
}
