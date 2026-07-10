// health-guidance.test.mjs (AC4) - every US-AQI band boundary maps to the correct
// band word and guidance sentence. Pure, offline, deterministic. No framework:
// node:assert + exit code. Run: `node tests/health-guidance.test.mjs` (cwd Codebase).

import assert from "node:assert/strict";
import { bandForAqi, AQI_BANDS } from "../src/aqi.js";

let checks = 0;
function check(fn) { fn(); checks++; }

// Every boundary from Architecture section 11 / Data Model section 2, plus a high value.
const boundaries = [
  [0, "Good"],
  [50, "Good"],
  [51, "Moderate"],
  [100, "Moderate"],
  [101, "Unhealthy for Sensitive Groups"],
  [150, "Unhealthy for Sensitive Groups"],
  [151, "Unhealthy"],
  [200, "Unhealthy"],
  [201, "Very Unhealthy"],
  [300, "Very Unhealthy"],
  [301, "Hazardous"],
  [500, "Hazardous"],
];

for (const [aqi, expectedWord] of boundaries) {
  check(() => {
    const band = bandForAqi(aqi);
    assert.equal(band.word, expectedWord, `AQI ${aqi} should be "${expectedWord}", got "${band.word}"`);
    // guidance is non-empty and matches the band's own guidance verbatim
    assert.ok(band.guidance.length > 0, `AQI ${aqi} band has empty guidance`);
    assert.equal(band.guidance, AQI_BANDS.find((b) => b.word === expectedWord).guidance);
  });
}

// Fractional AQI values in the integer band gaps must classify (floored to the EPA
// integer convention), NEVER throw - Review M2. Before the fix, bandForAqi(50.5) hit
// the "no band matched (should be unreachable)" throw, which propagated unhandled and
// froze that city in its loading skeleton forever. Each value below floors into a band.
const fractional = [
  [0.5, "Good"],                             // floor 0
  [50.5, "Good"],                            // floor 50 (gap between Good 50 / Moderate 51)
  [50.9, "Good"],                            // floor 50
  [51.0, "Moderate"],
  [100.4, "Moderate"],                       // floor 100 (gap)
  [100.9, "Moderate"],                       // floor 100
  [150.9, "Unhealthy for Sensitive Groups"], // floor 150 (gap)
  [200.5, "Unhealthy"],                      // floor 200 (gap)
  [300.7, "Very Unhealthy"],                 // floor 300 (gap)
  [301.2, "Hazardous"],                      // floor 301
];
for (const [aqi, expectedWord] of fractional) {
  check(() => {
    let band;
    assert.doesNotThrow(() => { band = bandForAqi(aqi); }, `bandForAqi(${aqi}) must not throw`);
    assert.equal(
      band.word,
      expectedWord,
      `fractional AQI ${aqi} should floor into "${expectedWord}", got "${band.word}"`,
    );
  });
}

// A representative guidance-substring check per band (functional wording, UX section 5).
const guidanceMarkers = [
  [25, "Air quality is good"],
  [75, "acceptable for most people"],
  [125, "Sensitive groups"],
  [175, "Air quality is unhealthy"],
  [250, "very unhealthy"],
  [400, "hazardous"],
];
for (const [aqi, marker] of guidanceMarkers) {
  check(() => {
    const band = bandForAqi(aqi);
    assert.ok(band.guidance.includes(marker), `AQI ${aqi} guidance missing marker "${marker}"`);
  });
}

// Bands are contiguous, non-overlapping, and cover [0, Infinity).
check(() => {
  for (let i = 0; i < AQI_BANDS.length - 1; i++) {
    assert.equal(AQI_BANDS[i].max + 1, AQI_BANDS[i + 1].min, `bands not contiguous at index ${i}`);
  }
  assert.equal(AQI_BANDS[0].min, 0, "first band must start at 0");
  assert.equal(AQI_BANDS[AQI_BANDS.length - 1].max, null, "last band must be open-ended");
});

// Unclassifiable inputs must throw, never resolve to a default band (honesty).
for (const bad of [-1, NaN, Infinity, "50", null, undefined]) {
  check(() => assert.throws(() => bandForAqi(bad), `bandForAqi(${String(bad)}) should throw`));
}

console.log(`AC4 health-guidance: ${checks} checks passed.`);
