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
  // temporal layer (PROMPT-09)
  { path: "/dossier/changes/", key: "table" },
  { path: "/dossier/changes/chg-0122/", key: "h1" },
  { path: "/dossier/snapshots/", key: "table" },
  { path: "/dossier/snapshots/able-cz-public-2026-07-18-r07/", key: "h1" },
  { path: "/dossier/history/", key: "table" },
  { path: "/dossier/revalidation/", key: "h1" },
  { path: "/dossier/monitoring/", key: "table" },
  // reasoning layer (PROMPT-10)
  { path: "/dossier/reasoning/", key: "table" },
  { path: "/dossier/reasoning/inf-clm-45/", key: "h1" },
  { path: "/dossier/reasoning/exec-06/", key: "h1" },
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
  // Deliberately the anchor in narrative prose (p), not the 10px record-chip
  // buttons other enhancers may wrap around CLM tokens first.
  const anchor = page.locator("main article p a.claim-ref").first();
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

// ---- temporal layer interaction proofs (PROMPT-09 §44 browser tests) ------

test("comparison URL survives reload in a fresh context and Back works", async ({ page }) => {
  const url = "/dossier/changes/?from=able-cz-public-2026-07-17-r04&to=able-cz-public-2026-07-17-r05&materialita=MEDIUM";
  await page.goto(url, { waitUntil: "networkidle" });
  // The pair select reflects the URL state after a cold load.
  await expect(page.locator("#f-pair")).toHaveValue("able-cz-public-2026-07-17-r04..able-cz-public-2026-07-17-r05");
  await expect(page.locator("#f-mat")).toHaveValue("MEDIUM");
  // Only the selected pair's section stays visible.
  const visibleSections = await page.locator("section[data-pair]:not([hidden])").count();
  expect(visibleSections).toBe(1);
  // Changing the filter pushes state; browser Back restores the previous one.
  await page.locator("#f-mat").selectOption("HIGH");
  await page.goBack();
  await expect(page.locator("#f-mat")).toHaveValue("MEDIUM");
});

test("change detail links prior and current revision and both time axes", async ({ page }) => {
  await page.goto("/dossier/changes/chg-0122/", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toContainText("valid time");
  await expect(page.locator("main")).toContainText("system time");
  await expect(page.locator("main")).toContainText("Publikováno ve snapshotu");
  // Snapshot pair links resolve.
  const fromHref = await page.locator('a[href*="able-cz-public-2026-07-17-r02"]').first().getAttribute("href");
  expect(fromHref).toContain("/dossier/snapshots/");
});

test("snapshot detail offers comparisons and frozen object layer", async ({ page }) => {
  await page.goto("/dossier/snapshots/able-cz-public-2026-07-17-r05/", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Porovnat s předchozím" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Porovnat s aktuálním" })).toBeVisible();
  const objHref = await page.locator('a[href$="objects.json"]').first().getAttribute("href");
  expect(objHref).toContain("/data/dossier/snapshots/able-cz-public-2026-07-17-r05/");
  // Static JSON must actually be served.
  const res = await page.request.get(objHref);
  expect(res.ok()).toBeTruthy();
});

test("dossier overview exposes snapshot id and the change summary block", async ({ page }) => {
  await page.goto("/dossier/", { waitUntil: "networkidle" });
  const snapId = page.locator("#dossier-snapshot-id");
  await expect(snapId).toContainText("able-cz-public-");
  expect(await snapId.getAttribute("data-content-hash")).toMatch(/^[0-9a-f]{64}$/);
  await expect(page.locator("#zmeny-heading")).toContainText("Co se změnilo");
});

test("graph change mode renders comparison banner with table alternative", async ({ page }) => {
  await page.goto("/dossier/?mode=changes&from=able-cz-public-2026-07-17-r06&to=able-cz-public-2026-07-18-r07", { waitUntil: "networkidle" });
  const banner = page.locator('[aria-label="Porovnání snapshotů v grafu"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Režim porovnání snapshotů");
  await expect(banner.locator("summary")).toContainText("Tabulková alternativa");
});

test("timeline lanes separate reality from evidence observation (keyboard reachable)", async ({ page }) => {
  await page.goto("/dossier/?lane=zdroje", { waitUntil: "networkidle" });
  const laneBtn = page.locator('[data-tl-lane="zdroje"]');
  await expect(laneBtn).toHaveAttribute("aria-pressed", "true");
  // Every visible event in the lane is labelled as observation, not world event.
  const tags = await page.locator("#tl-list .tl-tag").allTextContents();
  expect(tags.length).toBeGreaterThan(0);
  for (const t of tags) expect(t).toBe("pozorování evidence");
});

// ---- reasoning layer interaction proofs (PROMPT-10) -----------------------

test("assessed claim answers 'why' and links its producing inference", async ({ page }) => {
  await page.goto("/dossier/claims/clm-45/", { waitUntil: "networkidle" });
  const why = page.locator("section[aria-labelledby='why-h']");
  await expect(why).toContainText("Proč tomu věřit?");
  const infLink = why.locator("a", { hasText: "INF-CLM-45" });
  await expect(infLink).toBeVisible();
  await infLink.click();
  await expect(page.locator("h1")).toContainText("INF-CLM-45");
  await expect(page.locator("main")).toContainText("Kroky úsudku");
  await expect(page.locator("main")).toContainText("Kontrafaktuály");
  await expect(page.locator("main")).toContainText("Alternativa");
});

test("executive finding exposes full trace and diversity vector", async ({ page }) => {
  await page.goto("/dossier/reasoning/exec-06/", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toContainText("Úplná stopa");
  await expect(page.locator("main")).toContainText("CLM-44");
  await expect(page.locator("main")).toContainText("Diverzita opory");
  await expect(page.locator("main")).toContainText("Nezávislé rodiny");
});

test("reasoning index shows method transparency, conflicts with both sides, and the DAG canvas", async ({ page }) => {
  await page.goto("/dossier/reasoning/", { waitUntil: "networkidle" });
  await expect(page.locator("#method-h")).toContainText("Transparentnost metody");
  await expect(page.locator("main")).toContainText("Strana A");
  await expect(page.locator("main")).toContainText("Strana B");
  await expect(page.locator(".rg-canvas")).toBeVisible();
  // Executive trace links resolve.
  await page.getByRole("link", { name: "EXEC-02" }).first().click();
  await expect(page.locator("h1")).toContainText("EXEC-02");
});
