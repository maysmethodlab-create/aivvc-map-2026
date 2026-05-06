// Download all submission PDFs from the master xlsx URLs to .local/submissions/.
// This folder is gitignored. Files are stored as {teamId}.pdf so the link from
// PDF → applicant identity stays inside the local team-id mapping.
//
// Each call: GET the URL, follow redirects, save the binary, skip if already
// present and non-empty.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.resolve(ROOT, ".local/manifest.json");
const OUT_DIR = path.resolve(ROOT, ".local/submissions");

async function download(item) {
  const dest = path.join(OUT_DIR, `${item.TeamId}.pdf`);
  try {
    const stat = await fs.stat(dest);
    if (stat.size > 1024) return { teamId: item.TeamId, status: "cached", size: stat.size };
  } catch {}

  const r = await fetch(item.Url, { redirect: "follow" });
  if (!r.ok) return { teamId: item.TeamId, status: `http_${r.status}` };
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 100 || !buf.toString("latin1", 0, 5).startsWith("%PDF")) {
    return { teamId: item.TeamId, status: "not_pdf", size: buf.length };
  }
  await fs.writeFile(dest, buf);
  return { teamId: item.TeamId, status: "ok", size: buf.length };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw.replace(/^﻿/, ""));
  console.log(`Manifest has ${manifest.length} entries`);

  // Concurrency-limited pool
  const POOL = 12;
  const queue = manifest.slice();
  const results = [];
  const workers = Array.from({ length: POOL }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      try {
        const r = await download(item);
        results.push(r);
        if (results.length % 25 === 0) {
          console.log(`  ${results.length}/${manifest.length}`);
        }
      } catch (e) {
        results.push({ teamId: item.TeamId, status: "error", err: String(e) });
      }
    }
  });
  await Promise.all(workers);

  const summary = {};
  for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
  console.log("Summary:", summary);

  await fs.writeFile(
    path.resolve(ROOT, ".local/download_log.json"),
    JSON.stringify(results, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
