// Extract plain text from each downloaded PDF using pdf-parse and write to
// .local/text/{teamId}.txt. Result is ~5-30KB per file, vs the 50KB-7MB raw
// PDFs — well under any agent payload limit.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SUB_DIR = path.resolve(ROOT, ".local/submissions");
const TEXT_DIR = path.resolve(ROOT, ".local/text");

async function extractOne(file) {
  const teamId = file.replace(/\.pdf$/, "");
  const dest = path.join(TEXT_DIR, `${teamId}.txt`);
  try {
    const stat = await fs.stat(dest);
    if (stat.size > 100) return { teamId, status: "cached", size: stat.size };
  } catch {}

  const buf = await fs.readFile(path.join(SUB_DIR, file));
  try {
    const parser = new PDFParse({ data: buf });
    const data = await parser.getText();
    const text = (data.text || "").trim();
    if (text.length < 50) return { teamId, status: "empty", chars: text.length };
    await fs.writeFile(dest, text);
    return { teamId, status: "ok", chars: text.length };
  } catch (e) {
    return { teamId, status: "parse_error", err: String(e).slice(0, 80) };
  }
}

async function main() {
  await fs.mkdir(TEXT_DIR, { recursive: true });
  const files = (await fs.readdir(SUB_DIR)).filter((f) => f.endsWith(".pdf"));
  console.log(`Extracting from ${files.length} PDFs...`);

  const POOL = 8;
  const queue = files.slice();
  const results = [];
  const workers = Array.from({ length: POOL }, async () => {
    while (queue.length) {
      const f = queue.shift();
      if (!f) return;
      const r = await extractOne(f);
      results.push(r);
      if (results.length % 50 === 0) console.log(`  ${results.length}/${files.length}`);
    }
  });
  await Promise.all(workers);

  const summary = {};
  for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
  console.log("Summary:", summary);

  const sizes = results.filter((r) => r.status === "ok" || r.status === "cached").map((r) => r.chars || r.size || 0);
  if (sizes.length) {
    sizes.sort((a, b) => a - b);
    console.log(
      `Text size: min=${sizes[0]}, median=${sizes[Math.floor(sizes.length / 2)]}, max=${sizes[sizes.length - 1]}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
