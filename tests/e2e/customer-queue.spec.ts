import { expect, test } from '@playwright/test'

const customerPassword = 'quevo-e2e-customer-password'

test('customer selects a service, joins, and recovers their active ticket', async ({ browser, page }) => {
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
})
