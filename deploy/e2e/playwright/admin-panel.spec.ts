import { test, expect } from '@playwright/test';

const username = process.env.SLSS_E2E_USER || 'e2e_admin';
const password = process.env.SLSS_E2E_PASSWORD || 'SlssE2E!2026';

test.describe('AdminPanel contract smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/login');
    await page.getByLabel(/用户名|username/i).fill(username);
    await page.getByLabel(/密码|password/i).fill(password);
    await page.getByRole('button', { name: /登录|sign in|login/i }).click();
    await expect(page).toHaveURL(/dashboard|admin/i);
  });

  test('loads the administration overview without a fan-out error', async ({ page }) => {
    const responsePromise = page.waitForResponse((r) => r.url().includes('/api/v1/admin/overview'));
    await page.goto('#/admin');
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ counts: expect.any(Object), application: expect.any(Object) });
    await page.goto('#/admin');
    await expect(page.getByText(/管理概览|Admin Overview/i)).toBeVisible();
  });

  test('shows backend status, path and trace details for a failed admin request', async ({ page }) => {
    await page.route('**/api/v1/admin/overview', async (route) => {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({
        code: 'VERSION_CONFLICT', message: '配置已被其他管理员修改', path: '/api/v1/admin/overview', traceId: 'pw-smoke'
      }) });
    });
    await page.goto('#/admin');
    await expect(page.getByText(/409|VERSION_CONFLICT|配置已被其他管理员修改/)).toBeVisible();
    await expect(page.getByText(/admin\/overview|pw-smoke/)).toBeVisible();
  });

  test('keeps permission source and effective permission columns visible', async ({ page }) => {
    await page.goto('#/admin');
    await page.getByRole('tab', { name: /权限|users|身份/i }).click().catch(() => {});
    await expect(page.getByText(/权限来源|Permission source/i)).toBeVisible();
    await expect(page.getByText(/最终有效|Effective permission/i)).toBeVisible();
  });
});
