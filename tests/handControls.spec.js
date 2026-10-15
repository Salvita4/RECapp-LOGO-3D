import { test, expect } from '@playwright/test'
import { commandGesture, createGestureHold, heightToSpeed, handDirection, apertureToLetters } from '../src/tracking/handControls.js'
import { contourLetter, partitionLayer } from '../src/scene/logoParts.js'
import { readFileSync } from 'node:fs'
import { handPose } from './handFixtures.js'

test('command poses tolerate translation, scale and hand mirroring', () => {
  for (const pose of ['open', 'victory', 'fist']) {
    const points = handPose(pose)
    for (const transform of [p => p, p => ({ x: 1 - p.x, y: p.y }), p => ({ x: p.x * 0.6 + 0.1, y: p.y * 0.6 + 0.1 })]) {
      expect(commandGesture(points.map(transform), 640, 480)).toBe(pose === 'open' ? null : pose)
    }
  }
})

test('held commands fire once and tracking loss cannot rearm them', () => {
  const hold = createGestureHold()
  const actions = []
  for (let t = 0; t < 2500; t += 50) {
    const action = hold.update('victory', t).action
    if (action) actions.push(action)
  }
  expect(actions).toEqual(['victory'])
  hold.update(null, 2500, false)
  expect(hold.update('fist', 2550).action).toBeNull()
  for (let t = 2600; t <= 3000; t += 50) hold.update(null, t)
  for (let t = 3050; t < 3800; t += 50) expect(hold.update('fist', t).action).toBeNull()
  expect(hold.update('fist', 3800).action).toBe('fist')
})

test('curled fingers with an extended thumb do not trigger pause', () => {
  const points = handPose('fist')
  points[4] = { x: 0.2, y: 0.25 }
  expect(commandGesture(points, 640, 480)).toBeNull()
})

test('an interrupted hold does not execute a command on return', () => {
  const hold = createGestureHold()
  for (let t = 0; t <= 650; t += 50) hold.update('fist', t)
  expect(hold.update('fist', 2000).progress).toBe(0)
  expect(hold.update('fist', 2050).action).toBeNull()
})

test('control ranges and mirrored direction have a neutral center', () => {
  expect(heightToSpeed(-1)).toBe(3)
  expect(heightToSpeed(2)).toBe(0.25)
  expect(handDirection(0.8)).toBe(-1)
  expect(handDirection(0.2)).toBe(1)
  expect(handDirection(0.5)).toBeNull()
  expect(apertureToLetters(0)).toBe(0.65)
  expect(apertureToLetters(10)).toBe(1.08)
})

test('all six letters are separate from the red dot and white corners', () => {
  const logo = JSON.parse(readFileSync(new URL('../src/assets/logo-contours.json', import.meta.url)))
  const parts = logo.layers.flatMap(partitionLayer)
  expect(parts.filter(part => part.letter)).toHaveLength(6)
  expect(parts.filter(part => !part.letter).flatMap(part => part.contours)).toHaveLength(5)
  expect(contourLetter(logo.layers[0].contours[48].points)).toBeUndefined()
})
