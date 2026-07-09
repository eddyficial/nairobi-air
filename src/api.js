// api.js — the API adapter and the SOLE place a live numeric AQI/PM value is ever
// constructed (Architecture §6 property 1). `parseAirQuality` reads fields off a
// parsed HTTP response body and throws on any invalid/missing field — there is no
// default value, no fallback constant, no "typical" seed. If the payload is absent
// or invalid, this throws → an ERROR CityResult, which carries no numeric field.
//
// Pure `parseAirQuality` is imported directly by tests/error-states.test.mjs.

import { API_BASE, FETCH_TIMEOUT_MS, STALE_THRESHOLD_MS } from "./config.js";

// Build the Open-Meteo request URL for one city. Coordinates come only from the
// City object (which comes only from src/config.js) — never a literal here.
export function buildUrl(city) {
  return (
    API_BASE +
    "?latitude=" + city.latitude +
    "&longitude=" + city.longitude +
    "&current=pm2_5,pm10,us_aqi" +
    "&timezone=auto"
  );
}

function requireNonNegativeNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("invalid pollutant/AQI field");
  }
  return value;
}

// Format the API's local wall-clock time string (e.g. "2026-07-09T15:00") for
// display, WITHOUT any timezone conversion — the API already reported it in the
// city's local time (timezone=auto). Falls back to the raw string if unparseable
// in an unexpected shape (still real, never fabricated).
function formatObservedLocal(timeString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(timeString);
  if (!match) return timeString;
  const [, year, month, day, hour, minute] = match;
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthName = MONTHS[Number(month) - 1] || month;
  return `${Number(day)} ${monthName} ${year}, ${hour}:${minute}`;
}

// parseAirQuality(json[, now]) — pure. Validates the Open-Meteo response and
// returns a normalized AirQualityReading, or THROWS (never returns a default).
// `now` is injectable so error-states/staleness can be tested deterministically.
export function parseAirQuality(json, now = Date.now()) {
  if (!json || typeof json !== "object") throw new Error("no payload object");
  const current = json.current;
  if (!current || typeof current !== "object") throw new Error("missing current");

  const aqi = requireNonNegativeNumber(current.us_aqi);
  const pm25 = requireNonNegativeNumber(current.pm2_5);
  const pm10Value = requireNonNegativeNumber(current.pm10);

  const time = current.time;
  const offsetSeconds = json.utc_offset_seconds;
  if (typeof time !== "string" || time.length === 0) throw new Error("missing time");
  if (typeof offsetSeconds !== "number" || !Number.isFinite(offsetSeconds)) {
    throw new Error("missing utc_offset_seconds");
  }

  // Architecture §5.2 (specified exactly so the sign cannot be guessed wrong):
  // current.time is local wall time; append 'Z' to read it as if UTC, then
  // subtract the offset to recover the true UTC instant of observation.
  const observedUtcMs = Date.parse(time + "Z") - offsetSeconds * 1000;
  if (!Number.isFinite(observedUtcMs)) throw new Error("unparseable observation time");

  const isStale = now - observedUtcMs > STALE_THRESHOLD_MS;

  return {
    aqi,
    pm2_5: pm25,
    pm10: pm10Value,
    observedUtcMs,
    observedLocalText: formatObservedLocal(time),
    isStale,
  };
}

// fetchCity(city) → CityResult. AbortController-bounded so a hung request becomes
// an error, not an indefinite spinner. Categorizes the failure (network/timeout/
// http/invalid) for internal use; the user-facing copy is a fixed friendly line.
export async function fetchCity(city) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildUrl(city), { signal: controller.signal });
    if (!response.ok) return { city, status: "error", reason: "http" };

    let json;
    try {
      json = await response.json();
    } catch {
      return { city, status: "error", reason: "invalid" };
    }

    let reading;
    try {
      reading = parseAirQuality(json);
    } catch {
      return { city, status: "error", reason: "invalid" };
    }

    return { city, status: "success", reading };
  } catch {
    const reason = controller.signal.aborted ? "timeout" : "network";
    return { city, status: "error", reason };
  } finally {
    clearTimeout(timer);
  }
}
