# Nairobi Air — Codebase

Live air-quality dashboard for five Kenyan cities (Nairobi, Mombasa, Kisumu, Nakuru,
Eldoret), powered by the public, keyless Open-Meteo Air-Quality API. Zero-build vanilla
HTML + CSS + native ES modules. No server, no backend, no bundler, no dependencies in the
served app. **Real data only** — every rendered numeral traces to a live API response in
that session, or the section shows an honest error state.

## Layout

```
index.html            static shell: title, 5 city sections, legend, footer, all-failed banner
.nojekyll             disables Jekyll on GitHub Pages (serve files verbatim)
src/config.js         QUARANTINED: city coordinates + thresholds (only coord literals allowed)
src/aqi.js            QUARANTINED: EPA band table + bandForAqi (only band-threshold/hex literals)
src/api.js            fetchCity + parseAirQuality — the SOLE constructor of a live numeric value
src/view.js           pure buildCityViewModel + thin renderCity DOM writer
src/main.js           orchestration: 5 parallel fetches, retry, banner, motion (reduced-motion gated)
styles/styles.css     "Editorial Data Instrument" system (light-mode, full-bleed tinted bands)
scripts/verify-live-data.mjs      AC2 — real Open-Meteo request per city
scripts/verify-no-mock-data.mjs   AC3 — static scan of the served path for fabricated data
scripts/verify-deployed-url.mjs   AC6 — HTTP 200 + content-marker smoke check (takes a URL)
tests/health-guidance.test.mjs    AC4 — every AQI band boundary → correct word + guidance
tests/error-states.test.mjs       AC5 — invalid payloads → honest error (no numeral)
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
# AC6 — after deploy, or against a local server:
node scripts/verify-deployed-url.mjs http://127.0.0.1:8000/
node scripts/verify-deployed-url.mjs https://<user>.github.io/<repo>/
```

There is no `npm install`, no build step, and no lint config — the app has zero runtime
dependencies by design (Architecture §2.1), so there is nothing to install or bundle.

## Deploy (GitHub Pages — devops/human owns the protected publish)

Serve the `Codebase/` root. Requirements: `index.html` at the served root, `.nojekyll`
present, asset paths relative (`./src/…`, `./styles/…`) so it works under the project
sub-path `https://<user>.github.io/<repo>/`. Record the live URL in `../Deployment Notes.md`
so `verify-deployed-url.mjs` (AC6) can find it. Public repo required (Pages free tier) — safe
because there are no secrets anywhere in this codebase (Architecture §9).
