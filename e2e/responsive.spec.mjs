/*
 * Responsive proof suite — renders each EXISTING route at the full device
 * viewport matrix (which the fixed-1280 browser-automation window could not) and
 * measures: no page-level horizontal overflow, viewport meta, key element
 * visible, no critical console errors. Plus a keyboard/interaction proof for the
 * real interactive component (the context inspector) and a scroll-lock check.
 *
 * Only routes that actually exist are tested. The mission also lists
 * /dossier/graph/, /dossier/entities/, /dossier/relationships/, /dossier/evidence/,
 * /dossier/sources/ — these are NOT built (the graph is embedded in /dossier/;
 * the record routes are NOT IMPLEMENTED). They are MISSING, documented in
 * docs/ui/flowbite/14-production-validation.md, and cannot be proven here.
 *
 * Run: npm run test:responsive            (local, auto-starts zola serve)
 *      PW_BASE_URL=https://unable.cz …     (against production)
 */
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "320", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "2560", width: 2560, height: 1440 },
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
    test(`${r.path} @ ${vp.name}px — no overflow, no console errors`, async ({ page }) => {
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(r.path, { waitUntil: "networkidle" });

      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(scrollW, `${r.path}@${vp.name}: overflow ${scrollW}>${clientW}`).toBeLessThanOrEqual(clientW + 1);

      const vpMeta = await page.getAttribute('meta[name="viewport"]', "content");
      expect(vpMeta).toContain("width=device-width");

      await expect(page.locator(r.key).first()).toBeVisible();

      const critical = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/i.test(e));
      expect(critical, `${r.path}@${vp.name}: console errors ${JSON.stringify(critical)}`).toEqual([]);
    });
  }
}

test("320px narrative claim anchor is sized and navigates to its route", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/dossier/", { waitUntil: "networkidle" });
  const anchor = page.locator("main article a.claim-ref").first();
  await expect(anchor).toBeVisible();
  const box = await anchor.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(14);
  expect(await anchor.getAttribute("href")).toMatch(/\/dossier\/claims\/clm-\d+\/$/);
});

test("390px keyboard/touch: search → inspector bottom sheet → Escape closes; no scroll lock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dossier/", { waitUntil: "networkidle" });

  // Keyboard: `/` focuses the global search (body must hold focus first).
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  const input = page.locator(".ix-sin");
  await expect(input).toBeFocused();

  // Search finds a record; open the first result → context inspector opens.
  await input.fill("Schlesinger");
  const first = page.locator(".ix-sres .ix-sr").first();
  await expect(first).toBeVisible();
  await first.click();

  const panel = page.locator(".ix-panel");
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  // Bottom sheet must fit the 390px viewport width.
  const pbox = await panel.boundingBox();
  expect(pbox.width).toBeLessThanOrEqual(391);

  // Keyboard: Escape closes it.
  await page.keyboard.press("Escape");
  await expect(panel).toHaveAttribute("aria-hidden", "true");

  // No leftover horizontal-scroll lock; the site default overflow-x is hidden.
  const htmlOverflowX = await page.evaluate(() => getComputedStyle(document.documentElement).overflowX);
  expect(htmlOverflowX).toBe("hidden");
  // Focus not lost into a hidden region.
  const active = await page.evaluate(() => (document.activeElement || {}).tagName || "BODY");
  expect(active).not.toBe("HTML");
});
