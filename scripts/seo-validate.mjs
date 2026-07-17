#!/usr/bin/env node
/**
 * SEO validator.
 *
 * Runs against ./public — the built artifact, not the sources — because the
 * generated HTML is what ships and what a crawler sees. A check that passes on
 * front matter but fails in the output is worthless.
 *
 *   node scripts/seo-validate.mjs [--strict] [--json] [--base-url=URL]
 *
 * Exit codes: 0 clean (warnings allowed), 1 findings at error level.
 * --strict promotes warnings to errors. There is deliberately no flag that
 * skips a check.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");

/** Schema.org types this site is allowed to claim. Anything else is a bug or
 *  an invention. Review/Rating/ClaimReview are absent on purpose: this site
 *  has no reviews and must not fake them. */
export const ALLOWED_SCHEMA_TYPES = new Set([
  "WebSite",
  "WebPage",
  "Report",
  "Article",
  "CollectionPage",
]);

/** Types that assert something about evidence, and so must carry provenance. */
export const EVIDENCE_BEARING_TYPES = new Set(["Report"]);

const PLACEHOLDER = /\b(TODO|FIXME|XXX|lorem ipsum|coming soon|placeholder)\b/i;
const BAD_HOSTS = /(localhost|127\.0\.0\.1|0\.0\.0\.0|:8000|staging\.|\.github\.io)/i;

const TITLE_MAX = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in scripts/seo-validate.test.mjs)
// ---------------------------------------------------------------------------

/** Map a built file path to its canonical route, or null if it is not a route.
 *  `404.html` has no route: it is served for URLs that do not exist. */
export function routeFor(relPath) {
  const p = relPath.split("\\").join("/");
  if (p === "index.html") return "/";
  if (p.endsWith("/index.html")) return "/" + p.slice(0, -"index.html".length);
  return null;
}

/** Join a base URL and a route into a canonical URL. Idempotent in the sense
 *  that it never emits a double slash regardless of base_url's trailing slash. */
export function canonicalUrl(baseUrl, route) {
  return baseUrl.replace(/\/+$/, "") + route;
}

/** Resolve an in-site absolute URL to a path under public/, or null if the URL
 *  is external. Query strings (Zola's cachebust) and fragments are stripped. */
export function urlToPublicPath(baseUrl, url) {
  const base = baseUrl.replace(/\/+$/, "");
  if (!url.startsWith(base + "/") && url !== base && url !== base + "/") return null;
  let rest = url.slice(base.length).split("#")[0].split("?")[0];
  if (rest === "" || rest === "/") return "index.html";
  rest = rest.replace(/^\//, "");
  return rest.endsWith("/") ? rest + "index.html" : rest;
}

export function parseBaseUrl(configToml) {
  const m = configToml.match(/^\s*base_url\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("config.toml: base_url not found");
  return m[1];
}

/** Read a page's TOML front matter block, or null if it has none. */
export function frontMatter(md) {
  const m = md.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+/);
  return m ? m[1] : null;
}

/** Pull one scalar out of a named TOML table in front matter.
 *
 *  This reads only the flat `key = value` shapes this repo actually uses; it is
 *  not a TOML parser and must not be treated as one. Review policy is a
 *  build-time governance concern, so it is checked at the source, where it is
 *  declared -- unlike the metadata checks, which run on the output a crawler
 *  sees. */
export function tomlValue(fm, table, key) {
  const start = fm.indexOf(`[${table}]`);
  if (start === -1) return null;
  const block = fm.slice(start + table.length + 2).split(/\r?\n\[/)[0];
  const m = block.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*(?:#.*)?$`, "m"));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

/** Whole days elapsed between two dates. */
export const daysBetween = (from, to) => Math.floor((to - from) / 86_400_000);

const attr = (html, re) => {
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() : null;
};

function decodeEntities(s) {
  return s
    .replace(/&#x2F;/gi, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Extract the metadata this validator reasons about. The input is our own
 *  deterministic Zola output, so regex extraction is sufficient here; it would
 *  not be for arbitrary HTML. */
export function extractMeta(html) {
  const jsonld = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) jsonld.push(m[1]);

  const links = [];
  const linkRe = /<a\b[^>]*\bhref="([^"]+)"/g;
  while ((m = linkRe.exec(html))) links.push(decodeEntities(m[1]));

  const assetRe = /<(?:link|script|img)\b[^>]*\b(?:href|src)="([^"]+)"/g;
  const assets = [];
  while ((m = assetRe.exec(html))) assets.push(decodeEntities(m[1]));

  return {
    title: attr(html, /<title>([\s\S]*?)<\/title>/),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    canonical: attr(html, /<link rel="canonical" href="([^"]*)"/),
    robots: attr(html, /<meta name="robots" content="([^"]*)"/),
    ogTitle: attr(html, /<meta property="og:title" content="([^"]*)"/),
    ogDescription: attr(html, /<meta property="og:description" content="([^"]*)"/),
    ogImage: attr(html, /<meta property="og:image" content="([^"]*)"/),
    ogUrl: attr(html, /<meta property="og:url" content="([^"]*)"/),
    twitterCard: attr(html, /<meta name="twitter:card" content="([^"]*)"/),
    h1Count: (html.match(/<h1\b/g) || []).length,
    jsonld,
    links,
    assets,
  };
}

export const isIndexable = (meta) => !!meta.robots && !/noindex/i.test(meta.robots);

/** A date is sane if it parses and is not in the future relative to `today`. */
export function dateIssues(label, value, today) {
  const out = [];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) out.push(`${label} is not a valid date: ${value}`);
  else if (d > today) out.push(`${label} is in the future: ${value}`);
  return out;
}

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(argv) {
  const strict = argv.includes("--strict");
  const asJson = argv.includes("--json");
  const findings = [];
  const add = (level, page, rule, message) => findings.push({ level, page, rule, message });

  if (!existsSync(PUBLIC_DIR)) {
    console.error("public/ not found — run `npm run build` first.");
    return 1;
  }

  const configToml = readFileSync(join(ROOT, "config.toml"), "utf8");
  const baseUrlArg = argv.find((a) => a.startsWith("--base-url="));
  const baseUrl = baseUrlArg ? baseUrlArg.slice("--base-url=".length) : parseBaseUrl(configToml);
  const today = new Date();

  // --- Source-level: a literal production host must never be committed to a
  // --- template or to content. config.toml is the one legitimate home for it.
  for (const dir of ["templates", "content"]) {
    const d = join(ROOT, dir);
    if (!existsSync(d)) continue;
    for (const file of walk(d)) {
      const rel = relative(ROOT, file);
      const src = readFileSync(file, "utf8");
      const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (src.includes(host)) {
        // Prose may name the site; an href or a meta tag may not.
        const offending = src
          .split("\n")
          .map((line, i) => [i + 1, line])
          .filter(([, line]) => /(href|src|content|url)\s*=\s*["'][^"']*/.test(line) && line.includes(host));
        for (const [lineNo, line] of offending) {
          add("error", rel, "E_SOURCE_HARDCODED_HOST",
            `line ${lineNo}: literal host "${host}" in an attribute — use get_url()/current_url so base_url stays authoritative: ${line.trim().slice(0, 80)}`);
        }
      }
    }
  }

  // --- Freshness policy, checked at the source where it is declared.
  // --- A page that asserts evidence must say when the evidence was gathered,
  // --- when a human last checked it, and how long that check is good for.
  for (const file of walk(join(ROOT, "content")).filter((f) => f.endsWith(".md"))) {
    const rel = relative(ROOT, file);
    const fm = frontMatter(readFileSync(file, "utf8"));
    if (!fm) { add("error", rel, "E_FRONTMATTER_MISSING", "no TOML front matter"); continue; }

    const seoType = tomlValue(fm, "extra", "seo_type");
    if (seoType && !ALLOWED_SCHEMA_TYPES.has(seoType))
      add("error", rel, "E_SEO_TYPE", `seo_type "${seoType}" is not in the allowlist`);

    if (!EVIDENCE_BEARING_TYPES.has(seoType)) continue;

    const reviewed = tomlValue(fm, "extra.evidence", "reviewed_at");
    const cutoff = tomlValue(fm, "extra.evidence", "cutoff");
    const interval = tomlValue(fm, "extra.evidence", "review_interval_days");
    const confidence = tomlValue(fm, "extra.evidence", "confidence");

    if (!reviewed || !cutoff || !interval || !confidence) {
      add("error", rel, "E_REVIEW_POLICY_MISSING",
        `seo_type = "${seoType}" asserts evidence, so [extra.evidence] must declare cutoff, reviewed_at, review_interval_days and confidence`);
      continue;
    }
    if (!["high", "moderate", "low"].includes(confidence))
      add("error", rel, "E_CONFIDENCE", `confidence "${confidence}" must be high, moderate or low`);

    for (const [label, v] of [["reviewed_at", reviewed], ["cutoff", cutoff]])
      for (const issue of dateIssues(label, v, today)) add("error", rel, "E_DATE_INVALID", issue);

    const age = daysBetween(new Date(reviewed), today);
    const limit = Number(interval);
    if (age > limit) {
      // Public evidence that nobody has re-checked within its own stated window
      // is not "probably fine" -- it is unverified, and says so on the page.
      add("warn", rel, "W_REVIEW_OVERDUE",
        `last reviewed ${age} days ago against a ${limit}-day interval; the page now renders a stale notice. Re-verify the claims and bump reviewed_at, or widen the interval deliberately.`);
    }
  }

  // --- Collect built pages
  const files = walk(PUBLIC_DIR).filter((f) => f.endsWith(".html"));
  const pages = files.map((f) => {
    const rel = relative(PUBLIC_DIR, f).split("\\").join("/");
    const html = readFileSync(f, "utf8");
    return { rel, html, route: routeFor(rel), meta: extractMeta(html) };
  });

  const publicFiles = new Set(walk(PUBLIC_DIR).map((f) => relative(PUBLIC_DIR, f).split("\\").join("/")));
  const indexablePages = pages.filter((p) => isIndexable(p.meta) && p.route);
  const linkTargets = new Set();

  for (const page of pages) {
    const { rel, meta, route, html } = page;
    const indexable = isIndexable(meta);

    // Title / description
    if (!meta.title) add("error", rel, "E_TITLE_MISSING", "no <title>");
    if (meta.title && PLACEHOLDER.test(meta.title))
      add("error", rel, "E_PLACEHOLDER", `title contains placeholder text: "${meta.title}"`);
    if (meta.title && meta.title.length > TITLE_MAX)
      add("warn", rel, "W_TITLE_LONG", `title is ${meta.title.length} chars (>${TITLE_MAX}); it may be truncated in results`);

    if (indexable) {
      if (!meta.description) add("error", rel, "E_DESC_MISSING", "indexable page has no meta description");
      else {
        if (PLACEHOLDER.test(meta.description))
          add("error", rel, "E_PLACEHOLDER", "description contains placeholder text");
        if (meta.description.length > DESC_MAX)
          add("warn", rel, "W_DESC_LONG", `description is ${meta.description.length} chars (>${DESC_MAX})`);
        if (meta.description.length < DESC_MIN)
          add("warn", rel, "W_DESC_SHORT", `description is ${meta.description.length} chars (<${DESC_MIN})`);
      }
      if (meta.h1Count !== 1)
        add("error", rel, "E_H1_COUNT", `indexable page has ${meta.h1Count} <h1> elements, expected exactly 1`);
    }

    // Canonical: present and correct on routes, absent on non-routes.
    if (route) {
      const expected = canonicalUrl(baseUrl, route);
      if (!meta.canonical) add("error", rel, "E_CANONICAL_MISSING", `no canonical; expected ${expected}`);
      else if (meta.canonical !== expected)
        add("error", rel, "E_CANONICAL_MISMATCH", `canonical is ${meta.canonical}, expected ${expected}`);
    } else if (meta.canonical) {
      add("error", rel, "E_CANONICAL_ON_NONROUTE", `${rel} is not a route but declares canonical ${meta.canonical}`);
    }

    // Open Graph
    if (indexable) {
      for (const [k, v] of [["og:title", meta.ogTitle], ["og:description", meta.ogDescription],
                            ["og:image", meta.ogImage], ["og:url", meta.ogUrl],
                            ["twitter:card", meta.twitterCard]]) {
        if (!v) add("warn", rel, "W_OG_MISSING", `missing ${k}`);
      }
      if (meta.ogUrl && route && meta.ogUrl !== canonicalUrl(baseUrl, route))
        add("error", rel, "E_OG_URL_MISMATCH", `og:url ${meta.ogUrl} disagrees with canonical`);
    }

    // Host hygiene in the built output
    if (BAD_HOSTS.test(html))
      add("error", rel, "E_HOST_LEAK", `output contains a non-production host (${(html.match(BAD_HOSTS) || [])[0]})`);

    // JSON-LD
    if (meta.jsonld.length === 0 && indexable)
      add("warn", rel, "W_JSONLD_MISSING", "indexable page has no JSON-LD");
    for (const raw of meta.jsonld) {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        add("error", rel, "E_JSONLD_INVALID", `JSON-LD does not parse: ${e.message}`);
        continue;
      }
      if (data["@context"] !== "https://schema.org")
        add("error", rel, "E_JSONLD_CONTEXT", `@context is ${JSON.stringify(data["@context"])}`);
      const type = data["@type"];
      if (!ALLOWED_SCHEMA_TYPES.has(type))
        add("error", rel, "E_JSONLD_TYPE", `@type "${type}" is not in the allowlist (${[...ALLOWED_SCHEMA_TYPES].join(", ")})`);
      if (route && data.url && data.url !== canonicalUrl(baseUrl, route))
        add("error", rel, "E_JSONLD_URL_MISMATCH", `JSON-LD url ${data.url} disagrees with canonical`);

      // Provenance: a page that claims to be a Report must show its work.
      if (EVIDENCE_BEARING_TYPES.has(type)) {
        const required = ["datePublished", "dateModified", "temporalCoverage"];
        for (const f of required) {
          if (!data[f]) add("error", rel, "E_EVIDENCE_MISSING", `@type ${type} is missing ${f}`);
        }
        if (data.datePublished && data.dateModified) {
          for (const f of required) if (data[f]) for (const issue of dateIssues(f, data[f], today)) add("error", rel, "E_DATE_INVALID", issue);
          if (new Date(data.dateModified) < new Date(data.datePublished))
            add("error", rel, "E_DATE_ORDER", `dateModified (${data.dateModified}) precedes datePublished (${data.datePublished})`);
          if (data.temporalCoverage && new Date(data.temporalCoverage) > new Date(data.dateModified))
            add("error", rel, "E_DATE_ORDER", `evidence cutoff (${data.temporalCoverage}) is later than dateModified (${data.dateModified}) — evidence cannot postdate the review that used it`);
        }
      }
    }

    // Internal links resolve
    for (const href of meta.links) {
      if (/^(mailto:|tel:|#)/.test(href)) continue;
      if (/^javascript:/i.test(href)) {
        add("error", rel, "E_LINK_JS_SCHEME", `javascript: URL in an href`);
        continue;
      }
      const target = urlToPublicPath(baseUrl, href);
      if (target === null) continue; // external, out of scope
      linkTargets.add("/" + target.replace(/index\.html$/, ""));
      if (!publicFiles.has(target))
        add("error", rel, "E_LINK_BROKEN", `internal link ${href} resolves to ${target}, which is not in the build`);
    }
    for (const src of meta.assets) {
      if (src === meta.canonical) continue; // already checked precisely above
      const target = urlToPublicPath(baseUrl, src);
      if (target === null) continue;
      if (!publicFiles.has(target))
        add("error", rel, "E_ASSET_MISSING", `asset ${src} resolves to ${target}, which is not in the build`);
    }
  }

  // --- Cross-page uniqueness
  for (const [field, key] of [["title", "E_DUP_TITLE"], ["description", "E_DUP_DESC"]]) {
    const seen = new Map();
    for (const p of indexablePages) {
      const v = p.meta[field];
      if (!v) continue;
      if (seen.has(v)) add("error", p.rel, key, `${field} duplicates ${seen.get(v)}: "${v.slice(0, 60)}"`);
      else seen.set(v, p.rel);
    }
  }

  // --- Orphans: an indexable route nothing links to will rot unnoticed.
  for (const p of indexablePages) {
    if (p.route === "/") continue;
    if (!linkTargets.has(p.route))
      add("warn", p.rel, "W_ORPHAN", `${p.route} is indexable but no page links to it`);
  }

  // --- Sitemap is Zola's, and must agree with the pages' own robots meta.
  const sitemapPath = join(PUBLIC_DIR, "sitemap.xml");
  if (!existsSync(sitemapPath)) add("error", "sitemap.xml", "E_SITEMAP_MISSING", "no sitemap.xml in build");
  else {
    const xml = readFileSync(sitemapPath, "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (new Set(locs).size !== locs.length) add("error", "sitemap.xml", "E_SITEMAP_DUPLICATE", "sitemap contains duplicate <loc> entries");
    for (const p of indexablePages) {
      const url = canonicalUrl(baseUrl, p.route);
      if (!locs.includes(url)) add("error", "sitemap.xml", "E_SITEMAP_MISSING_URL", `indexable page ${p.route} is absent from the sitemap`);
    }
    for (const loc of locs) {
      const target = urlToPublicPath(baseUrl, loc);
      if (target === null) { add("error", "sitemap.xml", "E_SITEMAP_EXTERNAL", `sitemap lists a non-site URL: ${loc}`); continue; }
      if (!publicFiles.has(target)) { add("error", "sitemap.xml", "E_SITEMAP_404", `sitemap lists ${loc}, which is not in the build`); continue; }
      const page = pages.find((p) => p.rel === target);
      if (page && !isIndexable(page.meta))
        add("error", "sitemap.xml", "E_SITEMAP_NOINDEX", `sitemap lists ${loc}, but that page is noindex — robots.txt and meta robots must not contradict`);
    }
  }

  // --- robots.txt must point at the real sitemap.
  const robotsPath = join(PUBLIC_DIR, "robots.txt");
  if (!existsSync(robotsPath)) add("error", "robots.txt", "E_ROBOTS_MISSING", "no robots.txt in build");
  else {
    const txt = readFileSync(robotsPath, "utf8");
    const expected = canonicalUrl(baseUrl, "/sitemap.xml");
    if (!txt.includes(expected))
      add("error", "robots.txt", "E_ROBOTS_SITEMAP", `robots.txt does not reference ${expected}`);
  }

  // --- Report
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warn");
  const failed = strict ? findings.length > 0 : errors.length > 0;

  if (asJson) {
    console.log(JSON.stringify({
      baseUrl, pages: pages.length, indexable: indexablePages.length,
      errors: errors.length, warnings: warnings.length, strict, ok: !failed,
      findings: findings.sort((a, b) => a.page.localeCompare(b.page) || a.rule.localeCompare(b.rule)),
    }, null, 2));
    return failed ? 1 : 0;
  }

  const byPage = new Map();
  for (const f of findings) {
    if (!byPage.has(f.page)) byPage.set(f.page, []);
    byPage.get(f.page).push(f);
  }
  for (const page of [...byPage.keys()].sort()) {
    console.log(`\n  ${page}`);
    for (const f of byPage.get(page).sort((a, b) => a.rule.localeCompare(b.rule))) {
      console.log(`    ${f.level === "error" ? "ERROR" : "warn "}  ${f.rule.padEnd(24)} ${f.message}`);
    }
  }
  console.log(
    `\n  ${pages.length} pages (${indexablePages.length} indexable) against ${baseUrl}` +
    `\n  ${errors.length} error(s), ${warnings.length} warning(s)${strict ? " [--strict: warnings fail]" : ""}\n`
  );
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
