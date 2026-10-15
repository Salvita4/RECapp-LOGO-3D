import { test, expect } from '@playwright/test'

test.use({
  permissions: ['camera'],
  launchOptions: {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream'],
  },
})

test('starts on request, plays video, and releases the camera when stopped', async ({ page }) => {
  await page.goto('/')
  const video = page.locator('video')
  await expect(video).toHaveJSProperty('srcObject', null)
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  await expect(video).toBeVisible()
  await expect.poll(() => video.evaluate((element) => element.videoWidth)).toBeGreaterThan(0)
  await video.evaluate((element) => {
    window.practiceTrack = element.srcObject.getVideoTracks()[0]
  })
  await page.getByRole('button', { name: 'Apagar cámara' }).click()
  expect(await page.evaluate(() => window.practiceTrack.readyState)).toBe('ended')
  await expect(video).toHaveJSProperty('srcObject', null)
  await expect(video).toBeHidden()
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  await expect(page.getByRole('button', { name: 'Apagar cámara' })).toBeVisible()
})

test('explains denied camera permission and allows retry', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permission denied', 'NotAllowedError')
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  await expect(page.getByRole('status')).toContainText('El acceso a la cámara está bloqueado')
  await expect(page.getByRole('button', { name: 'Activar cámara' })).toBeEnabled()
})

test('loads the real model and processes video without a hand', async ({ page }) => {
  test.setTimeout(60000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  await expect(page.getByRole('status')).toContainText('Sin mano detectada', { timeout: 45000 })
  const overlay = page.locator('.hand-overlay')
  const dimensions = await page.locator('video').evaluate((video) => ({ width: video.videoWidth, height: video.videoHeight }))
  await expect(overlay).toHaveJSProperty('width', dimensions.width)
  await expect(overlay).toHaveJSProperty('height', dimensions.height)
  await page.getByRole('button', { name: 'Apagar cámara' }).click()
  await expect(page.getByRole('status')).toContainText('Cámara apagada')
  expect(errors).toEqual([])
})

test('keeps the camera usable when the hand model cannot load', async ({ page }) => {
  await page.route('**/models/hand_landmarker.task', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  await expect(page.getByRole('status')).toContainText('No se pudo iniciar o continuar el seguimiento', { timeout: 20000 })
  await expect(page.locator('video')).toBeVisible()
  await page.getByRole('button', { name: 'Apagar cámara' }).click()
  await expect(page.getByRole('button', { name: 'Activar cámara' })).toBeEnabled()
})

test('finger aperture changes the rendered logo and holds zoom when tracking stops', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Simulamos solamente los puntos; el cálculo, Vue y la escena 3D son reales.
  await page.route('**/src/tracking/createHandTracker.js*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'export async function createHandTracker() { return { detect() { return window.handPoints ?? null }, close() {} } }',
  }))
  await page.goto('/')
  await expect(page.locator('.fallback-logo')).toHaveCount(0)
  const logo = page.locator('.logo-stage > canvas')
  // El panel se superpone al canvas y contiene video en movimiento.
  const screenshot = () => logo.screenshot({ mask: [page.locator('.hand-practice')] })
  const initial = await screenshot()
  await page.evaluate(() => {
    window.handPoints = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    window.handPoints[9] = { x: 0.5, y: 0.2 }
    window.handPoints[8] = { x: 0.51, y: 0.5 }
  })
  await page.getByRole('button', { name: 'Activar cámara' }).click()
  const reading = page.locator('.zoom-reading strong')
  await expect(reading).toHaveText('0.60×')
  expect(initial.equals(await screenshot())).toBe(false)
  await page.evaluate(() => { window.handPoints[8].x = 0.95 })
  await expect(reading).toHaveText('1.15×')
  await page.evaluate(() => { window.handPoints = null })
  await expect(page.getByRole('status')).toContainText('Sin mano detectada')
  const held = await screenshot()
  await page.waitForTimeout(250)
  expect(held.equals(await screenshot())).toBe(true)
  await page.setViewportSize({ width: 1366, height: 768 })
  await expect(reading).toHaveText('1.15×')
  await page.getByRole('button', { name: 'Apagar cámara' }).click()
  await expect(reading).toHaveText('1.15×')
})
