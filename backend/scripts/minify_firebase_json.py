"""Minify a Firebase service-account JSON file into a single line.

Outputs to stdout so you can pipe it / copy it. Usage:

    python backend/scripts/minify_firebase_json.py path/to/service-account.json

On Windows PowerShell, pipe to clipboard:

    python backend\\scripts\\minify_firebase_json.py "$HOME\\Downloads\\savomart-*-firebase-adminsdk-*.json" | Set-Clipboard

Then paste into Render's FIREBASE_SERVICE_ACCOUNT_JSON env var.
"""
import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    path = Path(sys.argv[1]).expanduser().resolve()
    if not path.exists():
        print(f"file not found: {path}", file=sys.stderr)
        return 1

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        print(f"file is not valid JSON: {exc}", file=sys.stderr)
        return 1

    # Sanity-check it's actually a service-account JSON
    required = {"type", "project_id", "private_key", "client_email"}
    missing = required - data.keys()
    if missing:
        print(f"warning: missing expected service-account keys: {sorted(missing)}", file=sys.stderr)

    # Single line, no extra whitespace
    print(json.dumps(data, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
