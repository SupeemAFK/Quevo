import { expect, test } from '@playwright/test'

test('server-rendered landing and login content stays visible without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()

  try {
    const landing = await page.goto('/')
    expect(landing?.status()).toBe(200)
    await expect(page.locator('#hero-heading span').first()).toHaveCSS('opacity', '1')
    await expect(page.locator('#queue-demo').locator('xpath=..')).toHaveCSS('opacity', '1')
    await expect(page.locator('#workflows article').first()).toHaveCSS('opacity', '1')

    const login = await page.goto('/login')
    expect(login?.status()).toBe(200)
    await expect(page.locator('#login-welcome-heading span').first()).toHaveCSS('opacity', '1')
    await expect(page.locator('#login-heading').locator('xpath=..')).toHaveCSS('opacity', '1')
  } finally {
    await context.close()
  }
})

test('landing page explains Quevo and its sample queue stays local', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).port === '8080') apiRequests.push(request.url())
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Play sample queue' })).toBeDisabled()

  await expect(page).toHaveTitle('Quevo | A clearer queue for every visit')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Follow a walk-in ticket from joining an active service through the final step.',
  )
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Your place in line. Made clear.',
    }),
  ).toBeVisible()
  const queuePreview = page.getByRole('region', { name: 'Queue preview' })
  await expect(queuePreview).toContainText('General service')
  await expect(queuePreview.getByRole('list', { name: 'Sample tickets waiting' })).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#main-content',
  )
  await expect(page.getByRole('link', { name: 'Sign in to Quevo' }).first()).toHaveAttribute(
    'href',
    '/login',
  )
  await expect(page.getByText('For customers')).toBeVisible()
  await expect(page.getByText('For operators')).toBeVisible()
  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText('Queue management for walk-in service.')
  await expect(footer.getByRole('link', { name: 'Live sample' })).toHaveAttribute(
    'href',
    '#queue-demo',
  )
  await expect(page.getByRole('button', { name: 'Customer' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.getByRole('button', { name: 'Customer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your ticket', exact: true })).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Your ticket', exact: true }).getByText('A102'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Operator', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Use system theme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('link', { name: 'Explore the sample' }).click()
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

test('landing sample plays automatically and can be paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const pauseButton = page.getByRole('button', { name: 'Pause sample queue' })
  await expect(pauseButton).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Ticket A101 is now called.', {
    timeout: 5000,
  })
  await expect(page.getByRole('status')).toHaveText('Ticket A102 is now called.', {
    timeout: 5000,
  })
  await expect(page.getByRole('status')).toHaveText(
    'Ticket A103 is served. The sample queue is starting again.',
    { timeout: 12000 },
  )

  await pauseButton.click()
  await expect(page.getByRole('status')).toHaveText('Sample paused.')
  await page.waitForTimeout(1500)
  await expect(page.getByRole('status')).toHaveText('Sample paused.')
})

test('how it works navigates with a smooth in-page transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth')
  await page.getByRole('link', { name: 'How it works' }).first().click()
  await expect(page).toHaveURL(/#workflows$/)
  await expect(page.locator('#workflows')).toBeFocused()
  await expect(
    page.getByRole('heading', { name: 'Know your place. Know what comes next.' }),
  ).toBeVisible()
})

test('mobile navigation is keyboard operable and the page fits required widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
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
  await expect(page.getByRole('link', { name: 'How it works' }).first()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#workflows$/)
  await expect(page.locator('#workflows')).toBeFocused()

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

test('theme preference follows the system by default and persists explicit choices', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/')

  const systemTheme = page.getByRole('button', { name: 'Use system theme' })
  await expect(systemTheme).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 17, 17)')

  await page.getByRole('button', { name: 'Use light theme' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Use light theme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  await page.getByRole('button', { name: 'Use system theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Use system theme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 17, 17)')
})
