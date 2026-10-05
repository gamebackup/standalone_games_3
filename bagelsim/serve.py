#!/usr/bin/env python3
"""Local server for the offline BagelSim build.

The WASM build uses pthreads, so the browser must consider the page
cross-origin isolated (SharedArrayBuffer is otherwise blocked).  This server
sends the COOP/COEP headers that make that work, so coi-serviceworker.min.js
never has to register and no forced reload happens.

    python3 serve.py            # http://localhost:8000
    python3 serve.py 9000       # custom port
"""

import http.server
import os
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))

EXTRA_TYPES = {
    ".wasm": "application/wasm",
    ".data": "application/octet-stream",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".glb": "model/gltf-binary",
    ".obj": "text/plain",
    ".mtl": "text/plain",
    ".fs": "text/plain",
    ".vs": "text/plain",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in EXTRA_TYPES:
            return EXTRA_TYPES[ext]
        return super().guess_type(path)

    def end_headers(self):
        # Required for SharedArrayBuffer / pthread workers.
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        # The .data bundle is ~19 MB; don't let the browser cache a stale one.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()


if __name__ == "__main__":
    for name in ("index.wasm", "index.data", "index.js", "coi-serviceworker.min.js"):
        if not os.path.exists(os.path.join(ROOT, name)):
            sys.exit("missing %s -- run ./fetch.sh first" % name)

    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print("BagelSim (offline build)")
        print("  ->  http://localhost:%d/" % PORT)
        print("Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")