# BagelSimulator — offline web build

The official [BagelSim](https://github.com/Team-2480/BagelSim) web build
(Team 2480, High Octane Portable FRC Simulation), vendored so it runs
entirely on its own — no CDN, no Google Fonts, no network calls at runtime.

## Run it

```bash
python3 serve.py            # then open http://localhost:8000
python3 serve.py 9000       # custom port
```

Upstream's build is compiled with pthreads, which needs a cross-origin
isolated page (`SharedArrayBuffer` is blocked otherwise). `serve.py` sends the
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers that
make that work, and the runtime then uses a worker pool.

The local `index.js` is patched: when the page is **not** cross-origin
isolated it skips that worker pool and runs single-threaded. That is what
makes the build work on hosts that send no headers (GitHub Pages) and, more
importantly, inside an embedding page's `<iframe>` — a frame can never become
isolated by itself, because isolation is decided by the top-level document.
So plain `python3 -m http.server` works too; `serve.py` is only for getting
the threaded path locally.

`coi-serviceworker.min.js` is kept for opening this folder directly on a
static host: it now registers only when this page *is* the top-level
document, and then provides COOP/COEP via a service worker so the threaded
path is used. Inside a frame it stays out of the way.

Opening `index.html` over `file://` will not work — browsers block
`fetch()` of the `.wasm`/`.data` bundles there. The page detects this and says so.

## Files

| File | Size | Purpose |
| --- | --- | --- |
| `index.html` | ~6 KB | Loader page |
| `index.js` | 252 KB | Emscripten runtime (also reused as the pthread worker) |
| `index.wasm` | 3.6 MB | Compiled C++ sim (raylib 5.5) |
| `index.data` | 19 MB | Bundled assets: models, shaders, fonts, UI images |
| `coi-serviceworker.min.js` | 3 KB | Adds COOP/COEP when opened as the top-level page on a host that doesn't set them |
| `favicon.ico` | 66 KB | Icon |
| `serve.py` | — | Local server that sets the required headers |
| `fetch.sh` | — | Re-downloads the build from the upstream host |

Everything the game loads at runtime lives inside `index.data`; it reads
assets from paths like `/release/lighting.vs` and `/release/map.glb` out of
the in-memory filesystem.

## Verified

Boots under headless Chrome 150 with `raylib 5.5` on `WEB (HTML5)` and shows
the main menu, in all three setups:

1. top-level with COOP/COEP — threaded, worker pool of 4;
2. top-level without headers — single-threaded;
3. inside a sandboxed same-origin `<iframe>` on a host that sends no
   COOP/COEP — single-threaded, i.e. the gamebackup.github.io embed.

Setup 3 previously hung on "loading-workers" after
`DOMException: The WebAssembly.Memory object cannot be serialized`. No
`pthread_create` is reached on the single-threaded paths (0 running workers
from the main menu through the control-scheme and game-mode screens), and the
rendered frame is identical to the isolated build. Requests outside
`localhost` during a full run: **none**.

## Credits

BagelSim is by [Team 2480](https://github.com/Team-2480/BagelSim), GPL-3.0.
This is only a local copy of their published build — all credit and licensing
for the simulator itself belongs to them.