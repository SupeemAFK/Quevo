import { expect, test } from '@playwright/test'

test('landing page explains Quevo and its sample queue stays local', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).port === '8080') apiRequests.push(request.url())
  })

  await page.goto('/')

  await expect(page).toHaveTitle('Quevo | Walk-in queues, easier to follow')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Quevo helps customers join an active branch service and helps operators guide each ticket through service.',
  )
  await expect(
    page.getByRole('heading', { level: 1, name: 'Walk-in queues, easier to follow.' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#main-content',
  )
  await expect(page.getByRole('link', { name: 'Sign in to Quevo' }).first()).toHaveAttribute(
    'href',
    '/login',
  )
  await expect(page.getByRole('heading', { name: 'For customers' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'For operators' })).toBeVisible()
  const lifecycle = page.getByRole('list', { name: 'Queue ticket lifecycle' })
  for (const status of ['Join', 'Wait', 'Called', 'In service', 'Complete or skip']) {
    await expect(lifecycle).toContainText(status)
  }

  await page.getByRole('link', { name: 'Try the queue demo' }).first().click()
  await expect(page).toHaveURL(/#queue-demo$/)
  await page.getByRole('button', { name: 'Call next' }).click()
  await expect(page.getByRole('status')).toHaveText('Ticket A101 is now called.')
  await page.getByRole('button', { name: 'Mark served' }).click()
  await expect(page.getByRole('status')).toHaveText('Ticket A101 is marked served.')

  expect(apiRequests).toEqual([])
})

test('mobile navigation is keyboard operable and the page fits required widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const menuButton = page.getByRole('button', { name: 'Open navigation menu' })
  await expect(menuButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Try the queue demo' }).first()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#queue-demo$/)

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const documentFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    )
    expect(documentFits, `expected no horizontal overflow at ${width}px`).toBe(true)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Call next' })).toBeVisible()
  }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await page.getByRole('button', { name: 'Call next' }).click()
  await expect(page.getByRole('status')).toHaveText('Ticket A101 is now called.')
})
