import http.server
import socketserver
import mimetypes
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('model/gltf-binary', '.glb')

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.wasm': 'application/wasm',
        '.glb': 'model/gltf-binary',
    }

    def end_headers(self):
        # Enable CORS and caching headers for 3D assets
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), CustomHandler) as httpd:
        print(f"Books & Bricks server running at http://localhost:{PORT}")
        httpd.serve_forever()
