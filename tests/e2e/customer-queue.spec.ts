import { expect, test, type Locator, type Page } from '@playwright/test'

const customerPassword = process.env.QUEVO_E2E_CUSTOMER_PASSWORD!

async function activateWithKeyboard(page: Page, target: Locator, key = 'Enter') {
  await target.focus()
  await page.keyboard.press(key)
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true)
}

async function expectMinimumTouchTarget(target: Locator) {
  const height = await target.evaluate((element) => element.getBoundingClientRect().height)
  expect(height).toBeGreaterThanOrEqual(44)
}

test('customer joins and recovers a ticket; operator serves and skips tickets', async ({ browser, page }) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('customer@quevo.local')
  await page.getByLabel('Password').fill(customerPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await activateWithKeyboard(
    page,
    page.getByRole('button', { name: 'Open navigation menu' }),
  )
  const openCustomerQueue = page.getByRole('link', { name: 'Open customer queue' })
  await expect(openCustomerQueue).toBeVisible()
  await activateWithKeyboard(page, openCustomerQueue)
  await expect(page.getByRole('heading', { name: 'Join a queue' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Join a queue' })).toBeFocused()
  await expectNoHorizontalOverflow(page)

  const secondDevice = await browser.newPage()
  await secondDevice.goto('/login')
  await secondDevice.waitForLoadState('networkidle')
  await secondDevice.getByLabel('Email').fill('customer@quevo.local')
  await secondDevice.getByLabel('Password').fill(customerPassword)
  await secondDevice.getByRole('button', { name: 'Sign in' }).click()
  await expect(secondDevice.getByRole('link', { name: 'Open customer queue' })).toBeVisible()
  await secondDevice.goto('/customer')
  await secondDevice.getByRole('button', { name: 'General Service at Quevo Demo Branch' }).click()
  await secondDevice.getByRole('button', { name: 'Join queue' }).click()
  await expect(secondDevice.getByRole('heading', { name: 'Your ticket' })).toBeVisible()
  await expect(secondDevice.getByTestId('ticket-number')).toHaveText('1')
  await expect(secondDevice.getByText('Waiting', { exact: true })).toBeVisible()
  await secondDevice.reload()
  await expect(secondDevice.getByTestId('ticket-number')).toHaveText('1')
  await expect(secondDevice.getByText('Waiting', { exact: true })).toBeVisible()
  await secondDevice.getByRole('button', { name: 'Refresh status' }).click()
  await expect(secondDevice.getByRole('status')).toHaveText('Ticket status updated.')
  await secondDevice.getByRole('navigation', { name: 'Application' }).getByRole('link', {
    name: 'Customer queue',
  }).click()
  await expect(secondDevice.getByRole('heading', { name: 'Join a queue' })).toBeVisible()

  await secondDevice.goto('/customer')
  const activeTicketLink = secondDevice.getByRole('link', {
    name: /View ticket 1 \(General Service at Quevo Demo Branch\)/,
  })
  await expect(activeTicketLink).toBeVisible()
  await activeTicketLink.click()
  await expect(secondDevice.getByTestId('ticket-number')).toHaveText('1')
  await secondDevice.close()

  await activateWithKeyboard(
    page,
    page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }),
    'Space',
  )
  await expectMinimumTouchTarget(
    page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }),
  )
  await expect(
    page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await activateWithKeyboard(page, page.getByRole('button', { name: 'Join queue' }))
  await expectMinimumTouchTarget(page.getByRole('button', { name: 'Join queue' }))
  await expect(page.getByRole('alert')).toHaveText(
    'You already have an active ticket for this service today.',
  )
  const recoveredTicketLink = page.getByRole('link', {
    name: /View ticket 1 \(General Service at Quevo Demo Branch\)/,
  })
  await expect(recoveredTicketLink).toBeVisible()
  await activateWithKeyboard(page, recoveredTicketLink)
  await expect(page.getByTestId('ticket-number')).toHaveText('1')
  await expect(page.getByRole('heading', { name: 'Your ticket' })).toBeFocused()
  await expectNoHorizontalOverflow(page)
  await expectMinimumTouchTarget(page.getByRole('button', { name: 'Refresh status' }))
  await activateWithKeyboard(page, page.getByRole('button', { name: 'Refresh status' }))
  await expect(page.getByRole('status')).toHaveText('Ticket status updated.')

  const operator = await browser.newPage({ viewport: { width: 320, height: 780 } })
  await operator.goto('/login')
  await operator.waitForLoadState('networkidle')
  await operator.getByLabel('Email').fill('operator@quevo.local')
  await operator.getByLabel('Password').fill(process.env.QUEVO_E2E_OPERATOR_PASSWORD!)
  await operator.getByRole('button', { name: 'Sign in' }).click()
  await activateWithKeyboard(
    operator,
    operator.getByRole('button', { name: 'Open navigation menu' }),
  )
  const openOperatorQueue = operator.getByRole('link', { name: 'Open operator queue' })
  await expect(openOperatorQueue).toBeVisible()
  await activateWithKeyboard(operator, openOperatorQueue)
  await expect(operator.getByRole('navigation', { name: 'Application' })).toBeVisible()
  await expect(operator.getByRole('link', { name: 'Operator queue' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(operator.getByRole('heading', { name: 'Operator queue' })).toBeVisible()
  await expect(operator.getByRole('heading', { name: 'Operator queue' })).toBeFocused()
  await expectNoHorizontalOverflow(operator)
  await expectMinimumTouchTarget(operator.getByRole('button', { name: 'Refresh queue' }))
  const selectedQueue = operator
    .getByRole('navigation', { name: 'Assigned queues' })
    .getByRole('button')
  await expect(selectedQueue).toHaveAttribute('aria-pressed', 'true')
  await expect(selectedQueue).toContainText('Quevo Demo Branch')
  await expect(operator.getByText('1 ticket', { exact: true })).toBeVisible()
  await expect(operator.getByText('Ticket 1', { exact: true })).toBeVisible()
  await activateWithKeyboard(operator, selectedQueue)
  await expectMinimumTouchTarget(operator.getByRole('button', { name: 'Call next' }))
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Call next' }))
  await expect(operator.getByTestId('operator-current-ticket')).toHaveText('1')
  await expect(operator.getByRole('status')).toHaveText('Ticket 1 called.')
  await expect(operator.getByRole('button', { name: 'Start service' })).toBeFocused()
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Start service' }))
  await expect(operator.getByText('In service', { exact: true })).toBeVisible()
  await expect(operator.getByRole('status')).toHaveText('Service started.')
  await expect(operator.getByRole('button', { name: 'Complete service' })).toBeFocused()
  await activateWithKeyboard(
    operator,
    operator.getByRole('button', { name: 'Complete service' }),
  )
  await expect(operator.getByText('Service completed.')).toBeVisible()
  await expect(operator.getByText('You have no current ticket.')).toBeVisible()
  await expect(operator.getByText('You have no current ticket.')).toBeFocused()

  await activateWithKeyboard(
    page,
    page.getByRole('navigation', { name: 'Application' }).getByRole('link', {
      name: 'Customer queue',
    }),
  )
  await activateWithKeyboard(
    page,
    page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }),
    'Space',
  )
  await activateWithKeyboard(page, page.getByRole('button', { name: 'Join queue' }))
  await expect(page.getByTestId('ticket-number')).toHaveText('2')
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Refresh queue' }))
  await expect(operator.getByText('Ticket 2', { exact: true })).toBeVisible()
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Call next' }))
  await expect(operator.getByTestId('operator-current-ticket')).toHaveText('2')
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Skip ticket' }))
  await expect(operator.getByText('Ticket skipped.')).toBeVisible()
  await expect(operator.getByText('You have no current ticket.')).toBeFocused()

  await operator.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await operator.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  ).toBe(true)
  await activateWithKeyboard(
    page,
    page.getByRole('navigation', { name: 'Application' }).getByRole('link', {
      name: 'Customer queue',
    }),
  )
  await activateWithKeyboard(
    page,
    page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }),
    'Space',
  )
  await activateWithKeyboard(page, page.getByRole('button', { name: 'Join queue' }))
  await expect(page.getByTestId('ticket-number')).toHaveText('3')
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Refresh queue' }))
  await expect(operator.getByText('Ticket 3', { exact: true })).toBeVisible()
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Call next' }))
  await expect(operator.getByTestId('operator-current-ticket')).toHaveText('3')
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Start service' }))
  await expect(operator.getByText('In service', { exact: true })).toBeVisible()
  await activateWithKeyboard(
    operator,
    operator.getByRole('button', { name: 'Complete service' }),
  )
  await expect(operator.getByText('Service completed.')).toBeVisible()

  await activateWithKeyboard(
    page,
    page.getByRole('navigation', { name: 'Application' }).getByRole('link', {
      name: 'Customer queue',
    }),
  )
  await activateWithKeyboard(
    page,
    page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }),
    'Space',
  )
  await activateWithKeyboard(page, page.getByRole('button', { name: 'Join queue' }))
  await expect(page.getByTestId('ticket-number')).toHaveText('4')
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Refresh queue' }))
  await expect(operator.getByText('Ticket 4', { exact: true })).toBeVisible()
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Call next' }))
  await expect(operator.getByTestId('operator-current-ticket')).toHaveText('4')
  await activateWithKeyboard(operator, operator.getByRole('button', { name: 'Skip ticket' }))
  await expect(operator.getByText('Ticket skipped.')).toBeVisible()
  await expect(operator.getByText('You have no current ticket.')).toBeFocused()
  await operator.close()
})
