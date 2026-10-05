# BagelSimulator — offline web build

The official [BagelSim](https://github.com/Team-2480/BagelSim) web build
(Team 2480, High Octane Portable FRC Simulation), vendored so it runs
entirely on its own — no CDN, no Google Fonts, no network calls at runtime.

## Run it

```bash
python3 serve.py            # then open http://localhost:8000
python3 serve.py 9000       # custom port
```

`serve.py` matters: the build uses pthreads, so the browser must treat the
page as cross-origin isolated (`SharedArrayBuffer` is blocked otherwise).
The server sends the `Cross-Origin-Opener-Policy` /
`Cross-Origin-Embedder-Policy` headers that make that work.

Plain `python3 -m http.server` will **not** work — it omits those headers and
the sim hangs on "loading-workers".

You can also host this folder on any static host (GitHub Pages, Netlify,
`python -m http.server`, ...) with no configuration. In that case
`coi-serviceworker.min.js` registers itself, adds the headers via a service
worker, and reloads the page once.

Opening `index.html` over `file://` will not work — browsers block
`fetch()` of the `.wasm`/`.data` bundles there. The page detects this and says so.

## Files

| File | Size | Purpose |
| --- | --- | --- |
| `index.html` | ~6 KB | Loader page |
| `index.js` | 252 KB | Emscripten runtime (also reused as the pthread worker) |
| `index.wasm` | 3.6 MB | Compiled C++ sim (raylib 5.5) |
| `index.data` | 19 MB | Bundled assets: models, shaders, fonts, UI images |
| `coi-serviceworker.min.js` | 3 KB | Adds COOP/COEP when the host doesn't set them |
| `favicon.ico` | 66 KB | Icon |
| `serve.py` | — | Local server that sets the required headers |
| `fetch.sh` | — | Re-downloads the build from the upstream host |

Everything the game loads at runtime lives inside `index.data`; it reads
assets from paths like `/release/lighting.vs` and `/release/map.glb` out of
the in-memory filesystem.

## Verified

Boots under headless Chrome with `raylib 5.5` on `WEB (HTML5)`, shaders
compile, and the rendered frame matches the project's own `screenshot.png`.
Requests outside `localhost` during a full run: **none**.

## Credits

BagelSim is by [Team 2480](https://github.com/Team-2480/BagelSim), GPL-3.0.
This is only a local copy of their published build — all credit and licensing
for the simulator itself belongs to them.