# AdminPanel Playwright smoke tests

These tests are intentionally contract-oriented: they verify the aggregate
overview endpoint, the visible permission-source/effective-permission split,
and the error contract (`status`, `path`, `code`, `traceId`).

Install the test runner in CI (kept out of the production bundle):

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
npx playwright test
```

Set `SLSS_E2E_URL`, `SLSS_E2E_USER`, and `SLSS_E2E_PASSWORD` for a deployed
environment. The tests do not mutate permission, tenant, branding, or AI data.
