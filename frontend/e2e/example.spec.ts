import { test, expect } from '@playwright/test';

test('homepage loads and shows title', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Video Downloader');
});

test('platform page loads for youtube', async ({ page }) => {
  await page.goto('/youtube');
  await expect(page.locator('h1')).toContainText('YouTube Downloader');
});

test('404 page for unknown platform', async ({ page }) => {
  const response = await page.goto('/unknownplatform');
  await expect(page.locator('h1')).toContainText('404');
});
