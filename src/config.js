// config.js - QUARANTINED FILE 1 of 2 (Architecture section 6 property 3, Data Model section 1).
//
// This is the ONLY file in the served app permitted to contain city-coordinate
// literals. Coordinates here are *configuration*, not measurement data - they say
// WHERE to ask, never WHAT the air quality is. No pollutant/AQI value is ever
// declared here. `scripts/verify-no-mock-data.mjs` allowlists this file for
// coordinate/threshold literals and imports CITIES unchanged, so the verification
// script asks the exact coordinates the app renders (catches coordinate drift).

// Open-Meteo Air-Quality API base (public, keyless, free). Not a secret.
export const API_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

// Staleness threshold - Architect ruling section 3.1: 3 hours. Labeling only, never
// suppresses a real value. One constant to change if field evidence disagrees.
export const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000;

// A hung request becomes an honest error state rather than an indefinite spinner.
export const FETCH_TIMEOUT_MS = 10000;

// The five cities, in FIXED render order (Architecture section 3.2 - NOT worst-air-first).
// Approximate city-centre coordinates in decimal degrees.
export const CITIES = [
  { id: "nairobi", name: "Nairobi", latitude: -1.2864, longitude: 36.8172 },
  { id: "mombasa", name: "Mombasa", latitude: -4.0435, longitude: 39.6682 },
  { id: "kisumu",  name: "Kisumu",  latitude: -0.0917, longitude: 34.7680 },
  { id: "nakuru",  name: "Nakuru",  latitude: -0.3031, longitude: 36.0800 },
  { id: "eldoret", name: "Eldoret", latitude:  0.5143, longitude: 35.2698 },
];
