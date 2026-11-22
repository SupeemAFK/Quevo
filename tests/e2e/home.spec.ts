import { expect, test } from '@playwright/test'

test('landing page explains Quevo and its sample queue stays local', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).port === '8080') apiRequests.push(request.url())
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page).toHaveTitle('Quevo | A clearer queue for every visit')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Follow a walk-in ticket from joining an active service through the final step.',
  )
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A lighter wait. A clearer next step.',
    }),
  ).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Sample queue preview' })).toContainText(
    'Sample queue',
  )
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#main-content',
  )
  await expect(page.getByRole('link', { name: 'Sign in to Quevo' }).first()).toHaveAttribute(
    'href',
    '/login',
  )
  await expect(page.getByText('For customers', { exact: true })).toBeVisible()
  await expect(page.getByText('For operators', { exact: true })).toBeVisible()
  const lifecycle = page.getByRole('list', { name: 'Queue ticket lifecycle' })
  for (const status of ['Join', 'Wait', 'Called', 'In service', 'Complete or skip']) {
    await expect(lifecycle).toContainText(status)
  }

  await page.getByRole('link', { name: 'Try the queue demo' }).first().click()
  await expect(page).toHaveURL(/#queue-demo$/)
  await expect(page.locator('#queue-demo')).toBeFocused()
  const callNextButton = page.getByRole('button', { name: 'Call next' })
  await callNextButton.focus()
  await expect(callNextButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Ticket A101 is now called.')
  const markServedButton = page.getByRole('button', { name: 'Mark served' })
  await markServedButton.focus()
  await expect(markServedButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Ticket A101 is marked served.')

  expect(apiRequests).toEqual([])
})

test('mobile navigation is keyboard operable and the page fits required widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

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
  await expect(page.locator('#queue-demo')).toBeFocused()

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
  await expect(page.locator('#queue-demo button').first()).toHaveCSS('transition-duration', '0s')
  await page.getByRole('button', { name: 'Reset demo' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Call next' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Ticket A101 is now called.')
})
