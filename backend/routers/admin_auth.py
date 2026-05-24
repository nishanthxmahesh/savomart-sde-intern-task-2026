import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from admin_security import (
    create_admin_token,
    get_current_admin,
    verify_password,
)
from audit import audit_log
from config import settings
from database import get_db
from models import AdminUser
from schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminSummary,
)

router = APIRouter(prefix="/api/admin", tags=["admin-auth"])
log = logging.getLogger("savomart.admin")


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.email == payload.email.strip().lower()).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        # Same message for "no such admin" and "wrong password" — never leak which
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This admin account is deactivated.",
        )

    admin.last_login_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        # Non-fatal — login can still proceed without recording the timestamp

    audit_log(db, admin, action="admin.login")

    token = create_admin_token(admin)
    return AdminLoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in_hours=settings.admin_jwt_expire_hours,
        admin=AdminSummary.model_validate(admin),
    )


@router.get("/me", response_model=AdminSummary)
def admin_me(admin: AdminUser = Depends(get_current_admin)):
    return AdminSummary.model_validate(admin)
