import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const ci = !!process.env.CI

// Phaser renders with WebGL: headless Chromium needs the SwiftShader software rasterizer.
const chromiumWebGl = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

export default defineConfig({
  testDir: './tests',
  // runs share one backend and one Mailpit: keep them few and independent (unique users per test)
  fullyParallel: true,
  workers: ci ? 2 : 3,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'it-IT',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: chromiumWebGl } },
    },
    {
      // touch phone held horizontally: in portrait the game pauses behind the "rotate" notice
      name: 'pixel7',
      use: { ...devices['Pixel 7 landscape'], launchOptions: { args: chromiumWebGl } },
    },
    {
      // WebKit on Windows is a Playwright port of WebKit, not Safari: useful but not identical to iOS
      name: 'iphone14',
      use: { ...devices['iPhone 14 landscape'] },
    },
  ],
})
