// view.js - pure `buildCityViewModel(result)` (no DOM) + thin `renderCity` DOM writer.
//
// buildCityViewModel discriminates on CityResult.status. The `loading` and `error`
// branches carry NO numeric field (Architecture section 6 property 2, Data Model section 5) - this
// is what structurally guarantees an error/loading section renders zero numerals.
// The pure function is imported directly by tests/error-states.test.mjs.

import { bandForAqi } from "./aqi.js";

function errorCopy(name) {
  return `Live data for ${name} is currently unavailable. Try again.`;
}

// Pure projection of a CityResult to a CityViewModel. No DOM access.
export function buildCityViewModel(result) {
  const name = result.city.name;

  if (result.status === "loading") {
    return { name, status: "loading" };
  }

  if (result.status === "error") {
    // No numeric field of any kind - the honesty invariant AC5 asserts.
    return { name, status: "error", message: errorCopy(name) };
  }

  // success - every numeric field traces to parseAirQuality's live reading.
  const reading = result.reading;
  const band = bandForAqi(reading.aqi);
  return {
    name,
    status: "success",
    aqi: reading.aqi,
    band,
    verdict: band.guidance,
    observedLocalText: reading.observedLocalText,
    isStale: reading.isStale,
    // The signature "data-cell" strip - each cell is a real live metric, labeled.
    dataCells: [
      { label: "PM2.5", value: reading.pm2_5, unit: "µg/m³" },
      { label: "PM10", value: reading.pm10, unit: "µg/m³" },
      { label: "US AQI", value: reading.aqi, unit: "" },
    ],
  };
}

// ---- DOM-writing layer (thin; validated by QA against the running app) ----

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Render one city section into `section` from a CityViewModel. Sets the band tint
// via the --band CSS custom property (computed to a light tint in CSS with
// color-mix), never desaturating the hue. Announces via the section's aria-live
// region. Never animates a numeral after it is written.
export function renderCity(section, vm) {
  section.dataset.status = vm.status;
  section.style.removeProperty("--band");
  section.style.removeProperty("--chip-text");

  const body = section.querySelector(".city-body");
  body.innerHTML = "";

  if (vm.status === "loading") {
    section.setAttribute("aria-busy", "true");
    const skeletonChip = el("div", "chip chip--skeleton");
    skeletonChip.setAttribute("aria-hidden", "true");
    const skeletonLine = el("div", "verdict-skeleton");
    skeletonLine.setAttribute("aria-hidden", "true");
    const srStatus = el("p", "sr-only", `Loading air quality for ${vm.name}...`);
    body.append(skeletonChip, skeletonLine, srStatus);
    return;
  }

  section.setAttribute("aria-busy", "false");

  if (vm.status === "error") {
    const message = el("p", "city-error", vm.message);
    const retry = el("button", "btn btn--retry", "Retry");
    retry.type = "button";
    retry.dataset.retryCity = section.dataset.cityId;
    retry.setAttribute("aria-label", `Retry loading air quality for ${vm.name}`);
    body.append(message, retry);
    return;
  }

  // success
  section.style.setProperty("--band", vm.band.chipBg);
  section.style.setProperty("--chip-text", vm.band.chipText);

  const chip = el("div", "chip");
  chip.setAttribute("role", "img");
  chip.setAttribute("aria-label", `${vm.aqi}, ${vm.band.word}`);
  const chipNumber = el("span", "chip__number", String(vm.aqi));
  const chipWord = el("span", "chip__word", vm.band.word);
  chip.append(chipNumber, chipWord);

  const verdict = el("p", "verdict", vm.verdict);

  const meta = el("p", "observed");
  if (vm.isStale) {
    meta.classList.add("observed--stale");
    meta.textContent = `Data may be delayed - as of ${vm.observedLocalText}`;
  } else {
    meta.textContent = `as of ${vm.observedLocalText}`;
  }

  const strip = el("div", "data-cells");
  strip.setAttribute("aria-hidden", "true"); // decorative echo of values shown above
  for (const cell of vm.dataCells) {
    const cellEl = el("div", "data-cell");
    cellEl.append(
      el("span", "data-cell__label", cell.label),
      el("span", "data-cell__value", cell.unit ? `${cell.value} ${cell.unit}` : String(cell.value)),
    );
    strip.append(cellEl);
  }

  body.append(chip, verdict, meta, strip);
}
