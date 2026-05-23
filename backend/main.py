from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, offers, profile
from seed import run_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_seed()
    yield


app = FastAPI(
    title="Savomart Loyalty API",
    version="0.1.0",
    description="Backend for the Savomart loyalty companion app.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/")
def root():
    return {"name": "Savomart Loyalty API", "version": "0.1.0", "docs": "/docs"}


app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(offers.router)
