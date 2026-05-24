"""Customer auth — mock OTP (no Firebase).

We generate a random 6-digit OTP on send-otp, store it in the OTPRecord
table, and print it to the console. The same code is also returned in the
response as `dev_otp` so the take-home reviewer can log in without needing
backend-console access.

This will be replaced with a real SMS provider (or Firebase Phone Auth on
a Blaze plan) before production.
"""
import logging
import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import OTPRecord, User
from schemas import (
    SendOTPRequest,
    SendOTPResponse,
    UserSummary,
    VerifyOTPRequest,
    VerifyOTPResponse,
)
from security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("savomart.auth")


def _generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post(
    "/send-otp",
    response_model=SendOTPResponse,
    responses={
        403: {"description": "Mobile not registered or account deactivated"},
    },
)
def send_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    mobile = payload.mobile_number

    # Customer self-signup is disabled — every loyalty member is enrolled by
    # an admin (Admin → Customers → Enroll customer or the Excel import).
    # An unknown mobile is sent back through the front door, not auto-created.
    user = db.query(User).filter(User.mobile_number == mobile).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "enrolled": False,
                "message": (
                    "This mobile isn't registered with Savomart. "
                    "Please register at any Savomart store to access loyalty."
                ),
            },
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "enrolled": True,
                "message": "This account is deactivated. Please reach out to support.",
            },
        )

    try:
        otp_code = _generate_otp()
        expires_at = _now() + timedelta(seconds=settings.otp_expire_seconds)

        db.query(OTPRecord).filter(
            OTPRecord.mobile_number == mobile,
            OTPRecord.is_used == False,  # noqa: E712
        ).update({"is_used": True})

        record = OTPRecord(
            mobile_number=mobile,
            otp_code=otp_code,
            expires_at=expires_at,
            is_used=False,
        )
        db.add(record)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        log.exception("send_otp DB failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Couldn't issue an OTP right now. Please try again.",
        ) from exc

    print(
        f"\n[SAVOMART OTP] mobile=+91{mobile}  code={otp_code}  expires_in={settings.otp_expire_seconds}s\n",
        flush=True,
    )

    return SendOTPResponse(
        message="OTP sent. Check your backend console (mock SMS).",
        expires_in=settings.otp_expire_seconds,
        dev_otp=otp_code if settings.environment != "production" else None,
    )


@router.post("/verify-otp", response_model=VerifyOTPResponse)
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    mobile = payload.mobile_number

    record = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.mobile_number == mobile,
            OTPRecord.otp_code == payload.otp,
            OTPRecord.is_used == False,  # noqa: E712
        )
        .order_by(OTPRecord.id.desc())
        .first()
    )

    if record is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    record.is_used = True

    user = db.query(User).filter(User.mobile_number == mobile).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is deactivated. Please reach out to support.",
        )

    user.last_login_at = _now()

    try:
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        log.exception("verify_otp DB failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login failed mid-way. Please try again.",
        ) from exc

    token = create_access_token(user.id)
    return VerifyOTPResponse(
        access_token=token,
        token_type="bearer",
        user=UserSummary.model_validate(user),
    )
