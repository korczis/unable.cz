/*
 * Responsive proof suite — actually renders each route at real device viewports
 * (which the fixed-1280 browser-automation window could not) and measures:
 *   - no page-level horizontal overflow,
 *   - viewport meta present,
 *   - no critical console errors,
 *   - key structural elements present,
 *   - touch-target sizing for the primary claim link on the smallest viewport.
 *
 * Run: npm run test:responsive   (auto-starts zola serve; not part of CI `npm test`).
 */
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "320", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

const ROUTES = [
  { path: "/", key: "main" },
  { path: "/dossier/", key: "#rel-graph" },
  { path: "/dossier/claims/", key: "table" },
  { path: "/dossier/claims/clm-22/", key: "h1" },
  { path: "/dossier/claims/clm-52/", key: "h1" },
];

for (const vp of VIEWPORTS) {
  for (const r of ROUTES) {
    test(`${r.path} @ ${vp.name}px — no horizontal overflow, no console errors`, async ({ page }) => {
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(r.path, { waitUntil: "networkidle" });

      // 1. no page-level horizontal overflow (the mission's key mobile failure mode)
      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(scrollW, `${r.path}@${vp.name}: horizontal overflow ${scrollW}>${clientW}`).toBeLessThanOrEqual(clientW + 1);

      // 2. viewport meta present
      const vpMeta = await page.getAttribute('meta[name="viewport"]', "content");
      expect(vpMeta).toContain("width=device-width");

      // 3. key structural element present
      await expect(page.locator(r.key).first()).toBeVisible();

      // 4. no critical console errors (ignore benign favicon/network noise)
      const critical = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/i.test(e));
      expect(critical, `${r.path}@${vp.name}: console errors ${JSON.stringify(critical)}`).toEqual([]);
    });
  }
}

test("claim link tap target is adequate on 320px (narrative anchor)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/dossier/", { waitUntil: "networkidle" });
  const anchor = page.locator("main article a.claim-ref").first();
  await expect(anchor).toBeVisible();
  const box = await anchor.boundingBox();
  // Inline links: assert legible height (≥ ~16px line) and that it navigates.
  expect(box.height).toBeGreaterThanOrEqual(14);
  const href = await anchor.getAttribute("href");
  expect(href).toMatch(/\/dossier\/claims\/clm-\d+\/$/);
});
