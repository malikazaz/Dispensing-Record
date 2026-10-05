import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  fullyParallel:true,
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}},
  webServer:{command:'npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome']}},
    {name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},
    {name:'mobile-safari',testMatch:['**/mobile-layout.spec.js','**/cloud.spec.js'],use:{...devices['iPhone 13'],defaultBrowserType:'webkit',launchOptions:{}}},
  ],
});
