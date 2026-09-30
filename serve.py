from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit
import os

SITE_ROOT = Path(__file__).resolve().parent / "dist"
NOT_FOUND_PAGE = SITE_ROOT / "404.html"
ASSET_DIRECTORIES = {"assets", "art", "stills", "vendor", "3d", "downloads"}


class SiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_ROOT), **kwargs)

    def translate_path(self, path):
        translated = Path(super().translate_path(path)).resolve()
        root = SITE_ROOT.resolve()
        try:
            relative = translated.relative_to(root)
        except ValueError:
            return str(root / "__missing_route__")
        if any(part.startswith(".") for part in relative.parts):
            return str(root / "__missing_route__")
        return str(translated)

    def send_head(self):
        request_path = urlsplit(self.path).path.rstrip("/")
        if request_path in {"/404", "/404.html", "/404/index.html"}:
            self.send_error(404, "Not Found")
            return None
        return super().send_head()

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)

        request_path = urlsplit(self.path).path
        path_parts = PurePosixPath(request_path).parts
        suffix = PurePosixPath(request_path).suffix.lower()
        is_asset = any(part in ASSET_DIRECTORIES for part in path_parts)
        is_file_request = bool(suffix and suffix not in {".html", ".htm"})
        if is_asset or is_file_request:
            return super().send_error(code, message, explain)

        try:
            body = NOT_FOUND_PAGE.read_bytes()
        except OSError:
            return super().send_error(code, message, explain)

        self.log_error("code %d, message %s", code, message or "Not Found")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Robots-Tag", "noindex")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    with ThreadingHTTPServer(("0.0.0.0", port), SiteHandler) as server:
        server.serve_forever()
