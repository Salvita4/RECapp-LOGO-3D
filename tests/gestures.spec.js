import { test, expect } from '@playwright/test'
import { handPose } from './handFixtures.js'

test.use({
  permissions: ['camera'],
  launchOptions: {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream'],
  },
})

test.beforeEach(async ({ page }) => {
  await page.route('**/src/tracking/createHandTracker.js*', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export async function createHandTracker() { return { detect() { return window.handPoints ?? null }, close() {} } }',
  }))
  await page.goto('/')
  await expect(page.locator('.fallback-logo')).toHaveCount(0)
})

async function setHand(page, points) {
  await page.evaluate(points => { window.handPoints = points }, points)
}
const reading = (page, selector) => page.locator(selector).evaluate(element => parseFloat(element.textContent))

test('modes isolate speed, direction and letter size, and pause freezes the scene', async ({ page }) => {
  test.setTimeout(45000)
  await page.getByRole('button', { name: 'Velocidad', exact: true }).click()
  await setHand(page, handPose().map(p => ({ x: p.x, y: p.y - 0.5 })))
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  await expect.poll(() => reading(page, '.speed-value')).toBeGreaterThan(2.7)
  await expect(page.locator('.zoom-reading strong')).toHaveText('1.00×')
  await setHand(page, handPose().map(p => ({ x: p.x, y: p.y + 0.1 })))
  await expect.poll(() => reading(page, '.speed-value')).toBeLessThan(0.3)

  await page.getByRole('button', { name: 'Giro', exact: true }).click()
  await setHand(page, handPose().map(p => ({ x: p.x + 0.3, y: p.y })))
  await expect(page.locator('.direction-value')).toHaveText('Izquierda')
  await setHand(page, handPose())
  await page.waitForTimeout(400)
  await expect(page.locator('.direction-value')).toHaveText('Izquierda')
  await setHand(page, handPose().map(p => ({ x: p.x - 0.3, y: p.y })))
  await expect(page.locator('.direction-value')).toHaveText('Derecha')

  await page.getByRole('button', { name: 'Pausar giro', exact: true }).click()
  const screenshot = () => page.screenshot({ clip: { x: 0, y: 0, width: 1100, height: 1000 } })
  const paused = await screenshot()
  await page.waitForTimeout(300)
  expect(paused.equals(await screenshot())).toBe(true)
  await page.getByRole('button', { name: 'Letras', exact: true }).click()
  const closed = handPose()
  closed[4] = { x: closed[8].x + 0.001, y: closed[8].y }
  await setHand(page, closed)
  await expect(page.locator('.letters-value')).toHaveText('0.65×')
  const small = await screenshot()
  const spread = handPose()
  spread[4] = { x: 0.95, y: spread[8].y }
  await setHand(page, spread)
  await expect(page.locator('.letters-value')).toHaveText('1.08×')
  expect(small.equals(await screenshot())).toBe(false)
  await expect(page.locator('.zoom-reading strong')).toHaveText('1.00×')
  await setHand(page, null)
  await expect(page.getByRole('status')).toContainText('Sin mano detectada')
  await page.getByRole('button', { name: 'Reanudar giro', exact: true }).click()
  const resumed = await screenshot()
  await page.waitForTimeout(350)
  expect(resumed.equals(await screenshot())).toBe(false)
})

test('V changes mode once and a fist pauses only after release and a full hold', async ({ page }) => {
  await setHand(page, handPose('victory'))
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  await expect(page.getByRole('button', { name: 'Velocidad', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(1000)
  await expect(page.getByRole('button', { name: 'Velocidad', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.zoom-reading strong')).toHaveText('1.00×')
  await setHand(page, handPose('fist'))
  await page.waitForTimeout(1000)
  await expect(page.getByRole('button', { name: 'Pausar giro', exact: true })).toBeVisible()
  await setHand(page, handPose())
  await page.waitForTimeout(500)
  await setHand(page, handPose('fist'))
  await expect(page.getByRole('button', { name: 'Reanudar giro', exact: true })).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(page.getByRole('button', { name: 'Reanudar giro', exact: true })).toBeVisible()
  await setHand(page, handPose())
  await page.waitForTimeout(500)
  await setHand(page, handPose('fist'))
  await expect(page.getByRole('button', { name: 'Pausar giro', exact: true })).toBeVisible()
})
