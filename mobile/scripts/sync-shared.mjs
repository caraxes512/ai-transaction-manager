// Copies the API client, types and formatters from web/src (the source of truth) into mobile/src.
//   node scripts/sync-shared.mjs          -> copy
//   node scripts/sync-shared.mjs --check  -> exit 1 if the copies have drifted (used by a test)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["api/client.ts", "api/types.ts", "lib/format.ts"];
const header = (f) => `// GENERATED from web/src/${f} by scripts/sync-shared.mjs. Edit it there, then run \`npm run sync-shared\`.\n`;

let drift = 0;
for (const f of FILES) {
  const wanted = header(f) + readFileSync(join(root, "..", "web", "src", f), "utf8");
  const target = join(root, "src", f);
  let current = null;
  try { current = readFileSync(target, "utf8"); } catch {}
  if (process.argv.includes("--check")) {
    if (current !== wanted) { console.error(`DRIFT: src/${f} differs from web/src/${f}`); drift++; }
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, wanted);
    console.log(`synced src/${f}`);
  }
}
process.exit(drift ? 1 : 0);
