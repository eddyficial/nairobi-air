// verify-live-data.mjs (AC2) — hits the REAL Open-Meteo API for all five cities,
// using the exact coordinates the app uses (imports CITIES from src/config.js, so
// coordinate drift is caught). Asserts current.pm2_5, current.pm10, current.us_aqi
// are present and finite for every city. Exit 0 = all five live; exit 1 = any
// missing field or unreachable endpoint. Run: `node scripts/verify-live-data.mjs`.

import { CITIES } from "../src/config.js";
import { buildUrl, parseAirQuality } from "../src/api.js";

const FINITE = (v) => typeof v === "number" && Number.isFinite(v);

async function checkCity(city) {
  const url = buildUrl(city);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${city.name}`);
  const json = await res.json();
  const c = json.current;
  if (!c) throw new Error(`${city.name}: response has no "current" block`);
  for (const field of ["pm2_5", "pm10", "us_aqi"]) {
    if (!FINITE(c[field])) {
      throw new Error(`${city.name}: current.${field} is not a finite number (got ${JSON.stringify(c[field])})`);
    }
  }
  // Round-trip through the same parser the app uses (validates the full contract).
  const reading = parseAirQuality(json);
  return { city, reading };
}

let failures = 0;
for (const city of CITIES) {
  try {
    const { reading } = await checkCity(city);
    console.log(
      `PASS  ${city.name.padEnd(9)} US AQI ${reading.aqi}  ` +
      `PM2.5 ${reading.pm2_5}  PM10 ${reading.pm10}  (as of ${reading.observedLocalText})`,
    );
  } catch (err) {
    failures++;
    console.error(`FAIL  ${city.name.padEnd(9)} ${err.message}`);
  }
}

if (failures > 0) {
  console.error(`\nAC2 verify-live-data: ${failures} of ${CITIES.length} cities failed.`);
  process.exit(1);
}
console.log(`\nAC2 verify-live-data: all ${CITIES.length} cities returned live PM2.5 / PM10 / US AQI.`);
