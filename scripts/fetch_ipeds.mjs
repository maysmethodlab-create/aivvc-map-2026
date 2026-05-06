// Fetch IPEDS / Carnegie / MSI / enrollment fields from College Scorecard for
// all institutions in aivvc_institutions_addresses_for_mapping.csv, then write
// a merged JSON to src/data/institutions.json.
//
// Usage: API_KEY=xxx npm run enrich   (or omit to use DEMO_KEY)
//
// DEMO_KEY rate limits: 30/hr per IP, 50/day. We batch via ?id=A,B,C&per_page=100
// so 161 institutions take 2 calls.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.resolve(ROOT, "..", "aivvc_institutions_addresses_for_mapping.csv");
const OUT_PATH = path.resolve(ROOT, "src/data/institutions.json");

const API_KEY = process.env.API_KEY || "DEMO_KEY";
const API_BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";

// Carnegie Basic 2021 classification — official mapping.
// Source: Carnegie Classifications, College Scorecard data dictionary.
const CARNEGIE_BASIC = {
  "-2": { code: "NotClassified", label: "Not classified" },
  "0": { code: "NotApplicable", label: "Not applicable" },
  "1": { code: "Associates", label: "Associate's College" },
  "2": { code: "Associates", label: "Associate's College" },
  "3": { code: "Associates", label: "Associate's College" },
  "4": { code: "Associates", label: "Associate's College" },
  "5": { code: "Associates", label: "Associate's College" },
  "6": { code: "Associates", label: "Associate's College" },
  "7": { code: "Associates", label: "Associate's College" },
  "8": { code: "Associates", label: "Associate's College" },
  "9": { code: "Associates", label: "Associate's College" },
  "10": { code: "Associates", label: "Associate's College" },
  "11": { code: "Associates", label: "Associate's College" },
  "12": { code: "Associates", label: "Associate's College" },
  "13": { code: "Associates", label: "Associate's College" },
  "14": { code: "Associates", label: "Associate's College" },
  "15": { code: "R1", label: "R1: Doctoral, Very High Research" },
  "16": { code: "R2", label: "R2: Doctoral, High Research" },
  "17": { code: "DPU", label: "Doctoral / Professional University" },
  "18": { code: "Masters", label: "Master's College or University" },
  "19": { code: "Masters", label: "Master's College or University" },
  "20": { code: "Masters", label: "Master's College or University" },
  "21": { code: "Baccalaureate", label: "Baccalaureate College" },
  "22": { code: "Baccalaureate", label: "Baccalaureate College" },
  "23": { code: "BaccAssoc", label: "Baccalaureate / Associate's" },
  "24": { code: "BaccAssoc", label: "Baccalaureate / Associate's" },
  "25": { code: "SpecialFocus", label: "Special Focus Two-Year" },
  "26": { code: "SpecialFocus", label: "Special Focus Two-Year" },
  "27": { code: "SpecialFocus", label: "Special Focus Two-Year" },
  "28": { code: "SpecialFocus", label: "Special Focus Two-Year" },
  "29": { code: "SpecialFocus", label: "Special Focus Two-Year" },
  "30": { code: "SpecialFocus", label: "Special Focus Four-Year" },
  "31": { code: "SpecialFocus", label: "Special Focus Four-Year" },
  "32": { code: "SpecialFocus", label: "Special Focus Four-Year" },
  "33": { code: "Tribal", label: "Tribal College" },
};

// Map US state to Census region (4 regions). Authoritative source: U.S. Census Bureau.
const STATE_TO_REGION = {
  // Northeast
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast",
  NJ: "Northeast", NY: "Northeast", PA: "Northeast", RI: "Northeast", VT: "Northeast",
  // Midwest
  IL: "Midwest", IN: "Midwest", IA: "Midwest", KS: "Midwest", MI: "Midwest",
  MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", OH: "Midwest",
  SD: "Midwest", WI: "Midwest",
  // South
  AL: "South", AR: "South", DE: "South", DC: "South", FL: "South", GA: "South",
  KY: "South", LA: "South", MD: "South", MS: "South", NC: "South", OK: "South",
  SC: "South", TN: "South", TX: "South", VA: "South", WV: "South",
  // West
  AK: "West", AZ: "West", CA: "West", CO: "West", HI: "West", ID: "West",
  MT: "West", NV: "West", NM: "West", OR: "West", UT: "West", WA: "West", WY: "West",
};

// Top-10 brand color overrides (research-based, not invented).
// Sources: official school visual identity guides.
const TOP10_COLORS = {
  228723: { mono: "A&M",  color: "#500000" }, // Texas A&M maroon
  104151: { mono: "ASU",  color: "#8C1D40" }, // ASU maroon
  185828: { mono: "NJIT", color: "#CC0033" }, // NJIT highlander red
  129020: { mono: "UConn",color: "#000E2F" }, // UConn navy
  227757: { mono: "Rice", color: "#00205B" }, // Rice blue
  233921: { mono: "VT",   color: "#861F41" }, // Virginia Tech Chicago maroon
  220978: { mono: "MTSU", color: "#0066CC" }, // Middle Tennessee blue
  147767: { mono: "NU",   color: "#4E2A84" }, // Northwestern purple
  110635: { mono: "Cal",  color: "#003262" }, // UC Berkeley blue
  228787: { mono: "UTD",  color: "#154734" }, // UT Dallas green
};

// Minimal CSV parser for the mapping file (handles quoted fields).
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === "," && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function fetchBatch(ids) {
  const url =
    `${API_BASE}?id=${ids.join(",")}` +
    `&fields=id,school.name,school.state,school.region_id,school.carnegie_basic,` +
    `school.minority_serving.historically_black,` +
    `school.minority_serving.hispanic,` +
    `school.minority_serving.tribal,` +
    `latest.student.size` +
    `&per_page=100&api_key=${API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Scorecard fetch failed: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

async function main() {
  const csvText = await fs.readFile(CSV_PATH, "utf8");
  const rows = parseCsv(csvText);
  console.log(`Read ${rows.length} institutions from CSV`);

  const ids = rows
    .map((r) => r["IPEDS UNITID"])
    .filter((v) => v && /^\d+$/.test(v));

  // Batch in groups of 90 to stay well under URL length limits.
  const batches = [];
  for (let i = 0; i < ids.length; i += 90) batches.push(ids.slice(i, i + 90));
  console.log(`Fetching IPEDS data in ${batches.length} batch(es)...`);

  const enriched = new Map();
  for (const batch of batches) {
    const json = await fetchBatch(batch);
    for (const item of json.results || []) {
      enriched.set(String(item.id), item);
    }
    console.log(`  batch returned ${json.results?.length ?? 0} schools`);
  }

  // Merge CSV row + IPEDS into the final shape consumed by the React app.
  const out = rows.map((r) => {
    const unitid = r["IPEDS UNITID"];
    const ipeds = enriched.get(String(unitid)) || {};
    const carnegieRaw = ipeds["school.carnegie_basic"];
    const carnegieEntry =
      CARNEGIE_BASIC[String(carnegieRaw)] ||
      { code: "Unknown", label: "Unknown" };

    const msi =
      ipeds["school.minority_serving.historically_black"] === 1 ||
      ipeds["school.minority_serving.hispanic"] === 1 ||
      ipeds["school.minority_serving.tribal"] === 1;
    const msiType =
      ipeds["school.minority_serving.historically_black"] === 1 ? "HBCU" :
      ipeds["school.minority_serving.tribal"] === 1 ? "Tribal" :
      ipeds["school.minority_serving.hispanic"] === 1 ? "HSI" : null;

    const state = r["State"];
    const region = STATE_TO_REGION[state] || "Unknown";
    const top = TOP10_COLORS[Number(unitid)] || null;

    return {
      unitid: Number(unitid),
      name: r["School Name"],
      city: r["City"],
      state,
      cityState: `${r["City"]}, ${state}`,
      lat: parseFloat(r["Latitude"]),
      lng: parseFloat(r["Longitude"]),
      count: parseInt(r["Applications"], 10),
      pct: parseFloat(String(r["Percent of Total Applications"]).replace("%", "")),
      region,
      ipedsRegionId: ipeds["school.region_id"] ?? null,
      carnegie: carnegieEntry.code,
      carnegieLabel: carnegieEntry.label,
      carnegieRaw: carnegieRaw ?? null,
      msi,
      msiType,
      enrollment: ipeds["latest.student.size"] ?? null,
      mono: top?.mono ?? null,
      color: top?.color ?? null,
      stage: "applied",
    };
  });

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} institutions to ${OUT_PATH}`);

  const total = out.reduce((s, x) => s + x.count, 0);
  console.log(`Total applications: ${total} (expected 531)`);
  const carnegieDist = {};
  for (const x of out) carnegieDist[x.carnegie] = (carnegieDist[x.carnegie] || 0) + 1;
  console.log("Carnegie distribution:", carnegieDist);
  const regionDist = {};
  for (const x of out) regionDist[x.region] = (regionDist[x.region] || 0) + x.count;
  console.log("Region distribution (apps):", regionDist);
  const missingEnrollment = out.filter((x) => !x.enrollment).length;
  console.log(`Missing enrollment: ${missingEnrollment}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
