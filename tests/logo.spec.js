import { test, expect } from '@playwright/test'

test('renders actual WebGL, rotates, and fills desktop monitors without overflow', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.fallback-logo')).toHaveCount(0)
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  const firstFrame = await canvas.screenshot()
  await page.waitForTimeout(1600)
  const nextFrame = await canvas.screenshot({ path: 'test-results/desktop.png' })
  expect(firstFrame.equals(nextFrame)).toBe(false)
  for (const viewport of [{ width: 1366, height: 768 }, { width: 2560, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await expect(canvas).toHaveJSProperty('width', viewport.width)
    expect(await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }))).toEqual(viewport)
  }
  expect(errors).toEqual([])
})

test('keeps the 3D logo still when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.fallback-logo')).toHaveCount(0)
  const canvas = page.locator('canvas')
  const firstFrame = await canvas.screenshot({ path: 'test-results/front.png' })
  await page.waitForTimeout(300)
  expect(firstFrame.equals(await canvas.screenshot())).toBe(true)
})

test('shows the complete red and white logo when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith('webgl')) return null
      return getContext.call(this, type, ...args)
    }
  })
  await page.goto('/')
  await expect(page.locator('.fallback-logo')).toBeVisible()
  await expect(page.locator('.fallback-logo path')).toHaveCount(2)
  await expect(page.locator('.fallback-logo path').first()).toHaveAttribute('fill', '#D50006')
})
