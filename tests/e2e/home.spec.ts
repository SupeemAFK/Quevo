import { expect, test } from '@playwright/test'

test('home page shows the API health status', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Quevo' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('API status: healthy')
})
