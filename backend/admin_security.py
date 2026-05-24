"""Admin auth — bcrypt password hashing + a separate-secret JWT.

The admin JWT lives in its own secret keyspace so a leaked customer token
can never authenticate against /api/admin/* (and vice versa).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import AdminRole, AdminUser

# tokenUrl is informational only — admin login is JSON, not form-encoded
admin_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/admin/login", auto_error=False)

TOKEN_TYPE = "savo_admin"  # claim that distinguishes admin tokens from customer ones


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_admin_token(admin: AdminUser) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.admin_jwt_expire_hours)
    payload = {
        "sub": str(admin.id),
        "exp": expire,
        "type": TOKEN_TYPE,
        "role": admin.role.value,
        "store_id": admin.store_id,
    }
    return jwt.encode(payload, settings.admin_jwt_secret, algorithm=settings.jwt_algorithm)


def decode_admin_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.admin_jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != TOKEN_TYPE:
            return None
        return payload
    except JWTError:
        return None


def _credentials_exc() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin authentication required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_admin(
    token: Optional[str] = Depends(admin_oauth2_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
    if not token:
        raise _credentials_exc()
    payload = decode_admin_token(token)
    if payload is None:
        raise _credentials_exc()
    try:
        admin_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise _credentials_exc()
    admin = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if admin is None or not admin.is_active:
        raise _credentials_exc()
    return admin


def require_superadmin(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
    if admin.role != AdminRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin role required for this action.",
        )
    return admin
