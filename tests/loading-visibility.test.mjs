// loading-visibility.test.mjs (Review H1 regression) - proves that on the DEFAULT
// motion path (prefers-reduced-motion: NO), every city section is REVEALED and shows
// its loading state immediately at load, BEFORE any fetch resolves. Before the fix,
// `body.motion-on .city { opacity: 0 }` held until `is-visible` was added, and
// `is-visible` was only added AFTER each city's fetch settled - so the always-visible
// city name and the loading skeleton were invisible for the entire loading window.
//
// The app has zero runtime dependencies (no jsdom by architecture), so this uses a
// minimal self-contained DOM / IntersectionObserver / fetch shim and imports the REAL
// src/main.js unchanged. `fetch` is stubbed to a never-resolving promise, so the
// assertions run strictly while all five fetches are still in flight.
//
// Run: `node tests/loading-visibility.test.mjs` (cwd Codebase).

import assert from "node:assert/strict";

let checks = 0;
function check(fn) { fn(); checks++; }

// ---- Minimal DOM element ----
class El {
  constructor(tag) {
    this.tagName = String(tag || "").toUpperCase();
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.attributes = {};
    this._classes = new Set();
    this._text = "";
    this.hidden = false;
    this.type = "";
    this.style = {
      setProperty() {},
      removeProperty() {},
    };
    const self = this;
    this.classList = {
      add: (...cs) => cs.forEach((c) => self._classes.add(c)),
      remove: (...cs) => cs.forEach((c) => self._classes.delete(c)),
      contains: (c) => self._classes.has(c),
      toggle: (c) => (self._classes.has(c) ? self._classes.delete(c) : self._classes.add(c)),
    };
  }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._classes].join(" "); }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set innerHTML(v) { if (v === "") { this.children = []; this._text = ""; } }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  closest() { return null; }
  _walk(out) { out.push(this); for (const c of this.children) c._walk(out); return out; }
  querySelector(sel) {
    const cls = sel.replace(/^\./, "");
    return this._walk([]).find((e) => e !== this && e._classes.has(cls)) || null;
  }
}

// ---- Fixture mirroring index.html's served structure ----
const byId = new Map();
function make(tag, { id, className, dataset } = {}) {
  const e = new El(tag);
  if (id) { e.attributes.id = id; byId.set(id, e); }
  if (className) e.className = className;
  if (dataset) Object.assign(e.dataset, dataset);
  return e;
}

const CITY_IDS = ["nairobi", "mombasa", "kisumu", "nakuru", "eldoret"];
const CITY_NAMES = { nairobi: "Nairobi", mombasa: "Mombasa", kisumu: "Kisumu", nakuru: "Nakuru", eldoret: "Eldoret" };

const body = make("body");
const main = make("main", { id: "city-list" });
const banner = make("div", { id: "all-failed-banner", className: "banner" });
banner.hidden = true;
const sections = [];
for (const id of CITY_IDS) {
  const section = make("section", {
    id: `city-${id}`,
    className: "city",
    dataset: { cityId: id, status: "loading" },
  });
  const inner = make("div", { className: "city-inner" });
  const name = make("h2", { className: "city-name" });
  name.textContent = CITY_NAMES[id];
  const cityBody = make("div", { className: "city-body" });
  inner.append(name, cityBody);
  section.append(inner);
  main.append(section);
  sections.push(section);
}
const legendRows = make("ul", { id: "legend-rows", className: "legend-list" });
const loadedAt = make("span", { id: "loaded-at" });
body.append(banner, main, legendRows, loadedAt);

// ---- Global environment shim ----
const mediaQuery = { matches: false, addEventListener() {}, removeEventListener() {} };

class IntersectionObserverStub {
  constructor(cb) { this.cb = cb; }
  // Model "section is intersecting at load": fire immediately on observe.
  observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
  unobserve() {}
  disconnect() {}
}

const documentShim = {
  readyState: "complete", // so main.js runs init() immediately on import
  body,
  getElementById: (id) => byId.get(id) || null,
  querySelectorAll: (sel) => {
    const cls = sel.replace(/^\./, "");
    return body._walk([]).filter((e) => e._classes.has(cls));
  },
  createElement: (tag) => new El(tag),
  addEventListener() {},
};

globalThis.window = { matchMedia: () => mediaQuery, IntersectionObserver: IntersectionObserverStub };
globalThis.document = documentShim;
globalThis.IntersectionObserver = IntersectionObserverStub;
// fetch never resolves: assertions below run while all 5 fetches are in flight.
globalThis.fetch = () => new Promise(() => {});

// ---- Run the real app ----
await import("../src/main.js");

// At this point init() has run and all five loadCity() calls are suspended on the
// never-resolving fetch - i.e. every fetch is still in flight.

const digit = /\d/;
for (const section of sections) {
  const name = section.dataset.cityId;

  // 1. The section is REVEALED on the motion path (is-visible present), so CSS
  //    opacity is 1, not 0 - visible during the loading window, not after fetch.
  check(() => assert.ok(
    section.classList.contains("is-visible"),
    `city ${name} must be revealed (is-visible) at load, before its fetch resolves`,
  ));

  // 2. The section is in the LOADING state (not yet resolved).
  check(() => assert.equal(
    section.dataset.status, "loading",
    `city ${name} must still be in loading state (fetch has not resolved)`,
  ));

  // 3. The always-visible city name is present.
  const cityBody = section.querySelector("city-body");
  const heading = section._walk([]).find((e) => e._classes.has("city-name"));
  check(() => assert.equal(
    heading.textContent, CITY_NAMES[name],
    `city ${name} name heading must be present immediately`,
  ));

  // 4. The loading skeleton is rendered, and carries ZERO numerals (honesty).
  check(() => assert.ok(
    cityBody.children.length > 0,
    `city ${name} must show a loading skeleton in its body`,
  ));
  check(() => assert.ok(
    !digit.test(cityBody.textContent),
    `city ${name} loading state must contain no digit, got "${cityBody.textContent}"`,
  ));
}

// motion-on is active (default path) - so this proves visibility holds WITH the fade
// system engaged, which is exactly the path H1 regressed on.
check(() => assert.ok(
  body.classList.contains("motion-on"),
  "body.motion-on must be active on the default (non-reduced-motion) path",
));

console.log(`Review H1 loading-visibility: ${checks} checks passed - all 5 cities revealed + in loading state (no numerals) before any fetch resolved, on the motion path.`);
process.exit(0); // fetchCity's 10s abort timers are still pending; exit cleanly.
