/**
 * Tests for the SEO validator's pure logic, plus regression tests that pin the
 * two things most likely to silently rot: the UNABLE link reverting to plain
 * text, and metadata creeping back into individual templates.
 *
 *   node --test scripts/
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  routeFor,
  canonicalUrl,
  urlToPublicPath,
  extractMeta,
  isIndexable,
  dateIssues,
  ALLOWED_SCHEMA_TYPES,
} from "./seo-validate.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE = "https://unable.cz";

// ---------------------------------------------------------------------------
// Route identity
// ---------------------------------------------------------------------------

test("routeFor maps built files to canonical routes", () => {
  assert.equal(routeFor("index.html"), "/");
  assert.equal(routeFor("dossier/index.html"), "/dossier/");
  assert.equal(routeFor("a/b/index.html"), "/a/b/");
});

test("routeFor returns null for non-routes", () => {
  // 404.html is served for URLs that do not exist, so it has no canonical URL
  // of its own. This is what drives it to noindex with no canonical tag.
  assert.equal(routeFor("404.html"), null);
  assert.equal(routeFor("sitemap.xml"), null);
});

// ---------------------------------------------------------------------------
// Canonical URLs
// ---------------------------------------------------------------------------

test("canonicalUrl never produces a double slash", () => {
  for (const base of [BASE, BASE + "/", BASE + "///"]) {
    for (const route of ["/", "/dossier/"]) {
      const url = canonicalUrl(base, route);
      assert.ok(!url.slice("https://".length).includes("//"), `double slash in ${url}`);
    }
  }
});

test("canonicalUrl is idempotent under re-derivation", () => {
  const once = canonicalUrl(BASE, "/dossier/");
  assert.equal(canonicalUrl(BASE, routeFor("dossier/index.html")), once);
});

test("canonicalUrl honours a non-production base URL", () => {
  // Nothing in the resolver may assume the production host.
  assert.equal(canonicalUrl("http://127.0.0.1:1111", "/dossier/"), "http://127.0.0.1:1111/dossier/");
});

// ---------------------------------------------------------------------------
// URL -> file resolution
// ---------------------------------------------------------------------------

test("urlToPublicPath resolves in-site URLs, ignoring query and fragment", () => {
  assert.equal(urlToPublicPath(BASE, `${BASE}/`), "index.html");
  assert.equal(urlToPublicPath(BASE, BASE), "index.html");
  assert.equal(urlToPublicPath(BASE, `${BASE}/dossier/`), "dossier/index.html");
  assert.equal(urlToPublicPath(BASE, `${BASE}/css/main.css?h=abc123`), "css/main.css");
  assert.equal(urlToPublicPath(BASE, `${BASE}/dossier/#sources`), "dossier/index.html");
});

test("urlToPublicPath returns null for external URLs", () => {
  assert.equal(urlToPublicPath(BASE, "https://example.com/"), null);
  assert.equal(urlToPublicPath(BASE, "https://www.getzola.org/"), null);
  // A lookalike host must not be mistaken for our own.
  assert.equal(urlToPublicPath(BASE, "https://unable.cz.evil.test/x"), null);
});

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

test("extractMeta reads the fields the validator reasons about", () => {
  const html = `<html><head><title>T</title>
    <meta name="description" content="D" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${BASE}/dossier/" />
    <script type="application/ld+json">{"@type":"Report"}</script>
    </head><body><h1>H</h1><a href="${BASE}/">home</a></body></html>`;
  const meta = extractMeta(html);
  assert.equal(meta.title, "T");
  assert.equal(meta.description, "D");
  assert.equal(meta.canonical, `${BASE}/dossier/`);
  assert.equal(meta.h1Count, 1);
  assert.deepEqual(meta.jsonld, ['{"@type":"Report"}']);
  assert.deepEqual(meta.links, [`${BASE}/`]);
});

test("extractMeta decodes entity-escaped attributes", () => {
  const meta = extractMeta(`<a href="${BASE}/a&amp;b">x</a>`);
  assert.deepEqual(meta.links, [`${BASE}/a&b`]);
});

test("isIndexable reads meta robots", () => {
  assert.equal(isIndexable({ robots: "index, follow" }), true);
  assert.equal(isIndexable({ robots: "noindex, follow" }), false);
  assert.equal(isIndexable({ robots: null }), false);
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

test("dateIssues rejects unparseable and future dates", () => {
  const today = new Date("2026-07-16");
  assert.deepEqual(dateIssues("d", "2026-07-16", today), []);
  assert.equal(dateIssues("d", "not-a-date", today).length, 1);
  assert.equal(dateIssues("d", "2099-01-01", today).length, 1);
});

// ---------------------------------------------------------------------------
// Schema allowlist
// ---------------------------------------------------------------------------

test("fabricated credibility markup is not in the allowlist", () => {
  // This site has no reviews, ratings, or fact-checks. If one of these ever
  // needs to be emitted, it must be a deliberate, evidenced decision -- not a
  // silent addition.
  for (const t of ["Review", "AggregateRating", "ClaimReview", "Rating"]) {
    assert.ok(!ALLOWED_SCHEMA_TYPES.has(t), `${t} must not be allowed`);
  }
});

// ---------------------------------------------------------------------------
// Regression: the UNABLE easter egg
// ---------------------------------------------------------------------------

const indexTemplate = readFileSync(join(ROOT, "templates/index.html"), "utf8");

test("UNABLE is a real link, not plain text", () => {
  assert.match(indexTemplate, /<a\b[\s\S]*?>UNABLE<\/a>/,
    "UNABLE must remain an anchor; it has regressed to plain text");
});

test("UNABLE links internally via get_url, with no hardcoded host", () => {
  const anchor = indexTemplate.match(/<a\b[\s\S]*?>UNABLE<\/a>/)[0];
  assert.match(anchor, /href="\{\{ get_url\(path='@\/dossier\.md'\) \| safe \}\}"/);
  assert.ok(!/unable\.cz/.test(anchor), "the href must derive from base_url, not name the host");
});

test("UNABLE does not open a new tab and is not JS-driven", () => {
  const anchor = indexTemplate.match(/<a\b[\s\S]*?>UNABLE<\/a>/)[0];
  assert.ok(!/target=/.test(anchor), "must not set target");
  assert.ok(!/onclick|x-on:|@click/.test(anchor), "must not intercept the click");
});

test("UNABLE keeps the shared emphasis step and is keyboard-focusable", () => {
  const anchor = indexTemplate.match(/<a\b[\s\S]*?>UNABLE<\/a>/)[0];
  assert.match(anchor, /hero-emphasis/, "must reuse the design system's emphasis step");
  assert.match(anchor, /focus-visible:outline/, "must show a visible focus ring");
  assert.ok(!/style="/.test(anchor), "no inline styles");
});

test("UNABLE's accessible name contains its visible text (WCAG 2.5.3)", () => {
  const anchor = indexTemplate.match(/<a\b[\s\S]*?>UNABLE<\/a>/)[0];
  const label = anchor.match(/aria-label="([^"]*)"/);
  assert.ok(label, "must have an accessible name");
  assert.match(label[1], /UNABLE/);
  assert.ok(!/title="/.test(anchor), "must not announce itself with a tooltip");
});

test("only UNABLE is linked in the hero", () => {
  const anchors = indexTemplate.match(/<a\b/g) || [];
  assert.equal(anchors.length, 1, "the hero must contain exactly one link");
});

test("the rest of the headline is unchanged", () => {
  assert.match(indexTemplate, /To <strong class="hero-emphasis">PAY<\/strong> U/);
  assert.match(indexTemplate, /Just Because We <strong class="hero-emphasis">CAN<\/strong>/);
});

// ---------------------------------------------------------------------------
// Drift: metadata must stay in base.html
// ---------------------------------------------------------------------------

test("no template except base.html renders its own metadata", () => {
  // The failure mode this prevents: a new page template copy-pastes the og
  // block out of base.html, and the two drift apart. base.html exposes no
  // metadata blocks, so there is nothing to override -- this test keeps it so.
  const templates = readdirSync(join(ROOT, "templates")).filter((f) => f.endsWith(".html") && f !== "base.html");
  assert.ok(templates.length > 0, "expected child templates to exist");
  for (const file of templates) {
    const src = readFileSync(join(ROOT, "templates", file), "utf8");
    assert.ok(!/<meta\b/i.test(src), `${file} renders a <meta> tag; metadata belongs in front matter`);
    assert.ok(!/<title\b/i.test(src), `${file} renders a <title>; it comes from front matter`);
    assert.ok(!/application\/ld\+json/.test(src), `${file} renders JSON-LD; it comes from base.html`);
    assert.ok(!/rel="canonical"/.test(src), `${file} renders a canonical link; base.html owns it`);
  }
});

test("base.html exposes no metadata block hooks", () => {
  const base = readFileSync(join(ROOT, "templates/base.html"), "utf8");
  for (const name of ["og", "schema", "description", "canonical", "title"]) {
    assert.ok(!new RegExp(`\\{%-?\\s*block\\s+${name}\\b`).test(base),
      `base.html exposes {% block ${name} %}, which invites per-page metadata duplication`);
  }
});
