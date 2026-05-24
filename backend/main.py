import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import (
    admin_analytics,
    admin_auth,
    admin_coupons,
    admin_dashboard,
    admin_offers,
    admin_points,
    admin_tickets,
    admin_users,
    auth,
    offers,
    profile,
    stores,
    support,
)
from seed import run_seed


# Configure our app loggers at INFO so seed/support/stores/auth all
# emit visible messages. Uvicorn's own access/error loggers stay at
# their default (controlled by --log-level on the CLI).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
)
logging.getLogger("savomart").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_seed()
    yield


app = FastAPI(
    title="Savomart Loyalty API",
    version="1.0.0",
    description="Backend for the Savomart loyalty companion app.",
    lifespan=lifespan,
)


def _build_cors_origins() -> list[str]:
    """Combine the comma-separated CORS_ORIGINS default with any
    additional production frontend URL set via FRONTEND_URL.

    Keeps localhost origins for dev tooling; adds the deployed Vercel
    URL when present so the same Render service serves both."""
    origins = list(settings.cors_origins_list)
    extra = (settings.frontend_url or "").strip().rstrip("/")
    if extra and extra not in origins:
        origins.append(extra)
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/")
def root():
    return {"name": "Savomart Loyalty API", "version": app.version, "docs": "/docs"}


app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(offers.router)
app.include_router(stores.router)
app.include_router(support.router)

# Admin (separate auth namespace — see admin_security.py)
app.include_router(admin_auth.router)
app.include_router(admin_dashboard.router)
app.include_router(admin_offers.router)
app.include_router(admin_coupons.router)
app.include_router(admin_points.router)
app.include_router(admin_tickets.router)
app.include_router(admin_users.router)
app.include_router(admin_analytics.router)
