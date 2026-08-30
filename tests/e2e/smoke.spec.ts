import { expect, test } from '@playwright/test';

test.describe('signed-out smoke tests', () => {
  test('loads the NBA Stat Auction sign-in screen', async ({ page }) => {
    await page.goto('/?e2eSignedOut=1');

    await expect(page.getByText('NBA Stat Auction', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to play' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('explains why sign-in is required', async ({ page }) => {
    await page.goto('/?e2eSignedOut=1');

    await expect(
      page.getByText(/Use Google to save records, compete in the Daily Challenge/i),
    ).toBeVisible();
  });

  test('does not expose the authenticated game interface while signed out', async ({ page }) => {
    await page.goto('/?e2eSignedOut=1');

    await expect(page.getByText('Draft Your Five')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Analyze My Team/i })).toHaveCount(0);
  });
});
