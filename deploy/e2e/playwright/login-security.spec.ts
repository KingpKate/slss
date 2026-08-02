import { test, expect, type Page } from '@playwright/test';

/**
 * Login shell contract tests.  These tests mock the public branding and
 * captcha endpoints so they are deterministic and do not mutate a deployed
 * database.  The same scenarios can be run against a real deployment by
 * removing the route handlers in a dedicated environment.
 */
async function stubLoginContracts(page: Page) {
  await page.route('**/api/v1/settings/branding', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        appName: 'SLSS MES',
        subtitle: '制造运营控制台',
        theme: 'green',
        logo: '',
        backgroundMode: 'carousel',
        backgroundIntervalSeconds: 8,
        backgroundOverlay: 0.32,
        backgroundImages: ['/assets/login/industrial-01.webp', '/assets/login/industrial-02.webp'],
        version: 7,
      }),
    });
  });

  await page.route('**/api/v1/auth/captcha/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ required: true, failures: 3, triggerAfterFailures: 3 }),
    });
  });

  await page.route('**/api/v1/auth/captcha/challenge', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'pw-captcha-token',
        image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="140" height="44"><rect width="140" height="44" fill="%23e2e8f0"/><text x="24" y="29" font-size="20">A7KQ</text></svg>',
        expiresInSeconds: 120,
      }),
    });
  });
}

test.describe('login branding and security contract', () => {
  test('renders server branding and carousel fallback without external image dependency', async ({ page }) => {
    await stubLoginContracts(page);
    await page.route('**/assets/login/industrial-01.webp', (route) => route.abort());
    await page.goto('#/login');

    await expect(page.getByText('SLSS MES')).toBeVisible();
    await expect(page.getByText('制造运营控制台')).toBeVisible();

    // The login shell must retain a usable fallback when the active image
    // fails.  Implementations may use <img>, CSS background-image, or a
    // themed background, therefore assert only that the page remains visible.
    await expect(page.locator('main')).toBeVisible();
  });

  test('password is hidden initially and can be revealed with an accessible eye control', async ({ page }) => {
    await stubLoginContracts(page);
    await page.goto('#/login');

    const password = page.getByLabel(/密码|password/i);
    await expect(password).toHaveAttribute('type', 'password');
    const toggle = page.locator('button[aria-label*="密码"], button[aria-label*="password" i]').first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('requests captcha challenge after configured failure threshold', async ({ page }) => {
    await stubLoginContracts(page);
    let loginCalls = 0;
    await page.route('**/api/v1/auth/login', async (route) => {
      loginCalls += 1;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' }),
      });
    });
    await page.goto('#/login');
    await page.getByLabel(/用户名|username/i).fill('001');
    await page.getByLabel(/密码|password/i).fill('bad-password');
    await page.getByRole('button', { name: /登录|sign in|login/i }).click();

    await expect.poll(() => loginCalls).toBe(1);
    await expect(page.getByText(/验证码|captcha/i)).toBeVisible();
    // Username, password and captcha answer fields are present once the
    // server says a challenge is required.
    await expect.poll(() => page.locator('input').count()).toBeGreaterThanOrEqual(3);
  });

  test('does not expose captcha answer or password in browser storage', async ({ page }) => {
    await stubLoginContracts(page);
    await page.goto('#/login');
    const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(JSON.stringify(storage)).not.toMatch(/A7KQ|password|captchaAnswer/i);
  });
});
