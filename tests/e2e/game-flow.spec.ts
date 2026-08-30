import { expect, test, type Page } from '@playwright/test';

const startingFive = [
  'Test Guard Alpha',
  'Test Guard Beta',
  'Test Forward Alpha',
  'Test Forward Beta',
  'Test Center Alpha',
];

async function enterMode(page: Page, mode: 'Classic' | 'Daily Challenge') {
  await page.goto('/');
  await expect(page.getByText('@PlaywrightGM')).toBeVisible();
  await page
    .getByRole('button', { name: new RegExp(mode, 'i') })
    .first()
    .click();
}

async function selectPlayer(page: Page, name: string) {
  const card = page.locator('article').filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /^Select / }).click();
}

test.describe('authenticated game flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('opens an authenticated Classic game with a deterministic player pool', async ({ page }) => {
    await enterMode(page, 'Classic');

    await expect(
      page.getByRole('heading', { name: 'Test Guard Alpha', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Test Center Alpha', exact: true }),
    ).toBeVisible();
  });

  test('selects a valid starting five and produces a team analysis', async ({ page }, testInfo) => {
    await enterMode(page, 'Classic');

    for (const name of startingFive) await selectPlayer(page, name);

    await expect(page.getByRole('button', { pressed: true })).toHaveCount(5);

    if (testInfo.project.name === 'mobile-chromium') {
      await page.getByRole('button', { name: 'Lineup' }).click();
    }

    const analyze = page.getByRole('button', { name: 'Analyze My Team' });
    await expect(analyze).toBeEnabled();
    await analyze.click();

    await expect(page.getByText('Front office report', { exact: false })).toBeVisible();
    await expect(page.getByText(/Team Analysis|Congratulations!/)).toBeVisible();
    await expect(page.getByText('Projected Record')).toBeVisible();
  });

  test('shows the server-owned Daily Challenge and leaderboard fixture', async ({ page }) => {
    await enterMode(page, 'Daily Challenge');

    await expect(page.getByText('Top lineups today')).toBeVisible();
    await expect(page.getByText('TestLeader').first()).toBeVisible();
  });

  test('saves and restores a lineup on desktop', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chromium',
      'Save/Load controls are currently desktop-only.',
    );

    await enterMode(page, 'Classic');
    await selectPlayer(page, startingFive[0]);
    await selectPlayer(page, startingFive[1]);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Lineup saved on this device.')).toBeVisible();

    const firstCard = page.locator('article').filter({ hasText: startingFive[0] });
    await firstCard.getByRole('button', { pressed: true }).click();
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);

    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(page.getByText('Saved lineup restored.')).toBeVisible();
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(2);
  });
});
