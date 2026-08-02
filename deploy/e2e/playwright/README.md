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

## Login branding and captcha contract

`login-security.spec.ts` covers the public login-shell contract without
requiring a database mutation. It stubs:

- `GET /api/v1/settings/branding` (name, subtitle, logo, carousel, overlay and
  version);
- `GET /api/v1/auth/captcha/status?username=...`;
- `POST /api/v1/auth/captcha/challenge`;
- `POST /api/v1/auth/login` for an invalid-credential response.

The expected login behavior is:

1. Brand data is rendered from the API and remains usable if a background image
   fails to load.
2. The password input starts as `type=password`; an accessible eye control
   toggles `password`/`text` without writing secrets to storage.
3. Once the server reports the configured failure threshold, the login shell
   requests and renders a captcha challenge.
4. Captcha answers and passwords are never persisted in `localStorage` or
   `sessionStorage`.

Run only these contract tests with:

```bash
npx playwright test deploy/e2e/playwright/login-security.spec.ts
```
