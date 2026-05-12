#!/usr/bin/env node
// Build the production bundle, refresh the README with current commit + date,
// and zip the dist/ folder into a single handoff file for Cindy's team to drop
// on the Mays web server.
//
// Output: ../AIVVC-2026-Map-Site.zip  (next to the aivvc-map folder)
//
// Run from the aivvc-map directory:
//   node scripts/make_handoff_zip.mjs

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");          // aivvc-map/
const PARENT = path.resolve(REPO, "..");             // 2026 AIVVC/
const ZIP_PATH = path.join(PARENT, "AIVVC-2026-Map-Site.zip");

function log(msg) {
  process.stdout.write(`\n› ${msg}\n`);
}

function gitInfo() {
  try {
    const sha = execSync("git -C " + JSON.stringify(REPO) + " rev-parse --short HEAD").toString().trim();
    const subject = execSync("git -C " + JSON.stringify(REPO) + " log -1 --pretty=%s").toString().trim();
    const date = execSync("git -C " + JSON.stringify(REPO) + " log -1 --pretty=%cI").toString().trim();
    return { sha, subject, date };
  } catch {
    return { sha: "unknown", subject: "(uncommitted state)", date: new Date().toISOString() };
  }
}

// ---------- 1. Production build ----------

log("Building production bundle (vite build)");
const viteBin = path.join(REPO, "node_modules", "vite", "bin", "vite.js");
if (!fs.existsSync(viteBin)) {
  console.error("vite not installed. Run `npm install` first.");
  process.exit(2);
}
const build = spawnSync(process.execPath, [viteBin, "build"], {
  cwd: REPO,
  stdio: "inherit",
});
if (build.status !== 0) {
  console.error("Build failed.");
  process.exit(build.status || 1);
}

const distDir = path.join(REPO, "dist");
if (!fs.existsSync(distDir)) {
  console.error("dist/ not produced.");
  process.exit(1);
}

// ---------- 2. Refresh README inside dist/ ----------

log("Stamping README with current commit + date");
const info = gitInfo();
const today = new Date(info.date);
const readableDate = today.toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const README = `AI VENTURE VELOCITY CHALLENGE 2026 - INTERACTIVE DATA PAGE
Mays Business School, Texas A&M University

==============================================================
VERSION
==============================================================
Build date:    ${readableDate}
Commit:        ${info.sha}
Last change:   ${info.subject}

==============================================================
WHAT THIS IS
==============================================================
A self-contained static website. Drop the contents of this
folder onto any web server (Apache, Nginx, IIS, S3, anything
that serves static files) and it works.

It is NOT a server-side application. There is no database,
no backend, no install step.

==============================================================
HOW TO DEPLOY (REPLACE THE PREVIOUS VERSION)
==============================================================
1. On the web server, DELETE the previous version's files
   from the destination folder (e.g. mays.tamu.edu/aivvc/).
   This step is important: the JS and CSS filenames have
   content hashes that change every build, and the old
   hashed files become orphaned cruft if you only overlay.

2. Copy the entire contents of this folder into the
   destination:
     - index.html
     - favicon.ico, TAM-maroon.svg, apple-touch-icon.png
     - Mays_Web_Brand_and_Accessibility_Guide.docx
     - assets/ (CSS, JS, fonts)
     - README.txt

3. Done. Refresh the page in a browser to confirm.

All asset paths in index.html are RELATIVE, so this works at
any URL (subdomain root, subpath, or anywhere else) without
rebuilding.

==============================================================
FILE LIST
==============================================================
index.html                                     entry point
favicon.ico                                    browser tab icon
TAM-maroon.svg                                 SVG icon
apple-touch-icon.png                           iOS bookmark icon
Mays_Web_Brand_and_Accessibility_Guide.docx    reference doc
assets/index-*.js                              app code
assets/index-*.css                             styles
assets/oswald-latin-*.woff2                    display font
assets/work-sans-latin-*.woff2                 body font

==============================================================
BROWSER SUPPORT
==============================================================
All modern browsers (Chrome, Edge, Firefox, Safari) released
in the last three years. No IE11 support.

==============================================================
ACCESSIBILITY & PERFORMANCE
==============================================================
Audited against Lighthouse on the production URL:
  Accessibility:   100
  Best Practices:  100
  SEO:             100
  Performance:     94 (driven by the choropleth map's DOM
                       size; all individual metrics are green)

==============================================================
QUESTIONS / UPDATES
==============================================================
Source lives under the Mays Method Lab GitHub account.
Contact Hari Sridhar (ssridhar@mays.tamu.edu) for source
access, content updates, or rebuild requests.

Brand and accessibility standards documented in the bundled
Mays_Web_Brand_and_Accessibility_Guide.docx.
`;
fs.writeFileSync(path.join(distDir, "README.txt"), README);

// ---------- 3. Zip dist/ contents ----------

log(`Writing ${path.basename(ZIP_PATH)}`);
if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

// Use PowerShell's Compress-Archive on Windows for native zip support.
// The contents-of-folder pattern is `<dir>\*` so the zip has loose files at root.
const isWindows = process.platform === "win32";
let zipResult;
if (isWindows) {
  const ps = `Compress-Archive -Path '${distDir.replace(/'/g, "''")}\\*' -DestinationPath '${ZIP_PATH.replace(/'/g, "''")}' -CompressionLevel Optimal`;
  zipResult = spawnSync("powershell.exe", ["-NoProfile", "-Command", ps], {
    stdio: "inherit",
  });
} else {
  zipResult = spawnSync("zip", ["-r", ZIP_PATH, "."], {
    cwd: distDir,
    stdio: "inherit",
  });
}
if (zipResult.status !== 0) {
  console.error("Zip step failed.");
  process.exit(zipResult.status || 1);
}

const stat = fs.statSync(ZIP_PATH);
const kb = (stat.size / 1024).toFixed(0);

log("Handoff zip ready");
console.log(`   path:   ${ZIP_PATH}`);
console.log(`   size:   ${kb} KB`);
console.log(`   commit: ${info.sha} — ${info.subject}`);
console.log("");
console.log("   Email Cindy with this file attached and tell her to delete the previous");
console.log("   folder contents before unzipping (the JS/CSS filenames change every build).");
console.log("");
