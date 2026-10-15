import { test, expect } from '@playwright/test'
import { handAperture, apertureToZoom, smoothZoom, MIN_ZOOM, MAX_ZOOM } from '../src/tracking/handZoom.js'

test('aperture stays proportional across hand sizes and image aspect ratios', () => {
  function hand(width, height, scale) {
    const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[9] = { x: 0.5, y: 0.5 - 100 * scale / height }
    points[8] = { x: 0.5 + 60 * scale / width, y: 0.5 }
    return points
  }
  for (const [width, height, scale] of [[640, 480, 1], [1280, 720, 2], [480, 640, 0.5]]) {
    expect(handAperture(hand(width, height, scale), width, height)).toBeCloseTo(0.6)
  }
  expect(handAperture(null, 640, 480)).toBeNull()
  expect(handAperture(Array.from({ length: 21 }, () => ({ x: 0, y: 0 })), 640, 480)).toBeNull()
})

test('zoom is bounded and smoothing avoids overshoot even after a long pause', () => {
  expect(apertureToZoom(0)).toBe(MIN_ZOOM)
  expect(apertureToZoom(20)).toBe(MAX_ZOOM)
  expect(apertureToZoom(0.8)).toBeGreaterThan(apertureToZoom(0.4))
  const next = smoothZoom(1, MIN_ZOOM, 0.05)
  expect(next).toBeGreaterThan(MIN_ZOOM)
  expect(next).toBeLessThan(1)
  expect(smoothZoom(1, MIN_ZOOM, 20)).toBe(smoothZoom(1, MIN_ZOOM, 0.1))
})
