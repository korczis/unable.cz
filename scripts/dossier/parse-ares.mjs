/*
 * Deterministic extraction of normalized source assertions from preserved
 * ARES artifacts (basic + VR = full public-register record).
 *
 * Input:  cases/DD-Able-CZ-2026-07-17/artifacts/manifest.ndjson
 *         + the content-addressed artifact files it indexes
 * Output: cases/DD-Able-CZ-2026-07-17/extraction/ares-assertions.json
 *         cases/DD-Able-CZ-2026-07-17/extraction/manifest.ndjson (run record)
 *
 * Every assertion carries the artifact SHA-256 and a JSON pointer into the
 * artifact, so each one is re-checkable against the preserved bytes. Assertion
 * IDs are content-derived (stable across runs). The parser INVENTS NOTHING:
 * every value is copied from the artifact, and the extractedFragment field
 * quotes the source JSON verbatim.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const PARSER_VERSION = "1.0.0";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CASE = join(ROOT, "cases/DD-Able-CZ-2026-07-17");

const manifest = readFileSync(join(CASE, "artifacts/manifest.ndjson"), "utf8")
  .trim().split("\n").map(JSON.parse);

// Latest artifact per (entity, tag) — earlier versions remain in the manifest.
const latest = new Map();
for (const m of manifest) latest.set(m.entity + "|" + m.tag, m);

const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const aid = (artifactSha, ptr, predicate) => "ASR-" + sha1(artifactSha + "|" + ptr + "|" + predicate).slice(0, 12);

const assertions = [];
const inputs = [];

function emit(m, ptr, predicate, value, extra = {}) {
  const fragment = JSON.stringify(value);
  assertions.push({
    id: aid(m.sha256, ptr, predicate),
    entity: m.entity,
    predicate,
    ...extra,
    extractedFragment: fragment.length > 600 ? fragment.slice(0, 600) + "…" : fragment,
    evidence: {
      artifactId: m.artifactId,
      sha256: m.sha256,
      storagePath: m.storagePath,
      originalUrl: m.originalUrl,
      retrievedAt: m.retrievedAt,
      jsonPointer: ptr,
      extractionMethod: "json-pointer",
      parserVersion: PARSER_VERSION,
    },
  });
}

const person = (p) => p ? { name: [p.jmeno, p.prijmeni].filter(Boolean).join(" "), born: p.datumNarozeni || null } : null;
const corp = (o) => o ? { name: o.obchodniJmeno || null, ico: o.ico || null } : null;

for (const [key, m] of latest) {
  const [entity, tag] = key.split("|");
  if (tag !== "ares-vr" && tag !== "ares-basic") continue;
  const doc = JSON.parse(readFileSync(join(CASE, m.storagePath), "utf8"));
  inputs.push({ entity, tag, sha256: m.sha256 });

  if (tag === "ares-basic") {
    emit(m, "/ico", "registry:ico", doc.ico, { value: doc.ico });
    emit(m, "/obchodniJmeno", "registry:business-name-current", doc.obchodniJmeno, { value: doc.obchodniJmeno });
    if (doc.sidlo) emit(m, "/sidlo/textovaAdresa", "registry:seat-current", doc.sidlo.textovaAdresa, { value: doc.sidlo.textovaAdresa });
    if (doc.datumVzniku) emit(m, "/datumVzniku", "registry:incorporated", doc.datumVzniku, { value: doc.datumVzniku });
    if (doc.datumZaniku) emit(m, "/datumZaniku", "registry:dissolved", doc.datumZaniku, { value: doc.datumZaniku });
    if (doc.dic) emit(m, "/dic", "registry:vat-id", doc.dic, { value: doc.dic });
    if (doc.pravniForma) emit(m, "/pravniForma", "registry:legal-form-code", doc.pravniForma, { value: doc.pravniForma });
    continue;
  }

  const zaznamy = doc.zaznamy || [];
  zaznamy.forEach((z, zi) => {
    if (!z.primarniZaznam) return;
    const base = `/zaznamy/${zi}`;

    (z.obchodniJmeno || []).forEach((n, i) => emit(m, `${base}/obchodniJmeno/${i}`, "registry:business-name", n, {
      value: n.hodnota, validFrom: n.datumZapisu || null, validTo: n.datumVymazu || null,
    }));

    (z.spisovaZnacka || []).forEach((s, i) => emit(m, `${base}/spisovaZnacka/${i}`, "registry:court-file", s, {
      value: `${s.oddil} ${s.vlozka}/${s.soud}`, validFrom: s.datumZapisu || null, validTo: s.datumVymazu || null,
    }));

    (z.zakladniKapital || []).forEach((k, i) => emit(m, `${base}/zakladniKapital/${i}`, "registry:registered-capital", k, {
      value: k.vklad ? `${k.vklad.hodnota} ${k.vklad.typObnos}` : null, validFrom: k.datumZapisu || null, validTo: k.datumVymazu || null,
    }));

    if (z.stavSubjektu) emit(m, `${base}/stavSubjektu`, "registry:subject-state", z.stavSubjektu, { value: z.stavSubjektu });

    (z.statutarniOrgany || []).forEach((org, oi) => {
      (org.clenoveOrganu || []).forEach((c, ci) => {
        const fn = (c.clenstvi && c.clenstvi.funkce) || {};
        const who = person(c.fyzickaOsoba) || corp(c.pravnickaOsoba);
        emit(m, `${base}/statutarniOrgany/${oi}/clenoveOrganu/${ci}`, "registry:officer", {
          who, funkce: fn.nazev || c.nazevAngazma, vznikFunkce: fn.vznikFunkce, zanikFunkce: fn.zanikFunkce, datumZapisu: c.datumZapisu, datumVymazu: c.datumVymazu,
        }, {
          who, role: fn.nazev || c.nazevAngazma || null,
          validFrom: fn.vznikFunkce || c.datumZapisu || null,
          validTo: fn.zanikFunkce || c.datumVymazu || null,
          registeredFrom: c.datumZapisu || null, registeredTo: c.datumVymazu || null,
        });
      });
    });

    (z.ostatniOrgany || []).forEach((org, oi) => {
      (org.clenoveOrganu || []).forEach((c, ci) => {
        const fn = (c.clenstvi && c.clenstvi.funkce) || {};
        const who = person(c.fyzickaOsoba) || corp(c.pravnickaOsoba);
        emit(m, `${base}/ostatniOrgany/${oi}/clenoveOrganu/${ci}`, "registry:other-organ-member", {
          organ: org.nazevOrganu, who, funkce: fn.nazev, vznik: fn.vznikFunkce, zanik: fn.zanikFunkce,
        }, {
          who, organ: org.nazevOrganu || null, role: fn.nazev || null,
          validFrom: fn.vznikFunkce || c.datumZapisu || null,
          validTo: fn.zanikFunkce || c.datumVymazu || null,
        });
      });
    });

    (z.spolecnici || []).forEach((s, si) => {
      (s.spolecnik || []).forEach((sp, pi) => {
        const who = person(sp.osoba && sp.osoba.fyzickaOsoba) || corp(sp.osoba && sp.osoba.pravnickaOsoba) || person(sp.fyzickaOsoba) || corp(sp.pravnickaOsoba);
        (sp.podil || []).forEach((pod, di) => {
          emit(m, `${base}/spolecnici/${si}/spolecnik/${pi}/podil/${di}`, "registry:shareholding", {
            who, velikostPodilu: pod.velikostPodilu, vklad: pod.vklad, from: pod.datumZapisu, to: pod.datumVymazu,
          }, {
            who,
            stake: pod.velikostPodilu ? `${pod.velikostPodilu.hodnota}${pod.velikostPodilu.typObnos === "PROCENTA" ? " %" : ""}` : null,
            vklad: pod.vklad ? `${pod.vklad.hodnota} ${pod.vklad.typObnos}` : null,
            validFrom: pod.datumZapisu || null, validTo: pod.datumVymazu || null,
          });
        });
      });
    });
  });
}

assertions.sort((a, b) => (a.entity + a.predicate + a.id).localeCompare(b.entity + b.predicate + b.id));

const outDir = join(CASE, "extraction");
mkdirSync(outDir, { recursive: true });
const out = {
  _extraction: {
    parser: "scripts/dossier/parse-ares.mjs",
    parserVersion: PARSER_VERSION,
    inputs: inputs.sort((a, b) => (a.entity + a.tag).localeCompare(b.entity + b.tag)),
    note: "Machine extraction from preserved ARES artifacts. Nothing added; every assertion carries a JSON pointer into a hashed artifact.",
  },
  assertions,
};
writeFileSync(join(outDir, "ares-assertions.json"), JSON.stringify(out, null, 2) + "\n");
appendFileSync(join(outDir, "manifest.ndjson"), JSON.stringify({
  run: "parse-ares", parserVersion: PARSER_VERSION,
  inputs: inputs.length, assertions: assertions.length,
  output: "extraction/ares-assertions.json",
  outputSha256: createHash("sha256").update(JSON.stringify(out)).digest("hex"),
}) + "\n");
console.log(`assertions: ${assertions.length} from ${inputs.length} artifacts`);
const byPred = {};
for (const a of assertions) byPred[a.predicate] = (byPred[a.predicate] || 0) + 1;
console.log(JSON.stringify(byPred, null, 2));
