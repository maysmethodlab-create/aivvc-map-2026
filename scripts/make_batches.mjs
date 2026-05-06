// Split downloaded PDFs into N evenly-sized batches for parallel sub-agent classification.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEXT_DIR = path.resolve(ROOT, ".local/text");
const OUT_DIR = path.resolve(ROOT, ".local/batches");

const N_BATCHES = 6;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = (await fs.readdir(TEXT_DIR)).filter(f => f.endsWith(".txt"));
  files.sort();
  console.log(`Total text files: ${files.length}`);

  const batches = Array.from({ length: N_BATCHES }, () => []);
  files.forEach((f, i) => {
    const teamId = f.replace(/\.txt$/, "");
    const abs = path.join(TEXT_DIR, f);
    batches[i % N_BATCHES].push({ teamId, path: abs });
  });

  for (let i = 0; i < N_BATCHES; i++) {
    const out = path.join(OUT_DIR, `batch_${i + 1}.json`);
    await fs.writeFile(out, JSON.stringify(batches[i], null, 2));
    console.log(`  batch ${i + 1}: ${batches[i].length} PDFs → ${out}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
