// verify-deployed-url.mjs (AC6) — smoke-proves a live deployment. Fetches a URL and
// asserts HTTP 200 plus the expected content markers (page title, all five city
// names, the Open-Meteo attribution string). Runnable against ANY URL — the public
// GitHub Pages URL after deploy, or a local server for pre-deploy verification.
//
// URL resolution order:
//   1. CLI argument:            node scripts/verify-deployed-url.mjs <url>
//   2. DEPLOY_URL env var
//   3. First https:// URL found in ../Deployment Notes.md (written at deploy time)
//
// Exit 0 = live + all markers present; exit 1 = unreachable, non-200, or missing marker.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CITIES } from "../src/config.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function resolveUrl() {
  const arg = process.argv[2];
  if (arg) return arg.trim();
  if (process.env.DEPLOY_URL) return process.env.DEPLOY_URL.trim();
  // ../Deployment Notes.md lives beside Codebase/ in the project folder.
  const notesPath = join(HERE, "..", "..", "Deployment Notes.md");
  try {
    const text = readFileSync(notesPath, "utf8");
    const match = text.match(/https:\/\/[^\s)>\]]+/);
    if (match) return match[0];
  } catch {
    /* notes not present yet */
  }
  return null;
}

const url = resolveUrl();
if (!url) {
  console.error(
    "AC6 verify-deployed-url: no URL. Pass one as an argument " +
    "(node scripts/verify-deployed-url.mjs <url>), set DEPLOY_URL, " +
    "or record the live URL in Deployment Notes.md.",
  );
  process.exit(1);
}

console.log(`AC6 verify-deployed-url: checking ${url}`);

let res;
try {
  res = await fetch(url, { redirect: "follow" });
} catch (err) {
  console.error(`FAIL  request error: ${err.message}`);
  process.exit(1);
}

if (res.status !== 200) {
  console.error(`FAIL  expected HTTP 200, got ${res.status}`);
  process.exit(1);
}

const html = await res.text();
const markers = [
  ["page title", /Nairobi Air/],
  ["Open-Meteo attribution", /Open-Meteo/],
  ...CITIES.map((c) => [`city: ${c.name}`, new RegExp(`\\b${c.name}\\b`)]),
];

const missing = markers.filter(([, re]) => !re.test(html)).map(([label]) => label);
if (missing.length > 0) {
  console.error(`FAIL  HTTP 200 but missing content markers: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`PASS  HTTP 200 and all ${markers.length} content markers present (title, Open-Meteo, five cities).`);
