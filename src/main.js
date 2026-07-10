// main.js - orchestration. On load: fire 5 parallel fetchCity calls, render each
// section independently as its own fetch settles (fixed city order, never re-sorted),
// wire per-city Retry and Retry-all, the all-cities-failed banner, IntersectionObserver
// scroll-reveal, and the ambient data-cell animation - all gated by prefers-reduced-motion.
// No polling, no auto-retry (Architecture section 7): fetches run only on load or explicit Retry.

import { CITIES } from "./config.js";
import { AQI_BANDS } from "./aqi.js";
import { fetchCity } from "./api.js";
import { buildCityViewModel, renderCity } from "./view.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Latest CityResult per city id - the app's only in-memory state. Never persisted,
// never re-served as "current"; a reload re-fetches from scratch (Architecture section 7).
const results = new Map();

function sectionFor(city) {
  return document.getElementById(`city-${city.id}`);
}

function render(city, result) {
  results.set(city.id, result);
  let vm;
  try {
    vm = buildCityViewModel(result);
  } catch (err) {
    // Defensive honesty boundary (Review M2): any unexpected projection or
    // classification error is converted into the honest per-city ERROR state
    // rather than propagating as an unhandled throw that would leave the section
    // stuck in its loading skeleton forever. The error result also updates the
    // in-memory state so the all-failed banner logic stays consistent.
    const errorResult = { city, status: "error", reason: "invalid" };
    results.set(city.id, errorResult);
    vm = buildCityViewModel(errorResult);
  }
  renderCity(sectionFor(city), vm);
  updateAllFailedBanner();
}

// Independent per-city load: loading -> success/error. One city never blocks another.
// Reveal is intentionally NOT called here: section visibility is decoupled from the
// fetch lifecycle (Review H1) and driven at load time by revealAllSections(), so the
// always-visible city name and the loading skeleton are presented immediately during
// the loading window, not gated on when the fetch settles.
async function loadCity(city) {
  render(city, { city, status: "loading" });
  const result = await fetchCity(city);
  render(city, result);
}

function updateAllFailedBanner() {
  const banner = document.getElementById("all-failed-banner");
  const haveAll = CITIES.every((c) => results.has(c.id));
  const allError =
    haveAll && CITIES.every((c) => results.get(c.id)?.status === "error");
  banner.hidden = !allError;
}

function retryCity(cityId) {
  const city = CITIES.find((c) => c.id === cityId);
  if (city) loadCity(city);
}

function retryAll() {
  for (const city of CITIES) loadCity(city);
}

// ---- Motion: IntersectionObserver reveal + ambient data-cell shimmer ----
// All motion is a progressive enhancement gated by prefers-reduced-motion. When
// reduced motion is requested, sections render in their final state instantly and
// no observer/interval is created. The AQI numeral itself never animates (it is
// written once by renderCity and never re-touched).

let revealObserver = null;

function revealSection(section) {
  if (!section) return;
  if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
    section.classList.add("is-visible");
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
  }
  revealObserver.observe(section);
}

// Reveal (or observe for reveal) EVERY city section at load - decoupled from data
// fetching (Review H1). On the default motion path this means each on-screen section
// (its always-visible city name and its loading skeleton) becomes visible immediately
// during the loading window; below-the-fold sections ease in on scroll via the same
// observer. Reveal no longer waits for a fetch to settle, so a slow city can no longer
// leave a blank tinted area where the name + skeleton should be.
function revealAllSections() {
  document.querySelectorAll(".city").forEach((section) => revealSection(section));
}

function startAmbientMotion() {
  if (prefersReducedMotion.matches) return;
  document.body.classList.add("motion-on");
}

function stopAmbientMotion() {
  document.body.classList.remove("motion-on");
}

function syncMotionPreference() {
  if (prefersReducedMotion.matches) {
    stopAmbientMotion();
    document.querySelectorAll(".city").forEach((s) => s.classList.add("is-visible"));
  } else {
    startAmbientMotion();
  }
}

// ---- Wiring ----

// Build the six-band legend from the quarantined AQI_BANDS table - the ONLY source
// of band ranges/hexes - so no band numeral is ever hardcoded into index.html.
function buildLegend() {
  const container = document.getElementById("legend-rows");
  if (!container) return;
  for (const band of AQI_BANDS) {
    const range = band.max === null ? `${band.min}+` : `${band.min}-${band.max}`;
    const row = document.createElement("li");
    row.className = "legend-row";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = band.chipBg;
    swatch.setAttribute("aria-hidden", "true");

    const text = document.createElement("div");
    text.className = "legend-text";
    const head = document.createElement("p");
    head.className = "legend-head";
    head.textContent = `${band.word} - ${range}`;
    const desc = document.createElement("p");
    desc.className = "legend-desc";
    desc.textContent = band.guidance;
    text.append(head, desc);

    row.append(swatch, text);
    container.append(row);
  }
}

function init() {
  buildLegend();

  // Delegate Retry / Retry-all clicks (buttons are re-created on each render).
  document.addEventListener("click", (event) => {
    const retryBtn = event.target.closest("[data-retry-city]");
    if (retryBtn) {
      retryCity(retryBtn.dataset.retryCity);
      return;
    }
    if (event.target.closest("#retry-all")) {
      retryAll();
    }
  });

  // React live to a reduced-motion preference change without reload.
  if (typeof prefersReducedMotion.addEventListener === "function") {
    prefersReducedMotion.addEventListener("change", syncMotionPreference);
  }

  // Record the page-load time in the footer (a real clock time, not data).
  const loadedAt = document.getElementById("loaded-at");
  if (loadedAt) {
    loadedAt.textContent = new Date().toLocaleTimeString();
  }

  startAmbientMotion();

  // Reveal sections at load so the loading state (city name + skeleton) is visible
  // immediately on the motion path, independent of fetch timing (Review H1).
  revealAllSections();

  // Fire all five fetches in parallel; each renders as it settles.
  for (const city of CITIES) loadCity(city);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
