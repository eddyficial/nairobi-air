// aqi.js — QUARANTINED FILE 2 of 2 (Architecture §6 property 3, Data Model §2).
//
// This is the ONLY file in the served app permitted to contain band-threshold
// literals (0/50/51/.../301) and fixed band hex colors. These are *classification
// configuration* — the boundaries of the standard US EPA AQI scale — not city
// measurements. No live/fetched value is declared here. No DOM, no fetch: pure,
// so `tests/health-guidance.test.mjs` imports it directly.
//
// Verbatim mapping from UX Spec §5 / Data Model §2. Chip text colors are
// contrast-verified against their chipBg at build time (see Builder Verification.md,
// "Contrast resolution"): near-black #1A1A1A on the three light bands (all ≥ 6.8:1),
// white #FFFFFF on the three dark bands (all ≥ 4.5:1). The flagged orange band
// #FF7E00 clears AA with #1A1A1A text (6.82:1) — the band hue is never altered.

export const AQI_BANDS = [
  {
    word: "Good",
    min: 0,
    max: 50,
    chipBg: "#00E400",
    chipText: "#1A1A1A",
    guidance:
      "Air quality is good. It's a fine time to be outside — exercise, walk, or open the windows. No precautions needed for anyone, including sensitive groups.",
  },
  {
    word: "Moderate",
    min: 51,
    max: 100,
    chipBg: "#FFFF00",
    chipText: "#1A1A1A",
    guidance:
      "Air quality is acceptable for most people. Anyone unusually sensitive to air pollution — for example, people managing asthma or a lung condition — may want to reduce prolonged or heavy outdoor exertion today.",
  },
  {
    word: "Unhealthy for Sensitive Groups",
    min: 101,
    max: 150,
    chipBg: "#FF7E00",
    chipText: "#1A1A1A",
    guidance:
      "Sensitive groups — children, older adults, and people with heart or lung conditions — should reduce prolonged or heavy outdoor exertion. Everyone else can generally continue normal outdoor activity.",
  },
  {
    word: "Unhealthy",
    min: 151,
    max: 200,
    chipBg: "#FF0000",
    chipText: "#FFFFFF",
    guidance:
      "Air quality is unhealthy. Most people may start to notice effects such as irritated eyes or throat. Sensitive groups should avoid prolonged outdoor exertion, and everyone may want to move vigorous activity indoors today.",
  },
  {
    word: "Very Unhealthy",
    min: 201,
    max: 300,
    chipBg: "#8F3F97",
    chipText: "#FFFFFF",
    guidance:
      "Air quality is very unhealthy — this is a health alert. Consider limiting outdoor activity for everyone, and sensitive groups should avoid outdoor exertion entirely today.",
  },
  {
    word: "Hazardous",
    min: 301,
    max: null,
    chipBg: "#7E0023",
    chipText: "#FFFFFF",
    guidance:
      "Air quality is hazardous. Consider staying indoors with windows closed where possible, and avoid outdoor exertion — this level can affect the entire population, not only sensitive groups.",
  },
];

// bandForAqi(aqi) — pure. Returns the single band whose [min, max] contains aqi
// (Hazardous is open-ended for aqi >= 301). There is NO default/fallback band:
// a value that cannot be classified (negative, NaN, non-number) throws, because
// such a value never should have passed parseAirQuality upstream.
//
// The US EPA AQI is defined as an INTEGER index, and Open-Meteo reports us_aqi as
// an integer. But parseAirQuality's validated domain admits any finite value >= 0,
// so the classifier must be TOTAL over that whole domain — a fractional value that
// falls in an integer band gap (e.g. 50.5, between Good's max 50 and Moderate's min
// 51) must classify, never hit an unhandled throw that freezes the city in loading
// forever (Review M2). We floor to the EPA integer convention before classifying:
// 50.5 -> 50 -> Good, 100.4 -> 100 -> Moderate, 150.9 -> 150 -> USG, etc. The
// displayed reading value upstream is unchanged (still the real number); only the
// band lookup is floored. The floored index lands in exactly one contiguous band.
export function bandForAqi(aqi) {
  if (typeof aqi !== "number" || !Number.isFinite(aqi) || aqi < 0) {
    throw new Error("bandForAqi: unclassifiable AQI (must be a finite number >= 0)");
  }
  const index = Math.floor(aqi);
  for (const band of AQI_BANDS) {
    if (band.max === null) {
      if (index >= band.min) return band;
    } else if (index >= band.min && index <= band.max) {
      return band;
    }
  }
  // Unreachable: floored bands cover every integer in [0, ∞). Defensive throw,
  // never a silent default.
  throw new Error("bandForAqi: no band matched (should be unreachable)");
}
