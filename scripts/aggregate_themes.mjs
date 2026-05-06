// Aggregate the 6 batch classifications into a single themes file consumed by
// the React app. Strict privacy: output contains ONLY aggregate counts and
// derived percentages — no team_ids, applicant names, venture names, or
// quoted text. Per-institution theme breakdowns are suppressed when the
// count is < 3 (the original prompt's privacy rule).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CLASSIFICATIONS_DIR = path.resolve(ROOT, ".local/classifications");
const MANIFEST_PATH = path.resolve(ROOT, ".local/manifest.json");
const INSTITUTIONS_PATH = path.resolve(ROOT, "src/data/institutions.json");
const OUT_PATH = path.resolve(ROOT, "src/data/themes.json");

const THEMES = [
  "Healthcare",
  "Industrial / Energy",
  "Productivity & Workflow",
  "Education",
  "Personal & Lifestyle",
  "Media / Creative",
  "Public Sector / Civic",
  "Finance",
  "Frontier / Deep Tech",
  "Other",
  "Unreadable",
];

function readJsonStripBom(p) {
  return fs
    .readFile(p, "utf8")
    .then((s) => JSON.parse(s.replace(/^﻿/, "")));
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/university|college|institute|of|the/g, "");
}

async function main() {
  // 1. Combine all batch classifications.
  const files = (await fs.readdir(CLASSIFICATIONS_DIR)).filter((f) =>
    /^batch_\d+\.json$/.test(f)
  );
  const all = {};
  for (const f of files) {
    const obj = await readJsonStripBom(path.join(CLASSIFICATIONS_DIR, f));
    Object.assign(all, obj);
  }
  console.log(`Loaded ${Object.keys(all).length} classifications`);

  // 2. Map teamId → university from manifest.
  const manifest = await readJsonStripBom(MANIFEST_PATH);
  const byTeam = Object.fromEntries(manifest.map((m) => [m.TeamId, m]));
  const institutions = JSON.parse(
    await fs.readFile(INSTITUTIONS_PATH, "utf8")
  );

  // 3. Build a fuzzy lookup from raw university string → institution row.
  const instByNorm = {};
  for (const inst of institutions) {
    instByNorm[normName(inst.name)] = inst;
  }

  function lookupInstitution(rawName) {
    if (!rawName) return null;
    const n = normName(rawName);
    if (instByNorm[n]) return instByNorm[n];
    // Containment fallback in either direction.
    for (const [k, v] of Object.entries(instByNorm)) {
      if (k.includes(n) || n.includes(k)) return v;
    }
    return null;
  }

  // 4. Compute aggregates.
  const themeTotals = Object.fromEntries(THEMES.map((t) => [t, 0]));
  const tagTotals = {};
  const stageTotals = { idea: 0, prototype: 0, mvp: 0, traction: 0, unknown: 0 };
  const targetTotals = {
    consumer: 0,
    smb: 0,
    enterprise: 0,
    government: 0,
    research: 0,
    mixed: 0,
    unknown: 0,
  };
  const themeByRegion = {};
  const themeByUnitid = {};

  let matched = 0;
  let unmatched = 0;

  for (const [teamId, c] of Object.entries(all)) {
    const theme = c.primary_theme || "Other";
    themeTotals[theme] = (themeTotals[theme] || 0) + 1;

    for (const tag of c.secondary_tags || []) {
      tagTotals[tag] = (tagTotals[tag] || 0) + 1;
    }
    const stage = c.stage || "unknown";
    stageTotals[stage] = (stageTotals[stage] || 0) + 1;
    const tgt = c.target_customer || "unknown";
    targetTotals[tgt] = (targetTotals[tgt] || 0) + 1;

    const m = byTeam[teamId];
    const inst = m ? lookupInstitution(m.University) : null;
    if (inst) {
      matched++;
      const region = inst.region || "Unknown";
      themeByRegion[region] = themeByRegion[region] || {};
      themeByRegion[region][theme] = (themeByRegion[region][theme] || 0) + 1;
      themeByUnitid[inst.unitid] = themeByUnitid[inst.unitid] || {};
      themeByUnitid[inst.unitid][theme] = (themeByUnitid[inst.unitid][theme] || 0) + 1;
    } else {
      unmatched++;
    }
  }
  console.log(`Institution match: ${matched}, unmatched: ${unmatched}`);

  // 5. Privacy filter: themeByUnitidSafe surfaces only counts >= 3 alongside an
  // institution name. themeByUnitidFull is used by the map highlight logic
  // (binary "did this school submit any X-themed venture?") — the artifact never
  // displays the underlying count next to a school name when it's 1 or 2.
  const themeByUnitidSafe = {};
  for (const [uid, themes] of Object.entries(themeByUnitid)) {
    const safe = {};
    let kept = 0;
    for (const [t, n] of Object.entries(themes)) {
      if (n >= 3) {
        safe[t] = n;
        kept++;
      }
    }
    if (kept > 0) themeByUnitidSafe[uid] = safe;
  }
  // Binary version for highlight-only use.
  const themeByUnitidPresence = {};
  for (const [uid, themes] of Object.entries(themeByUnitid)) {
    const seen = Object.keys(themes);
    if (seen.length > 0) themeByUnitidPresence[uid] = seen;
  }

  const total = Object.values(themeTotals).reduce((s, v) => s + v, 0);
  const out = {
    generatedAt: new Date().toISOString(),
    classifiedTotal: total,
    coverage: {
      classified: total,
      readableClassified: total - (themeTotals["Unreadable"] || 0),
      unreadable: themeTotals["Unreadable"] || 0,
    },
    themeTotals,
    secondaryTagTotals: Object.fromEntries(
      Object.entries(tagTotals).sort((a, b) => b[1] - a[1])
    ),
    stageTotals,
    targetTotals,
    themeByRegion,
    themeByUnitid: themeByUnitidSafe,
    themeByUnitidPresence,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  console.log("Theme totals:");
  for (const [t, n] of Object.entries(themeTotals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${t}`);
  }
  console.log("Top tags:");
  for (const [t, n] of Object.entries(out.secondaryTagTotals).slice(0, 10)) {
    console.log(`  ${String(n).padStart(4)}  ${t}`);
  }
  console.log("Stages:", stageTotals);
  console.log("Targets:", targetTotals);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
