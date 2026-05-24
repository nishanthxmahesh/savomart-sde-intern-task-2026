"""Firebase Admin SDK initialization.

Initializes once on import. Service account credentials are loaded from:
1. FIREBASE_SERVICE_ACCOUNT_JSON env var (minified JSON, single line) — used on Render
2. backend/firebase-service-account.json on disk — used for local dev

If neither is present, the SDK is NOT initialized. The auth endpoint
detects that and returns a clear 503 — the rest of the API still boots.
"""
import json
import logging
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials

log = logging.getLogger("savomart.firebase")

LOCAL_KEY_PATH = Path(__file__).resolve().parent / "firebase-service-account.json"

_initialized = False


def initialize_firebase() -> bool:
    """Returns True if Firebase is configured and ready, False otherwise."""
    global _initialized
    if _initialized or firebase_admin._apps:
        _initialized = True
        return True

    cred = None
    inline = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if inline:
        try:
            cred_dict = json.loads(inline)
            cred = credentials.Certificate(cred_dict)
        except (json.JSONDecodeError, ValueError) as exc:
            log.warning("FIREBASE_SERVICE_ACCOUNT_JSON malformed: %s", exc)
    elif LOCAL_KEY_PATH.exists():
        try:
            cred = credentials.Certificate(str(LOCAL_KEY_PATH))
        except (ValueError, FileNotFoundError) as exc:
            log.warning("firebase-service-account.json unreadable: %s", exc)

    if cred is None:
        log.warning(
            "Firebase not configured. Customer login will return 503 until "
            "FIREBASE_SERVICE_ACCOUNT_JSON is set OR backend/firebase-service-account.json "
            "is provided."
        )
        return False

    try:
        firebase_admin.initialize_app(cred)
        _initialized = True
        log.info("Firebase Admin SDK initialized")
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("Firebase init failed: %s", exc)
        return False


def is_ready() -> bool:
    return _initialized or bool(firebase_admin._apps)


# Attempt initialization on import — success/failure is non-fatal
initialize_firebase()
