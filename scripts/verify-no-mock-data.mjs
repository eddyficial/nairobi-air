// verify-no-mock-data.mjs (AC3) - static scan of the SERVED app path (index.html,
// src/**, styles/**) proving no mock/placeholder/seed/hardcoded fake AQI/pollutant
// data is reachable at runtime. Encodes the Architecture section 6 honesty properties as a
// grep-level gate. scripts/ and tests/ are NOT served and are excluded.
// Exit 0 = clean; exit 1 = a violation. Run: `node scripts/verify-no-mock-data.mjs`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, extname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, ".."); // Codebase/

// The served path: index.html + everything under src/ and styles/.
const SERVED_DIRS = ["src", "styles"];
const SERVED_ROOT_FILES = ["index.html"];

// Files permitted to hold declared configuration literals (Architecture section 6 prop 3):
//   config.js - city coordinates + thresholds;  aqi.js - band ranges + hexes.
// api.js - the sole live-value normalizer (permitted the pm2_5/pm10/us_aqi keys).
const ALLOW_CONFIG_LITERALS = new Set(["src/config.js", "src/aqi.js"]);
const ALLOW_POLLUTANT_KEYS = new Set(["src/api.js"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = [
  ...SERVED_ROOT_FILES.map((f) => join(ROOT, f)),
  ...SERVED_DIRS.flatMap((d) => walk(join(ROOT, d))),
];

const violations = [];
function fail(file, line, rule, detail) {
  violations.push({ file: relative(ROOT, file).replace(/\\/g, "/"), line, rule, detail });
}

// --- Rule C: no .json data fixture anywhere in the served path ---
for (const file of files) {
  if (extname(file) === ".json") fail(file, 0, "C:no-json-fixture", "JSON data file in served path");
}

// Banned data tokens - flagged only when used as an identifier/key/assignment
// ("assigned to data", Architecture section 11), never in descriptive prose.
const BANNED = "mock|sample|dummy|seed|fixture|placeholder|fake";
const bannedDecl = new RegExp(`\\b(?:const|let|var|function|class)\\s+[A-Za-z0-9_$]*(?:${BANNED})`, "i");
const bannedAssign = new RegExp(`[A-Za-z0-9_$]*(?:${BANNED})[A-Za-z0-9_$]*\\s*[:=](?![=])`, "i");
// Object-literal pollutant keys outside the normalizer.
const pollutantKey = /\b(pm2_5|pm10|us_aqi)\s*:/;
// A pollutant/AQI value assigned to a data field via a numeric literal.
const fabricatedReading = /\b(aqi|pm2_5|pm10|us_aqi|reading|value)\s*[:=]\s*-?\d/i;

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const ext = extname(file);
  if (![".js", ".mjs", ".html", ".css"].includes(ext)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((raw, i) => {
    const n = i + 1;

    // Rule A - banned data tokens (declarations + assignments/keys)
    if (bannedDecl.test(raw) || bannedAssign.test(raw)) {
      fail(file, n, "A:banned-data-token", raw.trim().slice(0, 80));
    }

    // Rule B - pollutant-key object literal outside the normalizer
    if (pollutantKey.test(raw) && !ALLOW_POLLUTANT_KEYS.has(rel)) {
      fail(file, n, "B:pollutant-key-literal", raw.trim().slice(0, 80));
    }

    // Rule D - fabricated numeric AQI/pollutant assignment outside the two
    // quarantined config files and the normalizer.
    if (
      fabricatedReading.test(raw) &&
      !ALLOW_CONFIG_LITERALS.has(rel) &&
      !ALLOW_POLLUTANT_KEYS.has(rel)
    ) {
      fail(file, n, "D:fabricated-reading", raw.trim().slice(0, 80));
    }
  });
}

if (violations.length > 0) {
  console.error("AC3 verify-no-mock-data: FAIL - mock/fabricated-data violations found:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.detail}`);
  }
  process.exit(1);
}

console.log(
  `AC3 verify-no-mock-data: PASS - scanned ${files.length} served files ` +
  `(index.html, src/**, styles/**); no mock/placeholder/seed/fabricated pollutant data reachable.`,
);
