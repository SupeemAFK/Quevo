import { expect, test } from '@playwright/test'

const customerPassword = process.env.QUEVO_E2E_CUSTOMER_PASSWORD!

test('customer joins and recovers a ticket; operator serves and skips tickets', async ({ browser, page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('customer@quevo.local')
  await page.getByLabel('Password').fill(customerPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Signed in as Demo Customer')).toBeVisible()
  await page.goto('/customer')
  await expect(page.getByRole('heading', { name: 'Join a queue' })).toBeVisible()

  const secondDevice = await browser.newPage()
  await secondDevice.goto('/login')
  await secondDevice.waitForLoadState('networkidle')
  await secondDevice.getByLabel('Email').fill('customer@quevo.local')
  await secondDevice.getByLabel('Password').fill(customerPassword)
  await secondDevice.getByRole('button', { name: 'Sign in' }).click()
  await expect(secondDevice.getByText('Signed in as Demo Customer')).toBeVisible()
  await secondDevice.goto('/customer')
  await secondDevice.getByRole('button', { name: 'General Service at Quevo Demo Branch' }).click()
  await secondDevice.getByRole('button', { name: 'Join queue' }).click()
  await expect(secondDevice.getByRole('heading', { name: 'Your ticket' })).toBeVisible()
  await expect(secondDevice.getByTestId('ticket-number')).toHaveText('1')
  await expect(secondDevice.getByRole('status')).toHaveText('WAITING')
  await secondDevice.reload()
  await expect(secondDevice.getByTestId('ticket-number')).toHaveText('1')
  await expect(secondDevice.getByRole('status')).toHaveText('WAITING')

  await secondDevice.goto('/customer')
  const activeTicketLink = secondDevice.getByRole('link', {
    name: 'View ticket 1 (General Service at Quevo Demo Branch)',
  })
  await expect(activeTicketLink).toBeVisible()
  await activeTicketLink.click()
  await expect(secondDevice.getByTestId('ticket-number')).toHaveText('1')
  await secondDevice.close()

  await page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }).click()
  await page.getByRole('button', { name: 'Join queue' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'You already have an active ticket for this service today.',
  )
  const recoveredTicketLink = page.getByRole('link', {
    name: 'View ticket 1 (General Service at Quevo Demo Branch)',
  })
  await expect(recoveredTicketLink).toBeVisible()
  await recoveredTicketLink.click()
  await expect(page.getByTestId('ticket-number')).toHaveText('1')

  const operator = await browser.newPage()
  await operator.goto('/login')
  await operator.waitForLoadState('networkidle')
  await operator.getByLabel('Email').fill('operator@quevo.local')
  await operator.getByLabel('Password').fill(process.env.QUEVO_E2E_OPERATOR_PASSWORD!)
  await operator.getByRole('button', { name: 'Sign in' }).click()
  await expect(operator.getByText('Signed in as Demo Operator')).toBeVisible()
  await operator.getByRole('link', { name: 'Open operator queue' }).click()
  await expect(operator.getByRole('heading', { name: 'Operator queue' })).toBeVisible()
  await expect(operator.getByText('Ticket 1', { exact: true })).toBeVisible()
  await operator.getByRole('button', { name: 'Call next' }).click()
  await expect(operator.getByTestId('operator-current-ticket')).toHaveText('1')
  await operator.getByRole('button', { name: 'Start service' }).click()
  await expect(operator.getByText('In service', { exact: true })).toBeVisible()
  await operator.getByRole('button', { name: 'Complete service' }).click()
  await expect(operator.getByText('Service completed.')).toBeVisible()
  await expect(operator.getByText('You have no current ticket.')).toBeVisible()

  await page.goto('/customer')
  await page.getByRole('button', { name: 'General Service at Quevo Demo Branch' }).click()
  await page.getByRole('button', { name: 'Join queue' }).click()
  await expect(page.getByTestId('ticket-number')).toHaveText('2')
  await operator.getByRole('button', { name: 'Refresh queue' }).click()
  await expect(operator.getByText('Ticket 2', { exact: true })).toBeVisible()
  await operator.getByRole('button', { name: 'Call next' }).click()
  await expect(operator.getByTestId('operator-current-ticket')).toHaveText('2')
  await operator.getByRole('button', { name: 'Skip ticket' }).click()
  await expect(operator.getByText('Ticket skipped.')).toBeVisible()
  await operator.close()
})
