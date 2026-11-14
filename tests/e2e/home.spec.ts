import { expect, test } from '@playwright/test'

test('home page shows the API health status', async ({ page, request }) => {
  const response = await request.get('http://127.0.0.1:8080/api/v1/health')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toMatchObject({ status: 'healthy', service: 'quevo-api' })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Quevo' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('API status: healthy')
})
