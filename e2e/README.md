# Nightcrawlers end-to-end tests

Playwright tests that drive the real app (FE + BE + PostgreSQL + Mailpit) in a browser.

## Services needed

| Service | Default | Notes |
|---|---|---|
| Frontend | `http://localhost:5173` | `npm run dev` (Vite proxies `/api` to the backend) or `npm run build && npm run preview`, with the real API (`VITE_API_MOCK=false`) |
| Backend | `http://localhost:8080` | profiles `local,e2e`: high rate limits, Mailpit as SMTP, non-secure cookies over HTTP |
| PostgreSQL | | the database behind the backend |
| Mailpit | SMTP `1025`, HTTP `http://localhost:8025` | `docker run -p 1025:1025 -p 8025:8025 axllent/mailpit` |

Every test creates its own user (unique username and email), so the database does not need to be reset between runs.

## Environment variables

- `E2E_BASE_URL`: app URL (default `http://localhost:5173`).
- `MAILPIT_URL`: Mailpit HTTP API (default `http://localhost:8025`).
- `CI`: enables `forbidOnly`, 1 retry (with trace) and 2 workers.

## Run

```sh
cd e2e
npm ci
npx playwright install chromium webkit   # add --with-deps on Linux CI
npx playwright test                       # all projects
npx playwright test --project=chromium    # desktop only
npx playwright show-report                # HTML report
npm run typecheck
```

Projects: `chromium` (Desktop Chrome), `pixel7` (Pixel 7 landscape, touch) and `iphone14` (WebKit, iPhone 14 landscape).
Phones run in landscape because in portrait the game pauses behind the "rotate the device" notice.
Chromium starts with SwiftShader (`--use-angle=swiftshader`) so the Phaser game gets WebGL when headless.

## Notes

- The game canvas is driven only with the keyboard (WASD, Esc) or the HUD pause button on touch devices.
  Assertions go through the React HUD and overlays, never through canvas pixels.
- Keys are held for about 120 ms: the game reads the keyboard once per frame, so a zero-length synthetic press can be missed.
- After logging in, the tests navigate with in-app links. Every full page load rotates the refresh token, and
  leaving the page while that rotation is still in flight drops the session.
- On Windows the Playwright WebKit build is too slow for the WebGL game loop: the two gameplay tests skip
  `iphone14` there. The other WebKit tests run, and on macOS/Linux everything runs.
