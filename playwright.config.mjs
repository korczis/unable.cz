// Responsive / production-parity test config for the dossier routes.
// Kept OUT of `npm test` (CI has no browsers). Run locally: `npm run test:responsive`.
// Auto-starts `zola serve` (which serves the built static/ + live templates).
import { defineConfig, devices } from "@playwright/test";

// PW_BASE_URL overrides the target (e.g. https://unable.cz) to run the suite
// against production; without it, a local `zola serve` is started.
const PROD = process.env.PW_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "reports/ui-responsive-validation.json" }]],
  use: {
    baseURL: PROD || "http://127.0.0.1:1181",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: PROD
    ? undefined
    : {
        command: "zola serve --interface 127.0.0.1 --port 1181",
        url: "http://127.0.0.1:1181/dossier/",
        reuseExistingServer: true,
        timeout: 60000,
      },
});
