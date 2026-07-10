# Nairobi Air - Codebase

Live air-quality dashboard for five Kenyan cities (Nairobi, Mombasa, Kisumu, Nakuru,
Eldoret), powered by the public, keyless Open-Meteo Air-Quality API. Zero-build vanilla
HTML + CSS + native ES modules. No server, no backend, no bundler, no dependencies in the
served app. **Real data only** - every rendered numeral traces to a live API response in
that session, or the section shows an honest error state.

## Layout

```
index.html            static shell: title, 5 city sections, legend, footer, all-failed banner
.nojekyll             disables Jekyll on GitHub Pages (serve files verbatim)
src/config.js         QUARANTINED: city coordinates + thresholds (only coord literals allowed)
src/aqi.js            QUARANTINED: EPA band table + bandForAqi (only band-threshold/hex literals)
src/api.js            fetchCity + parseAirQuality - the SOLE constructor of a live numeric value
src/view.js           pure buildCityViewModel + thin renderCity DOM writer
src/main.js           orchestration: 5 parallel fetches, retry, banner, motion (reduced-motion gated)
styles/styles.css     "Editorial Data Instrument" system (light-mode, full-bleed tinted bands)
scripts/verify-live-data.mjs      AC2 - real Open-Meteo request per city
scripts/verify-no-mock-data.mjs   AC3 - static scan of the served path for fabricated data
scripts/verify-deployed-url.mjs   AC6 - HTTP 200 + content-marker smoke check (takes a URL)
tests/health-guidance.test.mjs    AC4 - every AQI band boundary -> correct word + guidance
tests/error-states.test.mjs       AC5 - invalid payloads -> honest error (no numeral)
```

## Run locally

ES modules require HTTP (they fail over `file://` due to CORS). Serve statically:

```sh
cd Codebase
python -m http.server 8000
# open http://127.0.0.1:8000/
```

(`npx serve` works too.) The page fetches live Open-Meteo data on load.

## Verify (Node 18+, no framework, no install)

```sh
cd Codebase
node scripts/verify-live-data.mjs      # AC2 (hits the real Open-Meteo API)
node scripts/verify-no-mock-data.mjs   # AC3
node tests/health-guidance.test.mjs    # AC4
node tests/error-states.test.mjs       # AC5
# AC6 - after deploy, or against a local server:
node scripts/verify-deployed-url.mjs http://127.0.0.1:8000/
node scripts/verify-deployed-url.mjs https://<user>.github.io/<repo>/
```

There is no `npm install`, no build step, and no lint config - the app has zero runtime
dependencies by design, so there is nothing to install or bundle.

## Deploy (GitHub Pages - devops/human owns the protected publish)

Serve the `Codebase/` root. Requirements: `index.html` at the served root, `.nojekyll`
present, asset paths relative (`./src/...`, `./styles/...`) so it works under the project
sub-path `https://<user>.github.io/<repo>/`. Record the live URL in `../Deployment Notes.md`
so `verify-deployed-url.mjs` (AC6) can find it. Public repo required (Pages free tier) - safe
because there are no secrets anywhere in this codebase.

## Configuration

All configuration is compiled into the source - zero `.env` files or runtime settings:

- **Cities:** hardcoded in `src/config.js` (Nairobi, Mombasa, Kisumu, Nakuru, Eldoret). Edit to add/change cities.
- **EPA bands & guidance:** hardcoded in `src/aqi.js` (Good 0-50, Moderate 51-100, etc.). Edit to change.
- **API endpoint:** `https://air-quality-api.open-meteo.com/v1/air-quality` (public, keyless).
- **Stale-data threshold:** `STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000` (3 hours) in `src/config.js`. Data >3h old is labeled "Data may be delayed" but still rendered with exact timestamp (never suppressed).
- **Fetch timeout:** `FETCH_TIMEOUT_MS` in `src/config.js`. Adjust per-city timeout here.

No `.env`, no secrets, no authentication required.

## Known limitations

1. **Open-Meteo single point of failure:** The entire app depends on Open-Meteo remaining free, keyless, and live for these five cities. If it ever requires a key or goes offline, the product must be re-scoped.

2. **Modeled AQI data, not ground-truth:** Open-Meteo's AQI values are model-derived (satellite, forecast, regional data), not direct air-quality station measurements. Reliable for "should I go outside?" decisions but may differ from official government reports.

3. **Five cities only:** Hard-coded for Nairobi, Mombasa, Kisumu, Nakuru, Eldoret. Expanding coverage requires editing `src/config.js` and re-deploying.

4. **No background polling:** The app fetches only on page load or explicit Retry. No auto-refresh, no service worker, no background task.

5. **3-hour staleness threshold:** Data is labeled stale if >3h old. This is hardcoded in `src/config.js`; change it there if needed.

6. **Frame-ancestors advisory in console:** The CSP meta tag includes `frame-ancestors` for clickjacking prevention, but the CSS spec ignores this directive in `<meta>` tags (it only works as an HTTP header). This produces a single non-blocking console line with zero functional impact.

## Troubleshooting

**"CORS error" or "Failed to fetch":** You're opening `index.html` over `file://`. ES modules require HTTP.
-> Fix: Use `python -m http.server 8000` (see Run locally).

**City shows "Error" with no data:** Open-Meteo is unreachable or slow. This is intentional - the app does not fabricate data.
-> Fix: Check your internet, verify Open-Meteo is live, tap "Retry", or reload the page.

**"Data may be delayed" label appears:** The data is older than 3 hours (stale). The exact timestamp is shown; the values are real, just old.
-> Expected behavior, not an error. Reload to fetch fresher data.

**Horizontal scrolling at narrow widths:** Should never happen (tested at 320-1280px).
-> File a defect with the viewport width and browser details.
