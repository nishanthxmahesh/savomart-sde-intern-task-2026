"""Database engine setup.

Picks the dialect at startup:
- If DATABASE_URL is set in the environment (e.g. on Render → Neon Postgres),
  use Postgres for real persistence.
- Otherwise, fall back to a local SQLite file at backend/savomart.db so
  local development needs zero setup.

Render historically issues Postgres URLs with the legacy `postgres://`
scheme. SQLAlchemy 2.0 only accepts `postgresql://`, so we rewrite it.
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
SQLITE_PATH = BASE_DIR / "savomart.db"


def _resolve_database_url() -> tuple[str, dict]:
    """Returns (url, engine_kwargs)."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        # Render/Heroku-style scheme rewrite
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        # Neon pooled connections need sslmode=require; if the user pasted
        # the URL without it, add it. (Neon URLs usually include it already.)
        if "sslmode=" not in url and url.startswith("postgresql"):
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}sslmode=require"
        # Postgres doesn't need check_same_thread; pre-ping recycles dead
        # connections that get reaped by Neon's idle timeout.
        return url, {"pool_pre_ping": True, "pool_recycle": 300}

    return f"sqlite:///{SQLITE_PATH}", {"connect_args": {"check_same_thread": False}}


SQLALCHEMY_DATABASE_URL, _engine_kwargs = _resolve_database_url()

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
