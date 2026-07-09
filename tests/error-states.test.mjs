// error-states.test.mjs (AC5) — the honest-error contract at the unit level:
// invalid Open-Meteo payloads make parseAirQuality throw, and the resulting error
// view-model carries NO numeric AQI/pollutant field and no digit-bearing value.
// Also sanity-checks the staleness sign (Architecture A7). No framework.
// Run: `node tests/error-states.test.mjs` (cwd Codebase).

import assert from "node:assert/strict";
import { parseAirQuality } from "../src/api.js";
import { buildCityViewModel } from "../src/view.js";

let checks = 0;
function check(fn) { fn(); checks++; }

const CITY = { id: "nairobi", name: "Nairobi", latitude: -1.2864, longitude: 36.8172 };

// --- 1. parseAirQuality throws on every invalid payload from Architecture §5.3 ---
const invalidPayloads = [
  ["missing current", {}],
  ["null current", { current: null }],
  ["null us_aqi", { current: { us_aqi: null, pm2_5: 5, pm10: 8, time: "2026-07-09T15:00" }, utc_offset_seconds: 10800 }],
  ["negative us_aqi", { current: { us_aqi: -3, pm2_5: 5, pm10: 8, time: "2026-07-09T15:00" }, utc_offset_seconds: 10800 }],
  ["NaN us_aqi", { current: { us_aqi: Number.NaN, pm2_5: 5, pm10: 8, time: "2026-07-09T15:00" }, utc_offset_seconds: 10800 }],
  ["string us_aqi", { current: { us_aqi: "41", pm2_5: 5, pm10: 8, time: "2026-07-09T15:00" }, utc_offset_seconds: 10800 }],
  ["missing pm2_5", { current: { us_aqi: 41, pm10: 8, time: "2026-07-09T15:00" }, utc_offset_seconds: 10800 }],
  ["missing time", { current: { us_aqi: 41, pm2_5: 5, pm10: 8 }, utc_offset_seconds: 10800 }],
  ["missing offset", { current: { us_aqi: 41, pm2_5: 5, pm10: 8, time: "2026-07-09T15:00" } }],
  ["non-object", "not json at all"],
  ["null payload", null],
];
for (const [label, payload] of invalidPayloads) {
  check(() => assert.throws(() => parseAirQuality(payload), `expected throw for: ${label}`));
}

// --- 2. An error CityResult -> view-model has no numeral anywhere ---
const digit = /\d/;
check(() => {
  const vm = buildCityViewModel({ city: CITY, status: "error", reason: "network" });
  assert.equal(vm.status, "error");
  // no aqi / pollutant fields exist at all
  assert.equal(vm.aqi, undefined);
  assert.equal(vm.dataCells, undefined);
  assert.equal(vm.band, undefined);
  // no property value string contains a digit
  for (const [key, value] of Object.entries(vm)) {
    if (typeof value === "string") {
      assert.ok(!digit.test(value), `error view-model field "${key}" must not contain a digit: "${value}"`);
    }
    assert.notEqual(typeof value, "number", `error view-model field "${key}" must not be numeric`);
  }
});

// --- 3. Loading view-model likewise carries no numeral ---
check(() => {
  const vm = buildCityViewModel({ city: CITY, status: "loading" });
  assert.equal(vm.status, "loading");
  assert.equal(vm.aqi, undefined);
  for (const value of Object.values(vm)) {
    assert.notEqual(typeof value, "number");
    if (typeof value === "string") assert.ok(!digit.test(value));
  }
});

// --- 4. A valid payload DOES produce a numeric reading (positive control) ---
check(() => {
  const fresh = {
    current: { us_aqi: 41, pm2_5: 12.3, pm10: 20.1, time: "2026-07-09T15:00" },
    utc_offset_seconds: 10800,
  };
  const now = Date.parse("2026-07-09T12:30:00Z"); // 30 min after the observation
  const reading = parseAirQuality(fresh, now);
  assert.equal(reading.aqi, 41);
  assert.equal(reading.pm2_5, 12.3);
  assert.equal(reading.isStale, false, "30-min-old reading must not be stale");
});

// --- 5. Staleness sign sanity (Architecture A7): known-stale and known-fresh ---
check(() => {
  const payload = {
    current: { us_aqi: 60, pm2_5: 9, pm10: 14, time: "2026-07-09T10:00" },
    utc_offset_seconds: 10800, // observation UTC instant = 2026-07-09T07:00Z
  };
  const fresh = parseAirQuality(payload, Date.parse("2026-07-09T08:30:00Z")); // 1.5h later
  assert.equal(fresh.isStale, false, "1.5h-old reading must be fresh (< 3h)");
  const stale = parseAirQuality(payload, Date.parse("2026-07-09T11:30:00Z")); // 4.5h later
  assert.equal(stale.isStale, true, "4.5h-old reading must be stale (> 3h)");
  // The raw timestamp is always present regardless of staleness.
  assert.ok(stale.observedLocalText.length > 0);
});

// --- 6. A fractional success AQI builds a view-model without throwing (Review M2) ---
// The unhandled-throw path was: a fractional us_aqi -> bandForAqi throws -> the throw
// propagates out of buildCityViewModel and the city hangs in loading. buildCityViewModel
// must now project a fractional-AQI success cleanly (classification floors; the displayed
// value stays the real reading), so no unexpected throw reaches the render boundary.
check(() => {
  const result = {
    city: CITY,
    status: "success",
    reading: { aqi: 50.5, pm2_5: 12.3, pm10: 20.1, observedLocalText: "9 Jul 2026, 15:00", isStale: false },
  };
  let vm;
  assert.doesNotThrow(() => { vm = buildCityViewModel(result); }, "fractional-AQI success must not throw");
  assert.equal(vm.status, "success");
  assert.equal(vm.band.word, "Good", "50.5 floors to 50 -> Good band");
  assert.equal(vm.aqi, 50.5, "displayed value stays the real reading; only classification floors");
});

console.log(`AC5 error-states: ${checks} checks passed.`);
