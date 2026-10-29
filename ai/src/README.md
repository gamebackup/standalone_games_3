# Vendored browser libraries

These are pinned copies of the browser builds used by Zero. They are loaded from this folder so the app does not depend on CDN versions changing.

| File | Library | Version | Global | License |
|---|---|---:|---|---|
| `nerdamer-2.0.0.js` | nerdamer | 2.0.0 | `nerdamer` | Apache-2.0 |
| `mathjs-15.2.0.js` | mathjs | 15.2.0 | `math` | Apache-2.0 |
| `luxon-3.7.2.min.js` | Luxon | 3.7.2 | `luxon` | MIT |
| `astronomy-engine-2.1.19.min.js` | astronomy-engine | 2.1.19 | `Astronomy` | MIT |
| `compromise-14.19.0.js` | compromise | 14.19.0 | `nlp` | MIT |
| `simple-statistics-8.0.0.min.js` | simple-statistics | 8.0.0 | `ss` | ISC |
| `chroma-js-2.4.2.min.js` | chroma.js | 2.4.2 | `chroma` | BSD-3-Clause AND Apache-2.0 |
| `tonal-6.5.1.min.js` | Tonal | 6.5.1 | `Tonal` | MIT |
| `chess.js-0.10.2.min.js` | chess.js | 0.10.2 | `Chess` | BSD-2-Clause |
| `qrcode-generator-2.0.4.js` | qrcode-generator | 2.0.4 | `qrcode` | MIT |
| `jsbarcode-3.12.3.all.min.js` | JsBarcode | 3.12.3 | `JsBarcode` | MIT |
| `matter-js-0.20.0.min.js` | matter-js | 0.20.0 | `Matter` | MIT |

## Notes

- `nerdamer-2.0.0.js` is the official bundle and replaces the old four-file `@latest` CDN setup.
- `chroma-js` is pinned to 2.4.2 because the current 3.x package no longer ships a standalone browser global.
- `chess.js` is pinned to 0.10.2 because current releases are ESM or CommonJS only. This is the last release with `chess.min.js` and a `Chess` global.
- `tonal` uses the `tonal` package browser bundle, not the modular `@tonaljs/tonal` package.
- All files are loaded with plain script tags before the application script, so they must expose their global at load time.
- When updating a library, verify that it still exposes the global and update both the file and the matching script tag in `index.html`.
