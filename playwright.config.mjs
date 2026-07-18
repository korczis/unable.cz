// Responsive / production-parity test config for the dossier routes.
// Kept OUT of `npm test` (CI has no browsers). Run locally: `npm run test:responsive`.
// Auto-starts `zola serve` (which serves the built static/ + live templates).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "reports/ui-responsive-validation.json" }]],
  use: {
    baseURL: "http://127.0.0.1:1181",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "zola serve --interface 127.0.0.1 --port 1181",
    url: "http://127.0.0.1:1181/dossier/",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
