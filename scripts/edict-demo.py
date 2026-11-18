"""Serve the pinned Edict project's own demo status on loopback using its GET handler."""
import os
import sys
from http.server import HTTPServer
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "upstream" / "projects" / "edict"
if not (root / "dashboard" / "server.py").is_file():
    raise SystemExit("npm run projects -- checkout edict")
sys.path.insert(0, str(root / "dashboard"))
import server as edict

edict._ACTIVE_TASK_DATA_DIR = root / "docker" / "demo_data"


class DemoStatus(edict.Handler):
    def send_json(self, data, code=200):
        super().send_json({**data, "demo": True}, code)

    def do_GET(self):
        if self.path == "/":
            self.send_json({"demo": True, "status_url": "/api/live-status"})
        elif self.path == "/api/live-status":
            super().do_GET()
        else:
            self.send_error(404)

    def do_POST(self):
        self.send_error(405)


if __name__ == "__main__":
    port = int(os.environ.get("EDICT_DEMO_PORT", "17891"))
    print(f"Edict DEMO · http://127.0.0.1:{port}/api/live-status", flush=True)
    HTTPServer(("127.0.0.1", port), DemoStatus).serve_forever()
