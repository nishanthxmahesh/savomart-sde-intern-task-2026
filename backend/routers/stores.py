"""Proxy for the live Savomart Stores API.

Keeps the X-cron-token server-side, caches the upstream response for
5 minutes, and silently falls back to a hand-curated Bangalore list if
the upstream is down. The map should never see an error.
"""
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends

from config import settings
from models import User
from schemas import StoreResponse, StoresListResponse
from security import get_current_user

router = APIRouter(prefix="/api/stores", tags=["stores"])
log = logging.getLogger("savomart.stores")


# ---- hardcoded fallback (Bangalore) ----
# Store IDs match what the seed uses for store-specific offers in offers.py.
FALLBACK_STORES: list[dict[str, Any]] = [
    {
        "id": "indiranagar",
        "name": "Savomart Indiranagar",
        "address": "100 Feet Road, Indiranagar, Bengaluru 560038",
        "area": "Indiranagar",
        "city": "Bengaluru",
        "latitude": 12.9784,
        "longitude": 77.6408,
        "phone": "+91 80 4112 4001",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
    {
        "id": "koramangala",
        "name": "Savomart Koramangala",
        "address": "80 Feet Road, 4th Block, Koramangala, Bengaluru 560034",
        "area": "Koramangala",
        "city": "Bengaluru",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "phone": "+91 80 4112 4002",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
    {
        "id": "hsr",
        "name": "Savomart HSR Layout",
        "address": "27th Main Road, Sector 1, HSR Layout, Bengaluru 560102",
        "area": "HSR Layout",
        "city": "Bengaluru",
        "latitude": 12.9121,
        "longitude": 77.6446,
        "phone": "+91 80 4112 4003",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
    {
        "id": "whitefield",
        "name": "Savomart Whitefield",
        "address": "ITPL Main Road, Whitefield, Bengaluru 560066",
        "area": "Whitefield",
        "city": "Bengaluru",
        "latitude": 12.9698,
        "longitude": 77.7500,
        "phone": "+91 80 4112 4004",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
    {
        "id": "jayanagar",
        "name": "Savomart Jayanagar",
        "address": "11th Main Road, 4th Block, Jayanagar, Bengaluru 560011",
        "area": "Jayanagar",
        "city": "Bengaluru",
        "latitude": 12.9308,
        "longitude": 77.5830,
        "phone": "+91 80 4112 4005",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
    {
        "id": "marathahalli",
        "name": "Savomart Marathahalli",
        "address": "Outer Ring Road, Marathahalli, Bengaluru 560037",
        "area": "Marathahalli",
        "city": "Bengaluru",
        "latitude": 12.9591,
        "longitude": 77.6974,
        "phone": "+91 80 4112 4006",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
    {
        "id": "jpnagar",
        "name": "Savomart JP Nagar",
        "address": "24th Main Road, 6th Phase, JP Nagar, Bengaluru 560078",
        "area": "JP Nagar",
        "city": "Bengaluru",
        "latitude": 12.9077,
        "longitude": 77.5848,
        "phone": "+91 80 4112 4007",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
    {
        "id": "malleshwaram",
        "name": "Savomart Malleshwaram",
        "address": "Sampige Road, Malleshwaram, Bengaluru 560003",
        "area": "Malleshwaram",
        "city": "Bengaluru",
        "latitude": 13.0033,
        "longitude": 77.5689,
        "phone": "+91 80 4112 4008",
        "hours": "Mon–Sun · 7:00 AM – 11:00 PM",
        "is_operational": True,
    },
]


# ---- in-memory cache ----

_cache: dict[str, Any] = {
    "data": None,
    "fetched_at": None,
    "source": None,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_cache_fresh() -> bool:
    if _cache["data"] is None or _cache["fetched_at"] is None:
        return False
    age = (_now() - _cache["fetched_at"]).total_seconds()
    return age < settings.stores_cache_ttl_seconds


def _normalize(raw: Any) -> list[dict[str, Any]] | None:
    """Convert the upstream payload into our canonical store shape.

    Upstream shape is not documented in the brief, so we accept several
    plausible variations. Returns None if the payload is unusable.
    """
    if raw is None:
        return None

    candidates = None
    if isinstance(raw, list):
        candidates = raw
    elif isinstance(raw, dict):
        for key in ("data", "stores", "items", "results", "payload"):
            if key in raw and isinstance(raw[key], list):
                candidates = raw[key]
                break

    if not candidates:
        return None

    out: list[dict[str, Any]] = []
    for s in candidates:
        if not isinstance(s, dict):
            continue
        lat = s.get("latitude") or s.get("lat") or (s.get("location") or {}).get("lat")
        lon = (
            s.get("longitude")
            or s.get("lng")
            or s.get("lon")
            or (s.get("location") or {}).get("lng")
        )
        if lat is None or lon is None:
            continue
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (TypeError, ValueError):
            continue

        sid = str(
            s.get("id")
            or s.get("store_id")
            or s.get("code")
            or s.get("slug")
            or f"store-{len(out) + 1}"
        )
        name = (
            s.get("name")
            or s.get("store_name")
            or s.get("display_name")
            or f"Savomart {sid}"
        )
        address = (
            s.get("address")
            or s.get("full_address")
            or s.get("street")
            or ""
        )

        out.append(
            {
                "id": sid,
                "name": name,
                "address": address,
                "area": s.get("area") or s.get("locality") or s.get("neighborhood"),
                "city": s.get("city") or s.get("town"),
                "latitude": lat_f,
                "longitude": lon_f,
                "phone": s.get("phone") or s.get("contact_number") or s.get("mobile"),
                "hours": s.get("hours") or s.get("operating_hours") or s.get("timings"),
                "is_operational": bool(s.get("is_operational", True)),
            }
        )

    return out or None


def _fetch_upstream() -> tuple[list[dict[str, Any]] | None, bool]:
    """Returns (normalized list or None, ok flag)."""
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(
                settings.stores_api_url,
                headers={"X-cron-token": settings.stores_api_token},
            )
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        log.warning("upstream stores API failed: %s — falling back", exc)
        return None, False

    normalized = _normalize(raw)
    if not normalized:
        log.warning("upstream stores payload not recognized — falling back")
        return None, False
    return normalized, True


def _load(force_refresh: bool = False) -> tuple[list[dict[str, Any]], str, datetime]:
    if not force_refresh and _is_cache_fresh():
        return _cache["data"], _cache["source"], _cache["fetched_at"]

    data, ok = _fetch_upstream()
    if ok and data:
        _cache.update({"data": data, "source": "live", "fetched_at": _now()})
        return data, "live", _cache["fetched_at"]

    # fallback path — also cached so we don't hammer the upstream on every request
    _cache.update({"data": FALLBACK_STORES, "source": "fallback", "fetched_at": _now()})
    return FALLBACK_STORES, "fallback", _cache["fetched_at"]


@router.get("", response_model=StoresListResponse)
def list_stores(
    _user: User = Depends(get_current_user),
    refresh: bool = False,
):
    data, source, fetched_at = _load(force_refresh=refresh)
    items = [StoreResponse(**s) for s in data if s.get("is_operational", True)]
    return StoresListResponse(
        items=items,
        total=len(items),
        source=source,
        fetched_at=fetched_at,
    )
